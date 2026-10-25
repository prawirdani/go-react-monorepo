package validator

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type validStruct struct {
	Name  string `json:"name"  validate:"required"`
	Email string `json:"email" validate:"required,email"`
}

type invalidStruct struct {
	Name  string `json:"name"  validate:"required"`
	Email string `json:"email" validate:"required,email"`
}

func TestStruct(t *testing.T) {
	t.Run("Valid struct", func(t *testing.T) {
		s := validStruct{Name: "John", Email: "john@example.com"}
		assert.NoError(t, Struct(s))
	})

	t.Run("Invalid struct returns ValidationError", func(t *testing.T) {
		s := invalidStruct{Name: "", Email: "not-email"}
		err := Struct(s)
		require.Error(t, err)

		var vErr *ValidationError
		require.ErrorAs(t, err, &vErr)
		assert.True(t, vErr.HasField("name"))
		assert.True(t, vErr.HasField("email"))
	})

	t.Run("Single field invalid", func(t *testing.T) {
		s := validStruct{Name: "John", Email: "not-email"}
		err := Struct(s)
		require.Error(t, err)

		var vErr *ValidationError
		require.ErrorAs(t, err, &vErr)
		assert.False(t, vErr.HasField("name"))
		assert.True(t, vErr.HasField("email"))
	})
}

type sanitizerImpl struct {
	trimmed string
}

func (s *sanitizerImpl) Sanitize() error {
	s.trimmed = "sanitized"
	return nil
}

type sanitizerError struct{}

func (s *sanitizerError) Sanitize() error {
	return assert.AnError
}

type validatorImpl struct {
	isValid bool
}

func (vi *validatorImpl) Validate() error {
	if !vi.isValid {
		return assert.AnError
	}
	return nil
}

func TestValidate_Sanitizer(t *testing.T) {
	t.Run("Sanitize is called", func(t *testing.T) {
		s := &sanitizerImpl{}
		_ = Validate(s)
		assert.Equal(t, "sanitized", s.trimmed)
	})

	t.Run("Sanitize error is returned early", func(t *testing.T) {
		s := &sanitizerError{}
		err := Validate(s)
		assert.ErrorIs(t, err, assert.AnError)
	})
}

func TestValidate_Validator(t *testing.T) {
	t.Run("Valid returns nil", func(t *testing.T) {
		v := &validatorImpl{isValid: true}
		assert.NoError(t, Validate(v))
	})

	t.Run("Invalid returns error", func(t *testing.T) {
		v := &validatorImpl{isValid: false}
		err := Validate(v)
		assert.ErrorIs(t, err, assert.AnError)
	})
}

func TestValidate_Fallback(t *testing.T) {
	t.Run("Valid struct via fallback", func(t *testing.T) {
		s := validStruct{Name: "John", Email: "john@example.com"}
		assert.NoError(t, Validate(s))
	})

	t.Run("Invalid struct via fallback", func(t *testing.T) {
		s := validStruct{Name: "", Email: ""}
		err := Validate(s)
		require.Error(t, err)

		var vErr *ValidationError
		require.ErrorAs(t, err, &vErr)
		assert.True(t, vErr.HasField("name"))
	})
}

func TestValidationError_Error(t *testing.T) {
	t.Run("Empty errors returns default message", func(t *testing.T) {
		vErr := &ValidationError{}
		assert.Equal(t, "validation failed", vErr.Error())
	})

	t.Run("With errors returns formatted string", func(t *testing.T) {
		vErr := &ValidationError{
			Errors: []FieldError{
				{Field: "name", Tag: "required", Message: "this field is required"},
				{Field: "email", Tag: "email", Message: "must be a valid email address"},
			},
			Details: map[string][]string{
				"name":  {"this field is required"},
				"email": {"must be a valid email address"},
			},
		}
		errStr := vErr.Error()
		assert.Contains(t, errStr, "name: this field is required")
		assert.Contains(t, errStr, "email: must be a valid email address")
	})
}

