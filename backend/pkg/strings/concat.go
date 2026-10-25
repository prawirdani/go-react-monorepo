package strings

import "strings"

func Concatenate(strs ...string) string {
	sLen := len(strs)

	total := 0
	for i := 0; i < sLen; i++ {
		total += len(strs[i])
	}

	sb := strings.Builder{}
	sb.Grow(total)
	for _, v := range strs {
		_, _ = sb.WriteString(v)
	}
	return sb.String()
}
