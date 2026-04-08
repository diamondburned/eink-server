// Package config handles configuration loading and structures for eink dashboards.
package config

import (
	"fmt"
	"iter"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/goccy/go-yaml"
)

// Duration is a time.Duration that marshals/unmarshals as a string
type Duration time.Duration

// UnmarshalText implements encoding.TextUnmarshaler
func (d *Duration) UnmarshalText(text []byte) error {
	parsed, err := time.ParseDuration(string(text))
	if err != nil {
		return err
	}
	*d = Duration(parsed)
	return nil
}

// MarshalText implements encoding.TextMarshaler
func (d Duration) MarshalText() ([]byte, error) {
	return []byte(time.Duration(d).String()), nil
}

// Config represents the main configuration structure
type Config struct {
	// DataDir is the directory where screenshots and metadata are stored.
	// Defaults to ${TMP}/eink-server/.
	DataDir string `json:"dataDir"`
	// RefreshPeriod is how often dashboards should be refreshed.
	//
	// If a dashboard provides its own RefreshPeriod, then that takes
	// precedence, but it will stil be refreshed on the same schedule as other
	// dashboards to allow for batching. In other words, when a dashboard
	// specifies its own RefreshPeriod, it's still only refreshed as often as
	// the main RefreshPeriod, but it may be skipped on some refresh cycles if
	// its own RefreshPeriod hasn't elapsed yet.
	RefreshPeriod Duration `json:"refreshPeriod,omitzero"`
	// DefaultWebhookTimeout is the default timeout for webhook requests if not
	// specified in the individual webhook configuration.
	DefaultWebhookTimeout Duration `json:"defaultWebhookTimeout"`
	// ExtraChromiumFlags is a list of extra command-line flags to pass to the
	// Chromium browser instance. Use with care!
	ExtraChromiumFlags []string `json:"extraChromiumFlags,omitzero"`
	// NoParallel forces each dashboard to be refreshed sequentially rather than
	// in parallel. This can be useful to reduce resource usage.
	NoParallel bool `json:"noParallel"`
	// Dsahboards is a list of dashboard configurations to manage.
	Dashboards []Dashboard `json:"dashboards"`
	// WebServer is the configuration for the HTTP server that serves the
	// dashboard screenshots.
	WebServer WebServer `json:"webServer,omitzero"`

	dashboardMap map[string]*Dashboard // internal map for quick lookup by ID
}

// WebServer represents the configuration for the HTTP server.
type WebServer struct {
	ListenAddress string `json:"listenAddress"`
}

// HTTPMethod represents an HTTP method for webhooks
type HTTPMethod string

const (
	HTTPGET  HTTPMethod = http.MethodGet
	HTTPPOST HTTPMethod = http.MethodPost
)

// Postprocessing represents screenshot post-processing options
type Postprocessing struct {
	// Dithering is an optional dithering configuration to apply to the screenshot
	// for reduced color palettes. If not set, no dithering is applied and the
	// screenshot is preserved as-is.
	Dithering Dithering `json:"dithering,omitzero"`
}

// Dithering represents dithering algorithm configuration for reduced color palettes
type Dithering struct {
	Colors    int                `json:"colors,omitzero"`    // Number of grayscale levels (2 for black/white, 4 for 4-level grayscale, etc.)
	Inverted  bool               `json:"inverted,omitempty"` // Whether to invert the colors (e.g., for e-ink displays with white foreground and black background)
	Algorithm DitheringAlgorithm `json:"algorithm,omitzero"` // Dithering algorithm (floyd-steinberg, none)
}

// DitheringAlgorithm represents a dithering algorithm
type DitheringAlgorithm string

const (
	DitheringAlgorithmFloydSteinberg DitheringAlgorithm = "floyd-steinberg"
	DitheringAlgorithmNone           DitheringAlgorithm = "none"
)

// ImageFormat represents the output image format
type ImageFormat string

const (
	ImageFormatPNG ImageFormat = "png"
	ImageFormatBMP ImageFormat = "bmp"
)

// FileExtension returns the image format as a file extension (e.g., ".png" or
// ".bmp").
func (f ImageFormat) FileExtension() string {
	return "." + string(f)
}

// ContentType returns the MIME content type for the image format (e.g.,
// "image/png" or "image/bmp").
func (f ImageFormat) ContentType() string {
	return "image/" + string(f)
}

// Metadata represents the metadata stored alongside screenshots
type Metadata struct {
	DashboardID    string    `json:"id"`
	RefreshedAt    time.Time `json:"refreshedAt"`
	ScreenshotPath string    `json:"screenshotPath,omitzero"`
}

// IsSuccess checks if the metadata indicates a successful screenshot capture
// (i.e. a non-empty screenshot path).
func (m *Metadata) IsSuccess() bool {
	return m.ScreenshotPath != ""
}

// IsStale checks if the metadata is stale based on the current time and the
// configured refresh time.
func (m *Metadata) IsStale(now time.Time, refreshTime time.Duration) bool {
	return now.Sub(m.RefreshedAt) > refreshTime
}

// Load reads the JSON configuration from the specified path
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	cfg := Config{
		DataDir:               filepath.Join(os.TempDir(), "eink-server"),
		DefaultRefreshTime:    Duration(time.Minute), // most granular
		DefaultWebhookTimeout: Duration(10 * time.Second),
	}

	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	for i, dashboard := range cfg.Dashboards {
		if dashboard.RefreshTime == 0 {
			cfg.Dashboards[i].RefreshTime = cfg.DefaultRefreshTime
		}
	}

	cfg.dashboardMap = make(map[string]*Dashboard, len(cfg.Dashboards))
	for i, dashboard := range cfg.Dashboards {
		cfg.dashboardMap[dashboard.ID] = &cfg.Dashboards[i]
	}

	// Create data directory if it doesn't exist
	if err := os.MkdirAll(cfg.DataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	return &cfg, nil
}

// DashboardByID returns the dashboard configuration for the given ID, or false if
// not found.
func (c *Config) DashboardByID(id string) (*Dashboard, bool) {
	dashboard, ok := c.dashboardMap[id]
	return dashboard, ok
}

// DashboardIDs returns a slice of all dashboard IDs in the configuration,
// ordered as they appear in the config file.
func (c *Config) DashboardIDs() iter.Seq[string] {
	return func(yield func(string) bool) {
		for _, dashboard := range c.Dashboards {
			if !yield(dashboard.ID) {
				return
			}
		}
	}
}

// readFileValue reads the contents of a file and returns it as a trimmed
// string.
func readFileValue(filePath string) (string, error) {
	b, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read value from file %q: %w", filePath, err)
	}
	return strings.TrimSpace(string(b)), nil
}
