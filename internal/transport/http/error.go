package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/schema"
	"github.com/prawirdani/go-react-monorepo/internal/apperr"
	"github.com/prawirdani/go-react-monorepo/pkg/validator"
)

var (
	ErrMultipartForm = &Error{
		Message: "invalid multipart form",
		Code:    "MULTIPART_FORM",
		status:  http.StatusBadRequest,
	}

	ErrBodyTooLarge = &Error{
		Message: "request body too large",
		Code:    "BODY_TOO_LARGE",
		status:  http.StatusRequestEntityTooLarge,
	}

	ErrRateLimit = &Error{
		Message: "too many request try again latter",
		Code:    "REQ_RATE_LIMIT",
		status:  http.StatusTooManyRequests,
	}

	ErrReqUnauthorized = &Error{
		Message: "authentication required",
		Code:    "REQ_UNAUTHORIZED",
		status:  http.StatusUnauthorized,
	}

	ErrReqForbidden = &Error{
		Message: "access forbidden",
		Code:    "REQ_FORBIDDEN",
		status:  http.StatusForbidden,
	}

	ErrNotFoundHandler = &Error{
		Message: "the requested resource could not be found",
		Code:    "HANDLER_NOT_FOUND",
		status:  http.StatusNotFound,
	}

	ErrMethodNotAllowedHandler = &Error{
		Message: "the method is not allowed for the requested url",
		Code:    "HANDLER_METHOD_NOT_ALLOWED",
		status:  http.StatusMethodNotAllowed,
	}
)

type Error struct {
	Message string `json:"message"`
	Details any    `json:"details"`
	Code    string `json:"code"`
	status  int    `json:"-"`
}

// Error implements the error interface.
func (e *Error) Error() string {
	return e.Message
}

// Status returns the HTTP status code.
func (e *Error) Status() int {
	return e.status
}

// SetMessage returns a copy with Message replaced.
func (e *Error) SetMessage(message string) *Error {
	c := *e
	c.Message = message
	return &c
}

// SetDetails returns a copy with Details replaced.
func (e *Error) SetDetails(details any) *Error {
	c := *e
	c.Details = details
	return &c
}

type QueryParamErrorItem struct {
	Key     string `json:"key"`
	Message string `json:"message"`
}

func QueryParamErr(items []QueryParamErrorItem) *Error {
	return &Error{
		Message: "invalid query parameters",
		Code:    "INVALID_QUERY_PARAMETERS",
		Details: items,
		status:  http.StatusBadRequest,
	}
}

func ErrInvalidParam(name string, value string) *Error {
	return &Error{
		Message: fmt.Sprintf("invalid value '%v' for parameter '%s'", value, name),
		Code:    "INVALID_PARAMETER",
		Details: map[string]any{
			"parameter": name,
			"value":     value,
		},
		status: http.StatusBadRequest,
	}
}

func ParseError(err error) *Error {
	// Already normalized
	if e, ok := errors.AsType[*Error](err); ok {
		return e
	}

	body := &Error{
		status:  http.StatusInternalServerError,
		Message: "an unexpected error occurred, try again later",
		Code:    "INTERNAL",
	}

	var (
		fiberErr      *fiber.Error
		bindErr       *fiber.BindError
		jsonBindErr   *jsonBindError
		validationErr *validator.ValidationError
		appErr        *apperr.Error
	)

	switch {
	case errors.Is(err, context.DeadlineExceeded):
		body.status = http.StatusGatewayTimeout
		body.Message = "the server took too long to respond"
		body.Code = "SERVER_TIMEOUT"
		return body

	case errors.Is(err, context.Canceled):
		body.status = 499 // Client Closed Request
		return body

	case errors.As(err, &fiberErr):
		if fiberErr.Code == fiber.StatusRequestEntityTooLarge {
			return ErrBodyTooLarge.SetDetails(map[string]int{"max_bytes": int(MaxBodySize)})
		}
		return body

	case errors.As(err, &bindErr) && bindErr.Source == fiber.BindSourceQuery:
		// A malformed query string is bad client input, not a server fault.
		// Fiber returns *BindError in manual mode, and before this case the
		// whole class fell through to the 500 default below: only
		// *jsonBindError and validator.ValidationError were recognised. The
		// source check matters — body binding fails the same way, and its
		// errors must not surface as invalid query parameters.
		return QueryParamErr(queryParamErrorItems(bindErr))

	case errors.As(err, &jsonBindErr):
		body.status = http.StatusBadRequest
		body.Message = jsonBindErr.Message
		body.Code = "REQ_MALFORMED_JSON"
	case errors.As(err, &validationErr):
		body.status = http.StatusUnprocessableEntity
		body.Message = "the request contains invalid data"
		body.Details = validationErr.Details
		body.Code = "VALIDATION"
	case errors.As(err, &appErr):
		body.status = appErrStatusCode(appErr.Kind())
		body.Message = appErr.Message
		body.Details = appErr.Details
		body.Code = appErr.Code()
	}

	return body
}

