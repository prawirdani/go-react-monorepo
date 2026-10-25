package main

// The backup engine streams a PostgreSQL custom-format dump straight into a
// private Cloudflare R2 bucket, and lists the objects it has written.
//
// It replaces the old pg_dump -> temp file -> rclone shell script that the deploy
// image no longer ships. The dump is never written to disk: pg_dump's stdout is
// piped into a multipart upload part by part. It lives here because backups are a
// CLI concern, not a domain package.

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/prawirdani/go-react-monorepo/config"
)

const (
	// dumpTimeout bounds one backup run. A whole-database custom dump is single
	// streamed and can be slow on a large database; 2h matches the shell
	// script's cron expectation while still killing a wedged child.
	dumpTimeout = 2 * time.Hour

	// stderrTail is how much pg_dump stderr is kept for the error message.
	// Only the tail matters: pg_dump prints the decisive line last.
	stderrTail = 4 << 10

	// partSize is the upload part size. R2 requires at least 5 MiB per part
	// (except the last); 16 MiB keeps the part count low for a few-GB dump
	// without buffering much.
	partSize = 16 << 20

	// defaultPrefix mirrors BACKUP_PREFIX's default in the shell script.
	defaultPrefix = "postgres"

	pgDumpBin = "pg_dump"
)

// backupConfig is everything a backup run needs. It is passed by value so
// callers (CLI, TUI) can build it from config.Config without a constructor.
type backupConfig struct {
	DB config.Postgres
	// PublicBucket is R2_BUCKET: the images bucket served from a public URL.
	// A dump there is a data leak rather than a backup, so the guard refuses it.
	PublicBucket string
	Backup       config.Backup
}

// backupObject is one dump already in the bucket.
type backupObject struct {
	Key          string
	Size         int64
	LastModified time.Time
}

// runBackupCLI is the non-interactive backup entry point (cron, `cli --backup`).
// With no args it runs one dump; `list` prints the last 10 objects. Progress
// goes to stderr and stdout stays quiet except the key, so a caller can capture it.
func runBackupCLI(ctx context.Context, args []string) error {
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	opts := backupConfig{
		DB:           cfg.Postgres,
		PublicBucket: cfg.R2.Bucket,
		Backup:       cfg.Backup,
	}

	switch {
	case len(args) == 0:
		key, err := runBackupEngine(ctx, opts, func(msg string) {
			fmt.Fprintln(os.Stderr, msg)
		})
		if err != nil {
			return err
		}
		fmt.Println(key)
		return nil

	case len(args) == 1 && args[0] == "list":
		objects, err := listBackups(ctx, opts, 10)
		if err != nil {
			return err
		}
		for _, o := range objects {
			fmt.Printf("%s\t%d\t%s\n", o.Key, o.Size, o.LastModified.UTC().Format(time.RFC3339))
		}
		return nil

	default:
		return fmt.Errorf("usage: cli --backup [list]")
	}
}

// guardBackupConfig is the guard alone, without touching the network or
// pg_dump, so a TUI can check configuration before offering a "run backup"
// action.
func guardBackupConfig(cfg backupConfig) error {
	if cfg.Backup.Bucket == "" {
		return fmt.Errorf("BACKUP_R2_BUCKET is not set: backups need their own private bucket")
	}
	// HARD GUARD: R2_BUCKET is served from a public URL, so a dump there is a
	// data leak, not a backup.
	if cfg.Backup.Bucket == cfg.PublicBucket {
		return fmt.Errorf("BACKUP_R2_BUCKET equals R2_BUCKET, which is served publicly: refusing to upload database dumps to a public bucket, use a separate private bucket")
	}
	return nil
}

