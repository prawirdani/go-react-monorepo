package main

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/prawirdani/go-react-monorepo/config"
)

func TestValidate(t *testing.T) {
	tests := []struct {
		name    string
		cfg     backupConfig
		wantErr []string
	}{
		{
			name:    "empty backup bucket",
			cfg:     backupConfig{PublicBucket: "images"},
			wantErr: []string{"BACKUP_R2_BUCKET", "not set"},
		},
		{
			// A dump in the publicly served bucket is a leak, not a backup.
			name:    "backup bucket is the public bucket",
			cfg:     backupConfig{PublicBucket: "images", Backup: config.Backup{Bucket: "images"}},
			wantErr: []string{"BACKUP_R2_BUCKET", "R2_BUCKET", "publicly"},
		},
		{
			name: "private bucket",
			cfg:  backupConfig{PublicBucket: "images", Backup: config.Backup{Bucket: "dumps"}},
		},
		{
			// The API runs without any backup config; so does the guard.
			name: "no public bucket configured",
			cfg:  backupConfig{Backup: config.Backup{Bucket: "dumps"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := guardBackupConfig(tt.cfg)
			if len(tt.wantErr) == 0 {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			for _, want := range tt.wantErr {
				assert.ErrorContains(t, err, want)
			}
		})
	}
}

func TestObjectKey(t *testing.T) {
	utc := time.Date(2026, 10, 25, 1, 2, 3, 0, time.UTC)
	jakarta := time.Date(2026, 10, 25, 8, 2, 3, 0, time.FixedZone("UTC+7", 7*60*60))

	tests := []struct {
		name   string
		prefix string
		dbName string
		at     time.Time
		want   string
	}{
		{
			name:   "default prefix",
			dbName: "app",
			at:     utc,
			want:   "postgres/app-20261025-010203.dump",
		},
		{
			name:   "custom prefix",
			prefix: "db/daily",
			dbName: "app",
			at:     utc,
			want:   "db/daily/app-20261025-010203.dump",
		},
		{
			name:   "timestamp is UTC",
			dbName: "app",
			at:     jakarta,
			want:   "postgres/app-20261025-010203.dump",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, objectKey(tt.prefix, tt.dbName, tt.at))
		})
	}
}

func TestDumpCmd(t *testing.T) {
	db := config.Postgres{
		Host:     "db.internal",
		Port:     5432,
		User:     "app",
		Password: "s3cr3t-password",
		Name:     "app",
	}

	cmd := dumpCmd(context.Background(), db)

	assert.Equal(t, []string{"-Fc"}, cmd.Args[1:], "custom format, no credentials in argv")
	assert.NotContains(t, strings.Join(cmd.Args, " "), db.Password, "password must never reach argv")
	assert.NotContains(t, strings.Join(cmd.Args, " "), db.User, "connection target must never reach argv")

	for _, want := range []string{
		"PGHOST=" + db.Host,
		"PGPORT=5432",
		"PGUSER=" + db.User,
		"PGPASSWORD=" + db.Password,
		"PGDATABASE=" + db.Name,
	} {
		assert.Contains(t, cmd.Env, want)
	}
}

func TestDumpEnvOmitsZeroPort(t *testing.T) {
	env := dumpEnv(config.Postgres{Name: "app"})

	for _, v := range env {
		assert.False(t, strings.HasPrefix(v, "PGPORT="), "PGPORT must be omitted when DB_PORT is unset")
	}
}

func TestTailBufferKeepsTail(t *testing.T) {
	tb := &tailBuffer{max: 4}
	_, err := tb.Write([]byte("0123456789"))
	require.NoError(t, err)

	assert.Equal(t, "6789", tb.String())
}
