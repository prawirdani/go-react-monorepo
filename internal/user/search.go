package user

import (
	"strings"

	"github.com/prawirdani/go-react-monorepo/internal/ports/repository"
	"github.com/prawirdani/go-react-monorepo/internal/rbac"
)

// Deletion states accepted by Filter.DeletedAt.
const (
	DeletionStateActive  = "active"
	DeletionStateDeleted = "deleted"
)

type Filter struct {
	Gender    []string `query:"gender"     json:"gender,omitempty"`
	Role      []string `query:"role"       json:"role,omitempty"`
	DeletedAt []string `query:"deleted_at" json:"deleted_at,omitempty"`
}

type Search struct {
	Filter
	repository.Sorting
	repository.Pagination
	meta repository.QueryMeta[Filter]
}

var userSortFields = map[string]string{
	"id":         "id",
	"created_at": "created_at",
	"updated_at": "updated_at",
}

// ApplySort implements [repository.Sorter]
//
// Tombstones always sink below live accounts: the first key is a boolean
// expression, so every requested ordering (created_at, id, ...) stays intact
// within each group. The pointer receiver lets the sanitised sort reach the
// metadata, which echoes these fields.
func (s *Search) ApplySort(q repository.Query) {
	q.OrderBy("(deleted_at IS NOT NULL)", "ASC")
	s.Sorting.ApplySort(q, userSortFields)
}

// ApplyFilter implements [repository.Filterer].
//
// Sanitisation happens here: values the domain does not recognise are dropped
// and the rest are canonicalised, so the query filters on exactly the values
// [Search.SetMeta] reports as applied. The slices stay nil when nothing
// survives, which leaves the filter at its zero value so the metadata omits it.
//
// DeletedAt is a list on the wire, but the UI drives a radio: at most one state
// per request. An absent param means no deletion filter at all: every row is
// listed, which is what the "Semua" option sends. Active only lists live users;
// deleted only lists tombstones. Both states still mean every row, so a caller
// that sends the whole set is answered like a caller that sends none.
func (s *Search) ApplyFilter(q repository.Query) {
	var validGenders []string

	for _, v := range s.Gender {
		if g, ok := ParseGender(v); ok {
			validGenders = append(validGenders, string(g))
		}
	}

	var validRoles []string

	for _, v := range s.Role {
		if r, ok := rbac.ParseRole(v); ok {
			validRoles = append(validRoles, string(r))
		}
	}

	var validStates []string

	seen := make(map[string]bool, len(s.DeletedAt))
	for _, v := range s.DeletedAt {
		state := strings.ToLower(strings.TrimSpace(v))
		if state != DeletionStateActive && state != DeletionStateDeleted {
			continue
		}
		if seen[state] {
			continue
		}
		seen[state] = true
		validStates = append(validStates, state)
	}

	s.Gender = validGenders
	s.Role = validRoles
	s.DeletedAt = validStates

	q.WhereIn("gender", s.Gender)
	q.WhereIn("role", s.Role)

	switch {
	case len(validStates) == 1 && validStates[0] == DeletionStateActive:
		q.WhereNull("deleted_at")
	case len(validStates) == 1 && validStates[0] == DeletionStateDeleted:
		q.WhereNotNull("deleted_at")
	}
}

func (s *Search) SetMeta(total int) {
	s.meta = repository.QueryMeta[Filter]{
		Filter:     s.Filter, // applied only sanitized by ApplyFilter
		Sort:       s.Sorting,
		Pagination: s.PageMeta(total),
	}
}

func (s Search) Meta() repository.QueryMeta[Filter] {
	return s.meta
}