// runBackupEngine dumps the configured database and uploads it, returning the
// object key. progress receives one short line per phase and may be nil.
func runBackupEngine(ctx context.Context, cfg backupConfig, progress func(string)) (string, error) {
	if err := guardBackupConfig(cfg); err != nil {
		return "", err
	}
	if progress == nil {
		progress = func(string) {}
	}

	ctx, cancel := context.WithTimeout(ctx, dumpTimeout)
	defer cancel()

	client, err := newClient(ctx, cfg.Backup)
	if err != nil {
		return "", err
	}

	key := objectKey(cfg.Backup.Prefix, cfg.DB.Name, time.Now().UTC())

	cmd := dumpCmd(ctx, cfg.DB)
	stderr := &tailBuffer{max: stderrTail}
	cmd.Stderr = stderr

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", fmt.Errorf("pg_dump stdout: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("start pg_dump: %w", err)
	}
	progress("dumping")
	progress("uploading " + key)

	// Publishing before the dump exits would leave a truncated archive in the
	// bucket, so the uploader calls this before completing the multipart upload.
	wait := func() error {
		if err := cmd.Wait(); err != nil {
			if msg := stderr.String(); msg != "" {
				return fmt.Errorf("pg_dump: %w: %s", err, msg)
			}
			return fmt.Errorf("pg_dump: %w", err)
		}
		return nil
	}

	if err := upload(ctx, client, cfg.Backup.Bucket, key, stdout, wait); err != nil {
		// The child may still be running (upload failed first): kill and reap
		// it. A double Wait is harmless and its error is already reported.
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		if ctxErr := ctx.Err(); ctxErr != nil {
			return "", fmt.Errorf("backup interrupted: %w", ctxErr)
		}
		return "", err
	}

	progress("done")
	return key, nil
}

// listBackups returns the newest objects under the backup prefix, newest first.
func listBackups(ctx context.Context, cfg backupConfig, limit int) ([]backupObject, error) {
	if err := guardBackupConfig(cfg); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 10
	}

	client, err := newClient(ctx, cfg.Backup)
	if err != nil {
		return nil, err
	}

	// shortcut: one page (up to 1000 keys); add a paginator if a bucket ever
	// holds more dumps than that.
	out, err := client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket: aws.String(cfg.Backup.Bucket),
		Prefix: aws.String(prefixOf(cfg.Backup.Prefix) + "/"),
	})
	if err != nil {
		return nil, fmt.Errorf("list backups: %w", err)
	}

	objects := make([]backupObject, 0, len(out.Contents))
	for _, o := range out.Contents {
		objects = append(objects, backupObject{
			Key:          aws.ToString(o.Key),
			Size:         aws.ToInt64(o.Size),
			LastModified: aws.ToTime(o.LastModified),
		})
	}
	sort.Slice(objects, func(i, j int) bool {
		return objects[i].LastModified.After(objects[j].LastModified)
	})
	if len(objects) > limit {
		objects = objects[:limit]
	}
	return objects, nil
}

// objectKey builds PREFIX/DB_NAME-<UTC yyyymmdd-hhmmss>.dump.
func objectKey(prefix, dbName string, at time.Time) string {
	return fmt.Sprintf("%s/%s-%s.dump", prefixOf(prefix), dbName, at.UTC().Format("20060102-150405"))
}

func prefixOf(prefix string) string {
	if prefix == "" {
		return defaultPrefix
	}
	return prefix
}

// dumpArgs returns pg_dump's argv. It is a function so tests can assert that no
// credential ever reaches the command line.
func dumpArgs() []string {
	// -Fc: custom, self-compressed archive that pg_restore can read
	// selectively or in parallel. Ownership stays recorded in the archive; the
	// restore side decides with --no-owner.
	return []string{"-Fc"}
}

// dumpEnv builds the child environment. Credentials and the connection target
// go through PG* env only, never argv, so they never appear in the process
// list.
func dumpEnv(db config.Postgres) []string {
	env := append(os.Environ(),
		"PGHOST="+db.Host,
		"PGUSER="+db.User,
		"PGPASSWORD="+db.Password,
		"PGDATABASE="+db.Name,
	)
	// An unset DB_PORT means the server default; passing PGPORT=0 would fail.
	if db.Port > 0 {
		env = append(env, "PGPORT="+strconv.Itoa(db.Port))
	}
	return env
}

