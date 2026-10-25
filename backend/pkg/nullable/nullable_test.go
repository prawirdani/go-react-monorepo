package nullable

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNew(t *testing.T) {
	t.Run("Non-zero value", func(t *testing.T) {
		n := New("hello", false)
		assert.True(t, n.NotNull())
		assert.Equal(t, "hello", n.Get())
	})

	t.Run("Zero value with allowZero true", func(t *testing.T) {
		n := New("", true)
		assert.True(t, n.NotNull())
		assert.Equal(t, "", n.Get())
	})

	t.Run("Zero value with allowZero false", func(t *testing.T) {
		n := New("", false)
		assert.False(t, n.NotNull())
		assert.Equal(t, "", n.Get())
	})

	t.Run("Zero int with allowZero false", func(t *testing.T) {
		n := New(0, false)
		assert.False(t, n.NotNull())
		assert.Equal(t, 0, n.Get())
	})

	t.Run("Non-zero int", func(t *testing.T) {
		n := New(42, false)
		assert.True(t, n.NotNull())
		assert.Equal(t, 42, n.Get())
	})
}

func TestNullable_Set(t *testing.T) {
	t.Run("Set non-zero value", func(t *testing.T) {
		n := New("", false)
		n.Set("hello", false)
		assert.True(t, n.NotNull())
		assert.Equal(t, "hello", n.Get())
	})

	t.Run("Set zero value with allowZero true", func(t *testing.T) {
		n := New("hello", false)
		n.Set("", true)
		assert.True(t, n.NotNull())
		assert.Equal(t, "", n.Get())
	})

	t.Run("Set zero value with allowZero false invalidates", func(t *testing.T) {
		n := New("hello", false)
		n.Set("", false)
		assert.False(t, n.NotNull())
	})

	t.Run("Set int to zero invalidates", func(t *testing.T) {
		n := New(42, false)
		n.Set(0, false)
		assert.False(t, n.NotNull())
		assert.Equal(t, 0, n.Get())
	})
}

func TestNullable_MarshalJSON(t *testing.T) {
	t.Run("Valid value", func(t *testing.T) {
		n := New("hello", false)
		data, err := json.Marshal(n)
		require.NoError(t, err)
		assert.Equal(t, `"hello"`, string(data))
	})

	t.Run("Invalid value marshals to null", func(t *testing.T) {
		n := New("", false)
		data, err := json.Marshal(n)
		require.NoError(t, err)
		assert.Equal(t, "null", string(data))
	})

	t.Run("Valid int", func(t *testing.T) {
		n := New(42, false)
		data, err := json.Marshal(n)
		require.NoError(t, err)
		assert.Equal(t, "42", string(data))
	})

	t.Run("Invalid int marshals to null", func(t *testing.T) {
		n := New(0, false)
		data, err := json.Marshal(n)
		require.NoError(t, err)
		assert.Equal(t, "null", string(data))
	})
}

func TestNullable_UnmarshalJSON(t *testing.T) {
	t.Run("Valid string", func(t *testing.T) {
		var n Nullable[string]
		err := json.Unmarshal([]byte(`"hello"`), &n)
		require.NoError(t, err)
		assert.True(t, n.NotNull())
		assert.Equal(t, "hello", n.Get())
	})

	t.Run("Null value", func(t *testing.T) {
		var n Nullable[string]
		err := json.Unmarshal([]byte(`null`), &n)
		require.NoError(t, err)
		assert.False(t, n.NotNull())
	})

	t.Run("Valid int", func(t *testing.T) {
		var n Nullable[int]
		err := json.Unmarshal([]byte(`42`), &n)
		require.NoError(t, err)
		assert.True(t, n.NotNull())
		assert.Equal(t, 42, n.Get())
	})

	t.Run("Invalid JSON", func(t *testing.T) {
		var n Nullable[string]
		err := json.Unmarshal([]byte(`not-json`), &n)
		assert.Error(t, err)
	})

	t.Run("Roundtrip valid", func(t *testing.T) {
		original := New("test", false)
		data, err := json.Marshal(original)
		require.NoError(t, err)

		var decoded Nullable[string]
		err = json.Unmarshal(data, &decoded)
		require.NoError(t, err)
		assert.True(t, decoded.NotNull())
		assert.Equal(t, "test", decoded.Get())
	})

	t.Run("Roundtrip null", func(t *testing.T) {
		original := New("", false)
		data, err := json.Marshal(original)
		require.NoError(t, err)

		var decoded Nullable[string]
		err = json.Unmarshal(data, &decoded)
		require.NoError(t, err)
		assert.False(t, decoded.NotNull())
	})
}

func TestNullable_Scan(t *testing.T) {
	t.Run("Nil value", func(t *testing.T) {
		var n Nullable[string]
		err := n.Scan(nil)
		require.NoError(t, err)
		assert.False(t, n.NotNull())
	})

	t.Run("Direct type match", func(t *testing.T) {
		var n Nullable[string]
		err := n.Scan("hello")
		require.NoError(t, err)
		assert.True(t, n.NotNull())
		assert.Equal(t, "hello", n.Get())
	})

	t.Run("Direct int match", func(t *testing.T) {
		var n Nullable[int]
		err := n.Scan(42)
		require.NoError(t, err)
		assert.True(t, n.NotNull())
		assert.Equal(t, 42, n.Get())
	})

	t.Run("String fallback with JSON", func(t *testing.T) {
		var n Nullable[int]
		err := n.Scan("42")
		require.NoError(t, err)
		assert.True(t, n.NotNull())
		assert.Equal(t, 42, n.Get())
	})

	t.Run("Incompatible type", func(t *testing.T) {
		var n Nullable[int]
		err := n.Scan(struct{}{})
		assert.Error(t, err)
	})

	t.Run("Scan resets previous value", func(t *testing.T) {
		n := New("hello", false)
		err := n.Scan(nil)
		require.NoError(t, err)
		assert.False(t, n.NotNull())
		assert.Equal(t, "", n.Get())
	})
}

func TestNullable_Value(t *testing.T) {
	t.Run("Valid value", func(t *testing.T) {
		n := New("hello", false)
		val, err := n.Value()
		require.NoError(t, err)
		assert.Equal(t, "hello", val)
	})

	t.Run("Invalid value returns nil", func(t *testing.T) {
		n := New("", false)
		val, err := n.Value()
		require.NoError(t, err)
		assert.Nil(t, val)
	})

	t.Run("Valid int", func(t *testing.T) {
		n := New(42, false)
		val, err := n.Value()
		require.NoError(t, err)
		assert.Equal(t, 42, val)
	})

	t.Run("Invalid int returns nil", func(t *testing.T) {
		n := New(0, false)
		val, err := n.Value()
		require.NoError(t, err)
		assert.Nil(t, val)
	})
}
