-- +goose Up
-- +goose StatementBegin
SELECT
  'up SQL query';

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  email_verified_at TIMESTAMPTZ,
  phone VARCHAR(30),
  password VARCHAR(255) NOT NULL,
  profile_picture VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'system')),
  -- M=Male, F=Female, O=Other
  gender CHAR(1) CHECK (gender IN ('M', 'F', 'O')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX users_email_key ON users (email)
WHERE
  deleted_at IS NULL;

-- Backs the admin list's tombstone-last ordering ((deleted_at IS NOT NULL), created_at).
CREATE INDEX users_deleted_created_idx ON users ((deleted_at IS NOT NULL), created_at);

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
SELECT
  'down SQL query';

DROP TABLE IF EXISTS users;

-- +goose StatementEnd