// dumpCmd builds the pg_dump child. CommandContext kills it on cancellation.
func dumpCmd(ctx context.Context, db config.Postgres) *exec.Cmd {
	//nolint:gosec // G204: the binary and its argv are constants, not user input
	cmd := exec.CommandContext(ctx, pgDumpBin, dumpArgs()...)
	cmd.Env = dumpEnv(db)
	return cmd
}

// newClient builds an S3 client for the backups bucket. It mirrors
// internal/infrastructure/r2 (static credentials, region "auto", R2 endpoint)
// but must not reuse it: that package is wired to the public images bucket.
func newClient(ctx context.Context, cfg config.Backup) (*s3.Client, error) {
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		),
		awsconfig.WithRegion("auto"),
	)
	if err != nil {
		return nil, fmt.Errorf("backup r2 config: %w", err)
	}
	return s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(
			fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.AccountID),
		)
	}), nil
}

// upload streams body into one object with a multipart upload, calling finished
// before publishing it. Each part has a known length, so no chunked
// transfer-encoding is used (R2 rejects that, which is why the shell script
// needed a temp file).
//
// shortcut: hand-rolled instead of manager.Uploader, which lives in a separate
// aws-sdk module this repo does not depend on. Swap in the manager if that
// module is ever added.
func upload(
	ctx context.Context,
	client *s3.Client,
	bucket, key string,
	body io.Reader,
	finished func() error,
) error {
	created, err := client.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		ContentType: aws.String("application/octet-stream"),
	})
	if err != nil {
		return fmt.Errorf("create upload: %w", err)
	}
	uploadID := created.UploadId

	completed := false
	defer func() {
		if completed {
			return
		}
		// Abort on every failure path so a partial upload is never billed.
		_, _ = client.AbortMultipartUpload(context.WithoutCancel(ctx), &s3.AbortMultipartUploadInput{
			Bucket:   aws.String(bucket),
			Key:      aws.String(key),
			UploadId: uploadID,
		})
	}()

	parts := make([]types.CompletedPart, 0, 1)
	buf := make([]byte, partSize)
	for number := 1; ; number++ {
		n, readErr := io.ReadFull(body, buf)
		if n > 0 {
			part, err := client.UploadPart(ctx, &s3.UploadPartInput{
				Bucket:        aws.String(bucket),
				Key:           aws.String(key),
				UploadId:      uploadID,
				PartNumber:    aws.Int32(int32(number)),
				Body:          bytes.NewReader(buf[:n]),
				ContentLength: aws.Int64(int64(n)),
			})
			if err != nil {
				return fmt.Errorf("upload part %d: %w", number, err)
			}
			parts = append(parts, types.CompletedPart{
				ETag:       part.ETag,
				PartNumber: aws.Int32(int32(number)),
			})
		}
		if readErr != nil {
			if errors.Is(readErr, io.EOF) || errors.Is(readErr, io.ErrUnexpectedEOF) {
				break
			}
			return fmt.Errorf("read pg_dump output: %w", readErr)
		}
	}

	// The dump must have exited cleanly before the object becomes visible.
	if err := finished(); err != nil {
		return err
	}

	// CompleteMultipartUpload rejects an empty part list, so an empty stream
	// would otherwise fail with an opaque S3 error instead of naming the cause.
	if len(parts) == 0 {
		return fmt.Errorf("pg_dump produced no output")
	}

	_, err = client.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{
		Bucket:   aws.String(bucket),
		Key:      aws.String(key),
		UploadId: uploadID,
		MultipartUpload: &types.CompletedMultipartUpload{
			Parts: parts,
		},
	})
	if err != nil {
		return fmt.Errorf("complete upload: %w", err)
	}
	completed = true
	return nil
}

// tailBuffer keeps only the last max bytes written to it, so a failing child's
// stderr tail fits in an error message without unbounded growth.
type tailBuffer struct {
	max int
	buf []byte
}

func (t *tailBuffer) Write(p []byte) (int, error) {
	t.buf = append(t.buf, p...)
	if t.max > 0 && len(t.buf) > t.max {
		t.buf = t.buf[len(t.buf)-t.max:]
	}
	return len(p), nil
}

func (t *tailBuffer) String() string {
	return strings.TrimSpace(string(t.buf))
}
