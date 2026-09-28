package repository

import "time"

// DateRange filters a timestamp column by a half-open interval [From, To).
// It binds from the query string and sanitises itself in place, so the response
// metadata echoes exactly what was applied, like Sorting and Pagination.
//
// The bounds are calendar dates read in TZ, not instants: the caller says which
// day it means and which zone it is thinking in, and the server works out the
// offsets. An absent or unknown TZ falls back to UTC, and the echo reports the
// zone the query actually ran in.
type DateRange struct {
	Date string `query:"date" json:"date,omitempty"`
	From string `query:"from" json:"from,omitempty"`
	To   string `query:"to"   json:"to,omitempty"`
	TZ   string `query:"tz"   json:"tz,omitempty"`
}

// Bounds returns the half-open interval the filter asks for and rewrites the
// request fields to their canonical form. ok is false when nothing usable was
// supplied — malformed values are dropped, mirroring how the entity filters drop
// values the domain does not recognise. (Surfacing 422 for a malformed date needs
// a Validate method the handler calls; deliberately not added here.)
//
// Every bound is a bare calendar date (2006-01-02) read in TZ; a timestamp is
// malformed rather than an instant, because with a zone supplied separately there
// is only one way to name a day. `from` is inclusive and `to` covers its whole
// day, so from=2026-09-01&to=2026-09-28 selects through the end of the 28th.
// Days are stepped with AddDate rather than 24h so a DST transition cannot
// shorten or lengthen the window.
func (d *DateRange) Bounds() (from, to time.Time, ok bool) {
	loc := d.location()

	// date wins over from/to; a malformed date falls through to them.
	if d.Date != "" {
		if t, err := parseBound(d.Date, loc); err == nil {
			d.Date = t.Format(time.DateOnly)
			d.From, d.To = "", ""
			d.TZ = loc.String()

			// The window starts at the instant the caller sent, so `from` is
			// exactly that value and the echoed metadata describes what the
			// query bound to.
			return t, t.AddDate(0, 0, 1), true
		}
		d.Date = ""
	}

	if d.From != "" {
		if t, err := parseBound(d.From, loc); err == nil {
			from = t
			ok = true
			d.From = t.Format(time.DateOnly)
		} else {
			d.From = ""
		}
	}

	if d.To != "" {
		if t, err := parseBound(d.To, loc); err == nil {
			// A `to` date includes that whole day.
			to = t.AddDate(0, 0, 1)
			ok = true
			d.To = t.Format(time.DateOnly)
		} else {
			d.To = ""
		}
	}

	if !ok {
		// Nothing was applied, so there is no zone to report either.
		d.TZ = ""
		return from, to, false
	}

	d.TZ = loc.String()

	return from, to, true
}

// location resolves the tz parameter, falling back to UTC when it is absent or
// not a known IANA name. The unusable value is never echoed back: the metadata
// describes the zone the query ran in.
func (d *DateRange) location() *time.Location {
	if d.TZ == "" {
		return time.UTC
	}

	loc, err := time.LoadLocation(d.TZ)
	if err != nil {
		return time.UTC
	}

	return loc
}

// parseBound reads a bare calendar date as midnight in loc.
func parseBound(value string, loc *time.Location) (time.Time, error) {
	return time.ParseInLocation(time.DateOnly, value, loc)
}
