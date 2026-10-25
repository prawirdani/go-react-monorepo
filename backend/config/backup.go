package config

import "os"

// Backup holds the credentials and target for the PostgreSQL backup job.
// It is a private bucket, separate from the public images bucket (R2) - the
// engine and its guard live in cmd/cli. Unset values are valid for the API: only
// the backup CLI and TUI require them, so this is deliberately not part of
// Validate().
type Backup struct {
	// AccountID is BACKUP_R2_ACCOUNT_ID: the Cloudflare account that owns the
	// backups bucket, used to build the R2 S3 endpoint.
	AccountID string
	// AccessKeyID is BACKUP_R2_ACCESS_KEY_ID: the backups bucket's access key.
	AccessKeyID string
	// SecretAccessKey is BACKUP_R2_SECRET_ACCESS_KEY: the matching secret.
	SecretAccessKey string
	// Bucket is BACKUP_R2_BUCKET: the private bucket dumps are uploaded to.
	Bucket string
	// Prefix is BACKUP_PREFIX: the key prefix dumps live under. Defaults to
	// "postgres"; retention is an R2 lifecycle rule on this prefix.
	Prefix string
}

func (b *Backup) Parse() error {
	b.AccountID = os.Getenv("BACKUP_R2_ACCOUNT_ID")
	b.AccessKeyID = os.Getenv("BACKUP_R2_ACCESS_KEY_ID")
	b.SecretAccessKey = os.Getenv("BACKUP_R2_SECRET_ACCESS_KEY")
	b.Bucket = os.Getenv("BACKUP_R2_BUCKET")
	b.Prefix = os.Getenv("BACKUP_PREFIX")
	if b.Prefix == "" {
		b.Prefix = "postgres"
	}
	return nil
}
