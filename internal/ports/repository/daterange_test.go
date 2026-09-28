package repository

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// TestDateRange_Bounds pins the half-open interval semantics, the zone the bounds
// are read in, and the in-place canonical echo: the struct must keep describing
// the user's input, because the response metadata echoes it, while the returned
// bounds are what the query filters on.
//
// Bounds are compared as formatted RFC3339 so the assertion covers the offset as
// well as the instant — two bounds naming the same moment in different zones are
// not interchangeable here.
func TestDateRange_Bounds(t *testing.T) {
	tests := []struct {
		name     string
		in       DateRange
		wantFrom string // RFC3339; empty means no lower bound
		wantTo   string // RFC3339; empty means no upper bound
		wantOK   bool
		want     DateRange // canonical echo
	}{
		{
			name:     "a date covers the whole day, UTC by default",
			in:       DateRange{Date: "2024-03-15"},
			wantFrom: "2024-03-15T00:00:00Z",
			wantTo:   "2024-03-16T00:00:00Z",
			wantOK:   true,
			want:     DateRange{Date: "2024-03-15", TZ: "UTC"},
		},
		{
			name:     "from and to are both inclusive of their day",
			in:       DateRange{From: "2024-01-01", To: "2024-01-31"},
			wantFrom: "2024-01-01T00:00:00Z",
			wantTo:   "2024-02-01T00:00:00Z",
			wantOK:   true,
			want:     DateRange{From: "2024-01-01", To: "2024-01-31", TZ: "UTC"},
		},
		{
			name:     "from only is open on the upper side",
			in:       DateRange{From: "2024-01-01"},
			wantFrom: "2024-01-01T00:00:00Z",
			wantOK:   true,
			want:     DateRange{From: "2024-01-01", TZ: "UTC"},
		},
		{
			name:   "to only is open on the lower side",
			in:     DateRange{To: "2024-01-31"},
			wantTo: "2024-02-01T00:00:00Z",
			wantOK: true,
			want:   DateRange{To: "2024-01-31", TZ: "UTC"},
		},
		{
			name:     "a date is read in the requested zone",
			in:       DateRange{Date: "2026-09-01", TZ: "Asia/Jakarta"},
			wantFrom: "2026-09-01T00:00:00+07:00",
			wantTo:   "2026-09-02T00:00:00+07:00",
			wantOK:   true,
			want:     DateRange{Date: "2026-09-01", TZ: "Asia/Jakarta"},
		},
		{
			name:     "the whole from/to range shifts with the zone",
			in:       DateRange{From: "2026-09-01", To: "2026-09-28", TZ: "Asia/Jakarta"},
			wantFrom: "2026-09-01T00:00:00+07:00",
			wantTo:   "2026-09-29T00:00:00+07:00",
			wantOK:   true,
			want:     DateRange{From: "2026-09-01", To: "2026-09-28", TZ: "Asia/Jakarta"},
		},
		{
			// A day is stepped with AddDate, not 24h: this one is 23 hours long
			// because the US switches to daylight time inside it.
			name:     "a day is not assumed to be 24 hours across a DST change",
			in:       DateRange{From: "2024-03-10", To: "2024-03-10", TZ: "America/New_York"},
			wantFrom: "2024-03-10T00:00:00-05:00",
			wantTo:   "2024-03-11T00:00:00-04:00",
			wantOK:   true,
			want:     DateRange{From: "2024-03-10", To: "2024-03-10", TZ: "America/New_York"},
		},
		{
			name:     "an unknown zone falls back to UTC and reports that",
			in:       DateRange{From: "2024-01-01", TZ: "Mars/Olympus"},
			wantFrom: "2024-01-01T00:00:00Z",
			wantOK:   true,
			want:     DateRange{From: "2024-01-01", TZ: "UTC"},
		},
		{
			// An offset is not an IANA name, so it is rejected rather than read
			// as a fixed zone.
			name:     "a bare offset is not a zone name",
			in:       DateRange{Date: "2024-03-15", TZ: "+07:00"},
			wantFrom: "2024-03-15T00:00:00Z",
			wantTo:   "2024-03-16T00:00:00Z",
			wantOK:   true,
			want:     DateRange{Date: "2024-03-15", TZ: "UTC"},
		},
		{
			name:     "date wins over from and to, which are cleared",
			in:       DateRange{Date: "2024-03-15", From: "2020-01-01", To: "2020-02-01"},
			wantFrom: "2024-03-15T00:00:00Z",
			wantTo:   "2024-03-16T00:00:00Z",
			wantOK:   true,
			want:     DateRange{Date: "2024-03-15", TZ: "UTC"},
		},
		{
			name: "a timestamp is malformed now, so both bounds drop",
			in:   DateRange{From: "2024-01-01T00:00:00Z", To: "2024-01-31T23:59:59Z"},
			want: DateRange{},
		},
		{
			name:     "a timestamp drops without taking the valid date with it",
			in:       DateRange{From: "2024-01-01", To: "2024-01-31T12:00:00Z"},
			wantFrom: "2024-01-01T00:00:00Z",
			wantOK:   true,
			want:     DateRange{From: "2024-01-01", TZ: "UTC"},
		},
		{
			name: "malformed values are dropped and add no bound",
			in:   DateRange{Date: "nope", From: "2020-13-40", To: "garbage"},
			want: DateRange{},
		},
		{
			name: "an all-empty range is not ok",
			in:   DateRange{},
			want: DateRange{},
		},
		{
			name: "a zone with no range applies nothing, so it is not echoed",
			in:   DateRange{TZ: "Asia/Jakarta"},
			want: DateRange{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			in := tt.in

			from, to, ok := in.Bounds()

			assert.Equal(t, tt.wantOK, ok, "ok")

			if tt.wantFrom == "" {
				assert.True(t, from.IsZero(), "from should be unset, got %v", from)
			} else {
				assert.Equal(t, tt.wantFrom, from.Format(time.RFC3339), "from")
			}

			if tt.wantTo == "" {
				assert.True(t, to.IsZero(), "to should be unset, got %v", to)
			} else {
				assert.Equal(t, tt.wantTo, to.Format(time.RFC3339), "to")
			}

			assert.Equal(t, tt.want, in, "canonical echo")
		})
	}
}
