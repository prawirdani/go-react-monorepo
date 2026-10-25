package strings

import "strings"

// TrimSpaces trimming left and right spaces, used for single word string
func TrimSpaces(s string) string {
	return strings.TrimSpace(s)
}

// TrimSpacesConcat trimming left and right spaces and concat all spaces in the middle, used for multiple words string
func TrimSpacesConcat(s string) string {
	return strings.Join(strings.Fields(s), " ")
}
