package http

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"testing"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newQueryBindApp mirrors how the app wires the error handler, then binds a
// pagination query the same way user_handler and audit_handler do. A binding
// failure therefore travels the real path: handler -> ErrorHandler ->
// ParseError.
func newQueryBindApp() *fiber.App {
	type paginationQuery struct {
		Page  int `query:"page"`
		Limit int `query:"limit"`
	}

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c fiber.Ctx, err error) error {
			e := ParseError(err)
			return c.Status(e.Status()).JSON(map[string]any{"error": e})
		},
	})

	app.Get("/", func(c fiber.Ctx) error {
		var q paginationQuery
		if err := c.Bind().Query(&q); err != nil {
			return err
		}

		return c.Status(fiber.StatusOK).JSON(map[string]int{"page": q.Page, "limit": q.Limit})
	})

	return app
}

type errorEnvelope struct {
	Error struct {
		Message string                `json:"message"`
		Code    string                `json:"code"`
		Details []QueryParamErrorItem `json:"details"`
	} `json:"error"`
}

func getQuery(t *testing.T, app *fiber.App, rawQuery string) (int, errorEnvelope) {
	t.Helper()

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/"+rawQuery, nil)
	require.NoError(t, err)

	resp, err := app.Test(req)
	require.NoError(t, err)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())

	var env errorEnvelope
	require.NoError(t, json.Unmarshal(body, &env))

	return resp.StatusCode, env
}

func TestQueryBindFailureReturnsClientError(t *testing.T) {
	app := newQueryBindApp()

	tests := []struct {
		name       string
		query      string
		wantStatus int
		wantCode   string
		wantParams []string
	}{
		{
			name:       "non-numeric page is a 400, not a 500",
			query:      "?page=abc",
			wantStatus: http.StatusBadRequest,
			wantCode:   "INVALID_QUERY_PARAMETERS",
			wantParams: []string{"page"},
		},
		{
			name:       "every offending parameter is listed, sorted",
			query:      "?page=abc&limit=xyz",
			wantStatus: http.StatusBadRequest,
			wantCode:   "INVALID_QUERY_PARAMETERS",
			wantParams: []string{"limit", "page"},
		},
		{
			name:       "valid values bind normally",
			query:      "?page=2&limit=10",
			wantStatus: http.StatusOK,
		},
		{
			name:       "an empty value keeps the zero value",
			query:      "?page=",
			wantStatus: http.StatusOK,
		},
		{
			name:       "unknown parameters stay ignored",
			query:      "?page=1&nope=1",
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, env := getQuery(t, app, tt.query)

			require.Equal(t, tt.wantStatus, status)

			if tt.wantStatus == http.StatusOK {
				assert.Empty(t, env.Error.Code)
				return
			}

			assert.Equal(t, tt.wantCode, env.Error.Code)
			assert.Equal(t, "invalid query parameters", env.Error.Message)

			params := make([]string, 0, len(env.Error.Details))
			for _, d := range env.Error.Details {
				params = append(params, d.Key)
				assert.Equal(t, "must be a valid int", d.Message)
			}

			assert.Equal(t, tt.wantParams, params)
		})
	}

	// MultiError is a map, so without sorting the order would vary per request.
	t.Run("the reported order is stable across requests", func(t *testing.T) {
		for range 20 {
			_, env := getQuery(t, app, "?limit=xyz&page=abc")

			require.Len(t, env.Error.Details, 2)
			assert.Equal(t, "limit", env.Error.Details[0].Key)
			assert.Equal(t, "page", env.Error.Details[1].Key)
		}
	})
}

// A body binding failure is raised as the same *fiber.BindError type, so the
// source check is what keeps it out of the query error. Body errors are
// already translated upstream by parseJSONBindErr in body.go.
func TestParseErrorKeepsBodyBindFailuresOutOfQueryErrors(t *testing.T) {
	err := &fiber.BindError{
		Source: fiber.BindSourceBody,
		Field:  "name",
		Err:    errors.New("boom"),
	}

	assert.NotEqual(t, "INVALID_QUERY_PARAMETERS", ParseError(err).Code)
}

func TestParseErrorKeepsTheInternalDefault(t *testing.T) {
	t.Run("an unrecognised error is still a 500", func(t *testing.T) {
		e := ParseError(errors.New("boom"))

		assert.Equal(t, http.StatusInternalServerError, e.Status())
		assert.Equal(t, "INTERNAL", e.Code)
	})
}
