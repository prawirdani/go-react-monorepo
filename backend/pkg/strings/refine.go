package strings

func Refine(s string, funcs ...func(string) string) string {
	for _, f := range funcs {
		s = f(s)
	}
	return s
}