// queryParamErrorItems flattens a query binding failure into one item per
// parameter. The decoder reports every failing parameter at once in a
// [schema.MultiError]; a lone failure arrives unwrapped, so both shapes are
// handled.
//
// Items are sorted because MultiError is a map and its iteration order is
// random — without sorting the response array would vary between identical
// requests.
func queryParamErrorItems(bindErr *fiber.BindError) []QueryParamErrorItem {
	var multiErr schema.MultiError

	if !errors.As(bindErr.Err, &multiErr) || len(multiErr) == 0 {
		return []QueryParamErrorItem{queryParamErrorItem(bindErr.Field, bindErr.Err)}
	}

	items := make([]QueryParamErrorItem, 0, len(multiErr))
	for param, err := range multiErr {
		items = append(items, queryParamErrorItem(param, err))
	}

	slices.SortFunc(items, func(a, b QueryParamErrorItem) int {
		return strings.Compare(a.Key, b.Key)
	})

	return items
}

func queryParamErrorItem(param string, err error) QueryParamErrorItem {
	item := QueryParamErrorItem{Key: param, Message: err.Error()}

	if convErr, ok := errors.AsType[schema.ConversionError](err); ok {
		item.Message = fmt.Sprintf("must be a valid %s", convErr.Type)
	}

	return item
}

type jsonBindError struct {
	Message string
}

func (e *jsonBindError) Error() string {
	return e.Message
}

func parseJSONBindErr(err error) error {
	var syntaxError *json.SyntaxError
	var unmarshalTypeError *json.UnmarshalTypeError

	var msg string

	switch {
	case errors.As(err, &syntaxError):
		msg = fmt.Sprintf(
			"Request body contains badly-formed JSON (at position %d)",
			syntaxError.Offset,
		)

	case errors.Is(err, io.ErrUnexpectedEOF):
		msg = "Request body contains badly-formed JSON"

	case errors.As(err, &unmarshalTypeError):
		msg = fmt.Sprintf(
			"Request body contains an invalid value for the %q field (at position %d)",
			unmarshalTypeError.Field,
			unmarshalTypeError.Offset,
		)

	case strings.HasPrefix(err.Error(), "json: unknown field "):
		fieldName := strings.TrimPrefix(err.Error(), "json: unknown field ")
		msg = fmt.Sprintf("Request body contains unknown field %s", fieldName)

	case errors.Is(err, io.EOF):
		msg = "Request body must not be empty"

	default:
		return err
	}

	return &jsonBindError{Message: msg}
}

var appErrStatusMap = map[apperr.Kind]int{
	apperr.KindNotFound:     http.StatusNotFound,
	apperr.KindValidation:   http.StatusUnprocessableEntity,
	apperr.KindConflict:     http.StatusConflict,
	apperr.KindForbidden:    http.StatusForbidden,
	apperr.KindUnauthorized: http.StatusUnauthorized,
	apperr.KindThrottled:    http.StatusTooManyRequests,
}

func appErrStatusCode(kind apperr.Kind) int {
	if status, ok := appErrStatusMap[kind]; ok {
		return status
	}
	return http.StatusInternalServerError
}
