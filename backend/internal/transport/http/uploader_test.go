package http

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newUploadFileHeader builds a real *multipart.FileHeader by writing a
// multipart body in memory and parsing it back through the standard library,
// so the fixture exercises the same path a live request takes.
func newUploadFileHeader(t *testing.T, filename, claimedType string, content []byte) *multipart.FileHeader {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	header := make(textproto.MIMEHeader)
	header.Set(
		"Content-Disposition",
		fmt.Sprintf(`form-data; name="file"; filename=%q`, filename),
	)
	header.Set("Content-Type", claimedType)

	part, err := writer.CreatePart(header)
	require.NoError(t, err)
	_, err = part.Write(content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	req := httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	require.NoError(t, req.ParseMultipartForm(1<<20))
	t.Cleanup(func() { _ = req.MultipartForm.RemoveAll() })

	files := req.MultipartForm.File["file"]
	require.Len(t, files, 1)

	return files[0]
}

// minimalPNG encodes a genuine 1x1 PNG, so MIME sniffing sees a real image.
func minimalPNG(t *testing.T) []byte {
	t.Helper()

	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 1, 1))))

	return buf.Bytes()
}

func uploadRules(maxSize int64) ValidationRules {
	return ValidationRules{
		MaxSize:      maxSize,
		AllowedMIMEs: ImageMIMEs,
	}
}

// requireUploadError asserts the error is an *Error with the given code, which
// is what the HTTP error handler maps to a response.
func requireUploadError(t *testing.T, err error, code string) {
	t.Helper()

	require.Error(t, err)

	var uploadErr *Error
	require.ErrorAs(t, err, &uploadErr)
	assert.Equal(t, code, uploadErr.Code)
	assert.Equal(t, http.StatusBadRequest, uploadErr.Status())
}

func TestValidateFile(t *testing.T) {
	pngBytes := minimalPNG(t)
	limit := int64(1 << 20)

	tests := []struct {
		name        string
		filename    string
		claimedType string
		content     []byte
		maxSize     int64
		wantCode    string
		wantErrLike string
	}{
		{
			name:        "genuine png under limits passes",
			filename:    "avatar.png",
			claimedType: "image/png",
			content:     pngBytes,
			maxSize:     limit,
		},
		{
			name:        "size over max",
			filename:    "avatar.png",
			claimedType: "image/png",
			content:     pngBytes,
			maxSize:     int64(len(pngBytes)) - 1,
			wantCode:    "UPLOAD_MAX_SIZE",
		},
		{
			name:        "claimed png with text content is a mime mismatch",
			filename:    "avatar.png",
			claimedType: "image/png",
			content:     []byte("definitely not a png"),
			maxSize:     limit,
			wantCode:    "UPLOAD_INVALID",
		},
		{
			name:        "png bytes with jpg extension fails",
			filename:    "avatar.jpg",
			claimedType: "image/png",
			content:     pngBytes,
			maxSize:     limit,
			wantErrLike: "does not match detected MIME type",
		},
		{
			name:        "disallowed actual type",
			filename:    "notes.txt",
			claimedType: "text/plain",
			content:     []byte("plain text"),
			maxSize:     limit,
			wantCode:    "UPLOAD_MIME_TYPES",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			header := newUploadFileHeader(t, tt.filename, tt.claimedType, tt.content)

			err := ValidateFile(context.Background(), NewParsedFile(header), uploadRules(tt.maxSize))

			switch {
			case tt.wantCode != "":
				requireUploadError(t, err, tt.wantCode)
			case tt.wantErrLike != "":
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErrLike)
			default:
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateFileNoFile(t *testing.T) {
	err := ValidateFile(context.Background(), NewParsedFile(nil), uploadRules(1<<20))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "no file provided")
}

func TestValidateFileNil(t *testing.T) {
	err := ValidateFile(context.Background(), nil, uploadRules(1<<20))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "no file provided")
}
