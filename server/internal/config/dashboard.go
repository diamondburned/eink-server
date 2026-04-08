package config

import (
	"fmt"
	"net/url"
)

// Dashboard represents a single dashboard configuration
type Dashboard struct {
	// ID is a unique identifier for the dashboard, used in the URL and
	// filenames.
	ID string `json:"id"`
	// ScreenWidth is the width of the browser viewport to use when capturing
	// the dashboard screenshot, in pixels. Keep this the same as the physical
	// width of your e-ink display.
	ScreenWidth int `json:"width"`
	// ScreenHeight is the height of the browser viewport to use when capturing
	// the dashboard screenshot, in pixels. Keep this the same as the physical
	// height of your e-ink display.
	ScreenHeight int `json:"height"`
	// URL is the URL of the dashboard to capture.
	URL string `json:"url"`
	// RefreshTime is the duration after which the dashboard should be considered
	// stale and recaptured. Note that checking is done at a fixed interval of
	// every minute, so this duration should only be as low as one minute.
	RefreshTime Duration `json:"refreshTime,omitzero"`
	// Headers is a map of key-value pairs to include as HTTP headers in the request
	// to capture the dashboard.
	Headers map[string]string `json:"headers,omitzero"`
	// HeadersFromFile is similar to [Headers], except the values are file paths
	// to read the header values from. All trailing whitespace are trimmed.
	HeadersFromFile map[string]string `json:"headersFromFile,omitzero"`
	// URLParams is a map of key-value pairs to include as URL parameters in the
	// request to capture the dashboard.
	URLParams map[string]string `json:"urlParams,omitzero"`
	// URLParamsFromFile is similar to [URLParams], except the values are file
	// paths to read the parameter values from. All trailing whitespace are
	// trimmed.
	URLParamsFromFile map[string]string `json:"urlParamsFromFile,omitzero"`
	// Webhooks is a list of webhooks to call after successfully capturing the
	// dashboard. See [Webhook] for details on how they work.
	Webhooks []Webhook `json:"webhooks,omitzero"`
	// WebhookSequential indicates whether to execute webhooks sequentially
	// (waiting for each to complete before starting the next) or in parallel.
	WebhookSequential bool `json:"webhookSequential,omitempty"`
	// CSSFilter is an optional CSS filter string to apply to the screenshot for
	// visual effects, e.g. "blur(5px) brightness(0.4)".
	CSSFilter string `json:"cssFilter,omitzero"`
	// CSSExtras is an optional string of additional CSS to apply to the page
	// before taking the screenshot.
	CSSExtras string `json:"cssExtras,omitzero"`
	// Postprocessing specifies any post-processing to apply to the screenshot after
	// it is captured.
	Postprocessing Postprocessing `json:"postprocessing,omitzero"`
	// ImageFormat specifies the image format to use for the dashboard
	// screenshot.
	ImageFormat ImageFormat `json:"imageFormat,omitzero"`
	// ImageScale is an optional integer factor to upscale the viewport by
	// before doing the screenshot, which reduces aliasing.
	ImageScale float64 `json:"imageScale,omitzero"`
	// PageLoadDelay is an optional delay to wait after the page has loaded before
	// taking the screenshot. By default, no delay is applied.
	PageLoadDelay Duration `json:"pageLoadDelay,omitzero"`
	// Password is the password string to require for accessing the dashboard.
	// If set, incoming requests to the dashboard's endpoint must include a
	// "password" form value that matches this string, unless
	// [PasswordIsBearerToken] is true.
	Password string `json:"password,omitzero"`
	// PasswordFile is a file path to read the password string from. If set, the
	// file will be read (trailing whitespace trimmed) instead of the [Password]
	// field.
	PasswordFile string `json:"passwordFile,omitzero"`
	// PasswordIsBearerToken treats the password as a bearer token that must be
	// included in the "Authorization" header of incoming requests, instead of a
	// form value.
	PasswordIsBearerToken bool `json:"passwordIsBearerToken,omitempty"`
}

// BuildURL builds the full URL with query parameters
func (d Dashboard) BuildURL() (*url.URL, error) {
	u, err := url.Parse(d.URL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	if len(d.URLParams) > 0 {
		uQuery := u.Query()
		for k, v := range d.URLParams {
			uQuery.Add(k, v)
		}
		u.RawQuery = uQuery.Encode()
	}

	return u, nil
}

// ScreenshotName returns the filename for the dashboard screenshot.
func (d Dashboard) ScreenshotName() string {
	return d.ID + d.ImageFormat.FileExtension()
}

// ReadPassword reads the password from the configured file if PasswordFile is
// set, otherwise returns the Password field.
func (d Dashboard) ReadPassword() (string, error) {
	if d.PasswordFile != "" {
		v, err := readFileValue(d.PasswordFile)
		if err != nil {
			return "", fmt.Errorf("failed to read password from file: %w", err)
		}
		return v, nil
	}
	return d.Password, nil
}
