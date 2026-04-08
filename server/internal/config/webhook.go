package config

import (
	"bytes"
	"context"
	"fmt"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"text/template"

	"github.com/diamondburned/eink-server/internal/networking"
)

// Webhook represents a webhook configuration.
type Webhook struct {
	// Method controls the HTTP method to use for the webhook request.
	// Supported methods are GET and POST.
	//
	// For GET requests, URL parameters will be sent as query parameters.
	// For POST requests, URL parameters will be sent as multipart form fields
	// inside the request's body.
	//
	// All response bodies from the webhook are discarded.
	Method HTTPMethod `json:"method"`
	// URL is the endpoint to call for the webhook.
	URL string `json:"url"`
	// URLIsTemplate indicates whether the URL field should be treated as a Go
	// template string for interpolation. The templated string is delimited by
	// `{` and `}`. The following variables are supported for interpolation:
	//
	// - `resolve "HOSTNAME"`: The IP address obtained by resolving the given `HOSTNAME`.
	// - `env "VAR_NAME"`: Environment variable with the name `VAR_NAME`.
	URLIsTemplate bool `json:"urlIsTemplate,omitempty"`
	// URLParams is a map of key-value pairs to include as URL parameters in the
	// webhook GET request, or as multipart form fields for POST requests.
	URLParams map[string]string `json:"urlParams,omitzero"`
	// URLParamsFromFile is similar to [URLParams], except the values are file
	// paths to read the parameter values from. All trailing whitespace are
	// trimmed.
	URLParamsFromFile map[string]string `json:"urlParamsFromFile,omitzero"`
	// Headers is a map of key-value pairs to include as HTTP headers in the
	// webhook request.
	Headers map[string]string `json:"headers,omitzero"`
	// HeadersFromFile is similar to [Headers], except the values are file paths
	// to read the header values from. All trailing whitespace are trimmed.
	HeadersFromFile map[string]string `json:"headersFromFile,omitzero"`
	// Timeout is an optional timeout for the webhook request. If not set, the
	// default webhook timeout from the main config will be used.
	Timeout Duration `json:"timeout,omitzero"` // Optional timeout for the webhook request
}

// BuildRequest builds an [http.Request] based on the webhook configuration and
// the given context.Context.
func (w Webhook) BuildRequest(ctx context.Context) (*http.Request, error) {
	url := w.URL
	if w.URLIsTemplate {
		funcs := template.FuncMap{
			"resolve": func(hostname string) (string, error) {
				addr, err := networking.ResolveHostname(ctx, hostname)
				if err != nil {
					return "", fmt.Errorf("failed to resolve hostname %q: %w", hostname, err)
				}
				return addr.String(), nil
			},
			"env": func(varName string) string {
				return os.Getenv(varName)
			},
		}

		tmpl, err := template.
			New("webhookURL").
			Delims("{", "}").
			Funcs(funcs).
			Parse(w.URL)
		if err != nil {
			return nil, fmt.Errorf("failed to parse webhook URL template: %w", err)
		}

		var b strings.Builder
		if err := tmpl.Execute(&b, nil); err != nil {
			return nil, fmt.Errorf("failed to execute webhook URL template: %w", err)
		}

		url = b.String()
	}

	var req *http.Request
	var err error

	switch w.Method {
	case http.MethodGet:
		req, err = http.NewRequestWithContext(ctx, string(w.Method), url, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create webhook request: %w", err)
		}

		if len(w.URLParams) > 0 {
			q := req.URL.Query()
			for key, value := range w.URLParams {
				q.Add(key, value)
			}
			req.URL.RawQuery = q.Encode()
		}

		if len(w.URLParamsFromFile) > 0 {
			q := req.URL.Query()
			for key, path := range w.URLParamsFromFile {
				v, err := readFileValue(path)
				if err != nil {
					return nil, fmt.Errorf("failed to read URL param from file %q: %w", path, err)
				}
				q.Add(key, v)
			}
			req.URL.RawQuery = q.Encode()
		}

	case http.MethodPost:
		var body bytes.Buffer
		mw := multipart.NewWriter(&body)

		if len(w.URLParams) > 0 {
			for key, value := range w.URLParams {
				if err := mw.WriteField(key, value); err != nil {
					return nil, fmt.Errorf("failed to write URL param field: %w", err)
				}
			}
		}

		if len(w.URLParamsFromFile) > 0 {
			for key, path := range w.URLParamsFromFile {
				v, err := readFileValue(path)
				if err != nil {
					return nil, fmt.Errorf("failed to read URL param from file %q: %w", path, err)
				}
				if err := mw.WriteField(key, v); err != nil {
					return nil, fmt.Errorf("failed to write URL param field from file: %w", err)
				}
			}
		}

		if err := mw.Close(); err != nil {
			return nil, fmt.Errorf("failed to close multipart writer: %w", err)
		}

		req, err = http.NewRequestWithContext(ctx, string(w.Method), url, &body)
		if err != nil {
			return nil, fmt.Errorf("failed to create webhook request: %w", err)
		}

	default:
		return nil, fmt.Errorf("unsupported HTTP method: %s", w.Method)
	}

	if len(w.Headers) > 0 {
		for key, value := range w.Headers {
			req.Header.Add(key, value)
		}
	}

	if len(w.HeadersFromFile) > 0 {
		for key, path := range w.HeadersFromFile {
			v, err := readFileValue(path)
			if err != nil {
				return nil, fmt.Errorf("failed to read header from file %q: %w", path, err)
			}
			req.Header.Add(key, v)
		}
	}

	return req, nil
}
