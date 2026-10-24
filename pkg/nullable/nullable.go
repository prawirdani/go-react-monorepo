package nullable

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// Nullable represents an optional value of type T.
// Valid indicates whether Val is not null.
type Nullable[T comparable] struct {
	val   T
	valid bool
}

// New returns a Nullable wrapping the given value.
// If value is the zero value of T and allowZero is false,
// the Nullable will be invalid. Otherwise, it will be valid.
func New[T comparable](value T, allowZero bool) Nullable[T] {
	var zero T
	if value == zero {
		return Nullable[T]{val: zero, valid: allowZero}
	}
	return Nullable[T]{val: value, valid: true}
}

// NotNull reports whether the Nullable holds a valid value.
func (n Nullable[T]) NotNull() bool {
	return n.valid
}

// Scan implements the [sql.Scanner] interface, called when scanning a row from sql based database.
func (n *Nullable[T]) Scan(value any) error {
	var zero T
	if value == nil {
		n.val = zero
		n.valid = false
		return nil
	}

	// Let T handle scanning if it knows how.
	if scanner, ok := any(&n.val).(sql.Scanner); ok {
		if err := scanner.Scan(value); err != nil {
			return err
		}
		n.valid = true
		return nil
	}

	// Otherwise try unmarshaling using json.
	v, ok := value.(T)
	if !ok {
		if v, ok := value.(string); ok {
			if err := json.Unmarshal([]byte(v), &n.val); err != nil {
				return err
			}
			n.valid = true
			return nil
		}
		return fmt.Errorf("cannot convert %T to %T", value, v)
	}

	n.val = v
	n.valid = true
	return nil
}

// Scan implements the [sql.Scanner] interface, called when scanning a row from sql based database.
// func (n *Nullable[T]) Scan(value any) error {
// 	var zero T
// 	if value == nil {
// 		n.val, n.valid = zero, false
// 		return nil
// 	}
//
// 	v, ok := value.(T)
// 	if !ok {
// 		// Try marshaling
// 		if v, ok := value.(string); ok {
// 			if err := json.Unmarshal([]byte(v), &n.val); err != nil {
// 				return err
// 			}
// 			if n.val != zero {
// 				n.valid = true
// 			}
// 			return nil
// 		}
// 		return fmt.Errorf("cannot convert %T to %T", value, v)
// 	}
//
// 	n.val = v
// 	n.valid = true
// 	return nil
// }

// MarshalJSON implements the [json.Marshaler] interface, called when marshaling to JSON.
func (n Nullable[T]) MarshalJSON() ([]byte, error) {
	if !n.valid {
		return []byte("null"), nil
	}

	return json.Marshal(n.val)
}

// UnmarshalJSON implements the [json.Unmarshaler] interface, called when unmarshaling from JSON.
func (n *Nullable[T]) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		n.valid = false
		return nil
	}

	var v T
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}

	n.val = v
	n.valid = true
	return nil
}

// Value implements [driver.Valuer]. It is called automatically when the value
// is written to the database (e.g., via Exec or Query arguments).
//
// This allows passing Nullable directly to database operations without an
// explicit getter.
//
// Do not use this method for value comparisons or assertions - use Get() to
// retrieve the underlying value instead.
func (n Nullable[T]) Value() (driver.Value, error) {
	if !n.valid {
		return nil, nil
	}
	return n.val, nil
}

// Get returns the wrapped value if valid, or the zero value of T otherwise.
func (n Nullable[T]) Get() T {
	return n.val
}

// Set sets the value of the nullable, if value is zero value of T and allowZero is false it will set the nullable to
// invalid.
func (n *Nullable[T]) Set(value T, allowZero bool) {
	var zero T
	if value == zero {
		n.valid = allowZero
		n.val = zero
		return
	}

	n.val = value
	n.valid = true
}