func TestValidationError_Merge(t *testing.T) {
	t.Run("Merge into nil details", func(t *testing.T) {
		vErr := &ValidationError{}
		other := &ValidationError{
			Errors:  []FieldError{{Field: "name", Tag: "required", Message: "required"}},
			Details: map[string][]string{"name": {"this field is required"}},
		}
		vErr.Merge(other)
		assert.Len(t, vErr.Errors, 1)
		assert.True(t, vErr.HasField("name"))
	})

	t.Run("Merge adds to existing details", func(t *testing.T) {
		vErr := &ValidationError{
			Details: map[string][]string{"name": {"existing"}},
		}
		other := &ValidationError{
			Errors:  []FieldError{{Field: "name", Tag: "min", Message: "too short"}},
			Details: map[string][]string{"name": {"too short"}},
		}
		vErr.Merge(other)
		assert.Len(t, vErr.Details["name"], 2)
	})

	t.Run("Merge nil is no-op", func(t *testing.T) {
		vErr := &ValidationError{
			Details: map[string][]string{"name": {"existing"}},
		}
		vErr.Merge(nil)
		assert.Len(t, vErr.Details["name"], 1)
	})

	t.Run("Merge empty is no-op", func(t *testing.T) {
		vErr := &ValidationError{
			Details: map[string][]string{"name": {"existing"}},
		}
		vErr.Merge(&ValidationError{})
		assert.Len(t, vErr.Details["name"], 1)
	})

	t.Run("Merge multiple fields", func(t *testing.T) {
		base := &ValidationError{
			Details: map[string][]string{"name": {"required"}},
		}
		other := &ValidationError{
			Errors: []FieldError{
				{Field: "email", Tag: "email", Message: "invalid"},
				{Field: "age", Tag: "gte", Message: "too small"},
			},
			Details: map[string][]string{
				"email": {"invalid email"},
				"age":   {"must be at least 18"},
			},
		}
		base.Merge(other)
		assert.True(t, base.HasField("name"))
		assert.True(t, base.HasField("email"))
		assert.True(t, base.HasField("age"))
		assert.Len(t, base.Errors, 2)
	})
}

func TestValidationError_HasField(t *testing.T) {
	vErr := &ValidationError{
		Details: map[string][]string{
			"name":  {"this field is required"},
			"email": {"must be a valid email address"},
		},
	}

	assert.True(t, vErr.HasField("name"))
	assert.True(t, vErr.HasField("email"))
	assert.False(t, vErr.HasField("password"))
}

func TestValidationError_GetField(t *testing.T) {
	vErr := &ValidationError{
		Details: map[string][]string{
			"password": {"this field is required", "must be at least 8 characters long"},
		},
	}

	msgs := vErr.GetField("password")
	assert.Len(t, msgs, 2)
	assert.Equal(t, "this field is required", msgs[0])

	empty := vErr.GetField("nonexistent")
	assert.Nil(t, empty)
}

func TestValidationError_JSON(t *testing.T) {
	vErr := &ValidationError{
		Details: map[string][]string{
			"name": {"this field is required"},
		},
	}

	data, err := vErr.JSON()
	require.NoError(t, err)
	assert.Contains(t, string(data), "this field is required")
	assert.Contains(t, string(data), "name")
}

func TestValidationError_Fields(t *testing.T) {
	vErr := &ValidationError{
		Details: map[string][]string{
			"name":  {"this field is required"},
			"email": {"must be a valid email address"},
		},
	}

	fields := vErr.Fields()
	assert.Len(t, fields, 2)
	assert.Contains(t, fields, "name")
	assert.Contains(t, fields, "email")
}

func TestFieldError(t *testing.T) {
	fe := FieldError{
		Field:   "email",
		Tag:     "email",
		Message: "must be a valid email address",
		Value:   "not-email",
	}

	assert.Equal(t, "email", fe.Field)
	assert.Equal(t, "email", fe.Tag)
	assert.Equal(t, "must be a valid email address", fe.Message)
	assert.Equal(t, "not-email", fe.Value)
}

func TestConvertError(t *testing.T) {
	t.Run("Valid struct produces no error", func(t *testing.T) {
		s := validStruct{Name: "John", Email: "john@example.com"}
		err := Struct(s)
		assert.NoError(t, err)
	})

	t.Run("Invalid struct produces correct field names from json tags", func(t *testing.T) {
		s := validStruct{Name: "", Email: ""}
		err := Struct(s)
		require.Error(t, err)

		var vErr *ValidationError
		require.ErrorAs(t, err, &vErr)
		assert.ElementsMatch(t, []string{"name", "email"}, vErr.Fields())
	})

	t.Run("Single field invalid produces single FieldError", func(t *testing.T) {
		s := struct {
			Email string `json:"email" validate:"required,email"`
		}{}
		err := Struct(s)
		require.Error(t, err)

		var vErr *ValidationError
		require.ErrorAs(t, err, &vErr)
		assert.Len(t, vErr.Errors, 1)
		assert.Equal(t, "email", vErr.Errors[0].Field)
		assert.Equal(t, "required", vErr.Errors[0].Tag)
	})
}
