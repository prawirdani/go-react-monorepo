// Package migrations embeds the goose SQL files so the CLI can migrate without
// a checkout on disk.
package migrations

import "embed"

// FS holds the goose SQL files so the CLI can migrate without a checkout on disk.
//
//go:embed *.sql
var FS embed.FS
