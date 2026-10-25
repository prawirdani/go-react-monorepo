package user

import (
	"github.com/prawirdani/go-react-monorepo/pkg/strings"
)

type UpdateUserInput struct {
	Name   string `json:"name"   validate:"required,max=100"`
	Phone  string `json:"phone"  validate:"max=30"`
	Gender string `json:"gender" validate:"omitempty,oneof=m M f F o O"`
}

// Sanitize implements [validator.Sanitizer]
func (i *UpdateUserInput) Sanitize() error {
	i.Name = strings.TrimSpacesConcat(i.Name)
	i.Phone = strings.TrimSpaces(i.Phone)
	i.Gender = strings.TrimSpaces(i.Gender)
	return nil
}
