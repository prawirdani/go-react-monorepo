package strings

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTitleCase(t *testing.T) {
	tests := []struct {
		title  string
		input  string
		expect string
	}{
		{title: "Single word", input: "hello", expect: "Hello"},
		{title: "Multiple words", input: "hello world", expect: "Hello World"},
		{title: "Already title case", input: "Hello World", expect: "Hello World"},
		{title: "All uppercase", input: "HELLO WORLD", expect: "Hello World"},
		{title: "Mixed case", input: "hElLo WoRLd", expect: "Hello World"},
		{title: "Empty string", input: "", expect: ""},
		{title: "Single char", input: "a", expect: "A"},
	}

	for _, tt := range tests {
		t.Run(tt.title, func(t *testing.T) {
			assert.Equal(t, tt.expect, TitleCase(tt.input))
		})
	}
}

func TestContains(t *testing.T) {
	tests := []struct {
		title  string
		slice  []string
		str    string
		expect bool
	}{
		{title: "Found in middle", slice: []string{"a", "b", "c"}, str: "b", expect: true},
		{title: "Found at start", slice: []string{"a", "b", "c"}, str: "a", expect: true},
		{title: "Found at end", slice: []string{"a", "b", "c"}, str: "c", expect: true},
		{title: "Not found", slice: []string{"a", "b", "c"}, str: "d", expect: false},
		{title: "Empty slice", slice: []string{}, str: "a", expect: false},
		{title: "Nil slice", slice: nil, str: "a", expect: false},
		{title: "Empty string in slice", slice: []string{"", "a"}, str: "", expect: true},
		{title: "Empty string not in slice", slice: []string{"a", "b"}, str: "", expect: false},
	}

	for _, tt := range tests {
		t.Run(tt.title, func(t *testing.T) {
			assert.Equal(t, tt.expect, Contains(tt.slice, tt.str))
		})
	}
}

func TestTrimSpaces(t *testing.T) {
	tests := []struct {
		title  string
		input  string
		expect string
	}{
		{title: "Leading spaces", input: "  hello", expect: "hello"},
		{title: "Trailing spaces", input: "hello  ", expect: "hello"},
		{title: "Both sides", input: "  hello  ", expect: "hello"},
		{title: "No spaces", input: "hello", expect: "hello"},
		{title: "Empty string", input: "", expect: ""},
		{title: "Only spaces", input: "   ", expect: ""},
		{title: "Tabs and newlines", input: "\t\nhello\t\n", expect: "hello"},
	}

	for _, tt := range tests {
		t.Run(tt.title, func(t *testing.T) {
			assert.Equal(t, tt.expect, TrimSpaces(tt.input))
		})
	}
}

func TestTrimSpacesConcat(t *testing.T) {
	tests := []struct {
		title  string
		input  string
		expect string
	}{
		{title: "Multiple spaces between words", input: "hello   world", expect: "hello world"},
		{title: "Leading and trailing spaces", input: "  hello world  ", expect: "hello world"},
		{title: "Single word", input: "hello", expect: "hello"},
		{title: "Multiple words", input: "hello   beautiful   world", expect: "hello beautiful world"},
		{title: "Empty string", input: "", expect: ""},
		{title: "Only spaces", input: "   ", expect: ""},
		{title: "Tabs between words", input: "hello\t\tworld", expect: "hello world"},
	}

	for _, tt := range tests {
		t.Run(tt.title, func(t *testing.T) {
			assert.Equal(t, tt.expect, TrimSpacesConcat(tt.input))
		})
	}
}
