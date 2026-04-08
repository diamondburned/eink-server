# eink-server

A Go-based server for managing and rendering eink dashboards using Chromium/Puppeteer.

## Features

- **Single Chromium Instance**: Spawns one Chromium instance that is reused for all dashboards
- **Parallel Screenshot Capture**: Refreshes multiple dashboards in parallel for efficiency
- **Configurable Refresh Times**: Set global and per-dashboard refresh intervals
- **Custom Headers & URL Parameters**: Add authentication headers and query parameters per dashboard
- **Webhook Support**: Trigger external endpoints (e.g., force ESPHome displays to refresh)
- **HTTP Server**: Serve screenshots via HTTP with optional authentication
- **Screenshot Post-Processing**:
  - CSS filters (grayscale, brightness, contrast, saturation, invert)
  - Dithering with configurable color depth (2-color black/white, 4-level grayscale, etc.)
- **Metadata Tracking**: Stores load times and timestamps for each dashboard

## Installation

```bash
go build -o eink-server
```

## Configuration

Create a `config.json` file based on the example:

```json
{
  "dataDir": "./data",
  "defaultRefreshTime": "5m",
  "chromiumFlags": [
    "--window-size=800,600"
  ],
  "dashboards": {
    "weather": {
      "url": "https://example.com/weather",
      "refreshTime": "10m",
      "pageLoadDelaySec": 3,
      "headers": {
        "Authorization": "Bearer token"
      },
      "urlParams": {
        "theme": "light"
      },
      "webhooks": [
        {
          "method": "GET",
          "url": "http://esphome-device.local/refresh"
        }
      ],
      "postProcessing": {
        "cssFilter": "grayscale(1) brightness(1.2) contrast(1.3)",
        "dithering": {
          "algorithm": "floyd-steinberg",
          "colors": 4
        }
      }
    }
  }
}
```

### Configuration Options

#### Top Level

- `dataDir`: Directory where screenshots and metadata are stored (default: `"./data"`)
- `defaultRefreshTime`: Default refresh interval for all dashboards (e.g., `"5m"`, `"1h"`)
- `chromiumFlags`: Additional flags to pass to Chromium (optional)
- `dashboards`: Map of dashboard ID to dashboard configuration

#### Dashboard Configuration

- `id`: Dashboard identifier (auto-set from map key)
- `url`: The URL to render
- `refreshTime`: Override default refresh time for this dashboard (optional)
- `pageLoadDelaySec`: Seconds to wait after page load before screenshot (default: 2)
- `headers`: HTTP headers to add to requests (optional)
- `headersFromFile`: Load header values from files (optional)
- `urlParams`: Query parameters to add to the URL (optional)
- `urlParamsFromFile`: Load URL parameter values from files (optional)
- `webhooks`: List of webhooks to trigger before taking screenshot (optional)
- `postProcessing`: Screenshot post-processing configuration (optional)
- `imageFormat`: Output image format - `"png"` or `"bmp"` (default: `"png"`)
- `passwordFile`: Path to file containing password for HTTP access (optional, requires `?password=` query param)
- `authTokenFile`: Path to file containing auth token for HTTP access (optional, requires `Authorization` header)

#### Webhook Configuration

- `method`: HTTP method (`"GET"` or `"POST"`)
- `url`: Webhook endpoint URL
- `headers`: HTTP headers for the webhook request (optional)

#### Post-Processing Configuration

##### CSS Filter

Applied as CSS filters before screenshot. This is a raw CSS filter string that will be applied to the body element.

- `cssFilter`: CSS filter string (e.g., `"grayscale(1) brightness(1.2) contrast(1.3)"`, `"blur(5px) brightness(0.4)"`)

Common CSS filter functions:
- `grayscale(amount)`: 0 to 1 (0 = color, 1 = full grayscale)
- `brightness(amount)`: 0 to 2+ (1 = normal)
- `contrast(amount)`: 0 to 2+ (1 = normal)
- `saturate(amount)`: 0 to 2+ (1 = normal)
- `invert(amount)`: 0 to 1 (0 = normal, 1 = fully inverted)
- `blur(radius)`: e.g., `blur(5px)`
- `hue-rotate(angle)`: e.g., `hue-rotate(90deg)`

##### Dithering

Applied after screenshot using Go's standard `image/draw` package. Reduces the image to a limited grayscale palette:

- `algorithm`: Dithering algorithm (`"floyd-steinberg"` or `"none"`)
- `colors`: Number of grayscale levels (e.g., `2` for black/white, `4` for 4-level grayscale, `16` for 16-level grayscale). Defaults to `2` if not specified.

**Examples:**
- Black and white only: `{"algorithm": "floyd-steinberg", "colors": 2}`
- 4-level grayscale: `{"algorithm": "floyd-steinberg", "colors": 4}`
- 16-level grayscale without dithering: `{"algorithm": "none", "colors": 16}`

##### Image Format

Controls the output image format:

- `imageFormat`: Output format - `"png"` (default) or `"bmp"`

**BMP Format Details:**
- When `imageFormat: "bmp"` is specified, the bit depth is determined automatically:
  - **1-bit (monochrome)**: When dithering with `colors: 2` or unspecified
  - **8-bit indexed**: When dithering with `colors` between 3-256
  - **24-bit RGB**: When no dithering or `colors > 256`
- Without dithering, BMP defaults to 24-bit color
- BMP files are uncompressed and suitable for embedded devices with simple image decoders

**Examples:**
- PNG output (default): `{"imageFormat": "png"}`
- 1-bit BMP for eink displays: `{"imageFormat": "bmp", "dithering": {"algorithm": "floyd-steinberg", "colors": 2}}`
- 8-bit grayscale BMP: `{"imageFormat": "bmp", "dithering": {"algorithm": "floyd-steinberg", "colors": 16}}`
- 24-bit color BMP: `{"imageFormat": "bmp"}`

## Usage

### Manage all dashboards:

```bash
./eink-server -config config.json
```

### Manage specific dashboards:

```bash
./eink-server -config config.json weather calendar
```

### Enable HTTP server:

```bash
./eink-server -config config.json -http :8080
```

This starts an HTTP server on port 8080 that serves dashboard screenshots at `/dashboards/{id}.png` or `/dashboards/{id}.bmp` (depending on the configured format).

Dashboard IDs are passed as command-line arguments (not as a flag). You can specify any number of dashboard IDs.

### How it works:

The server will:
1. Load existing metadata for all dashboards
2. Perform an initial refresh for any dashboards that are due (based on their last refresh time)
3. Run a minutely ticker that checks all dashboards and refreshes those that are past their refresh interval

### Refresh scheduling:

- Each dashboard has a `refreshTime` (or falls back to `defaultRefreshTime`)
- The server checks every minute which dashboards are due for refresh
- A dashboard is "due" if: `current_time >= last_refresh_time + refresh_interval`
- On startup, dashboards with no metadata are immediately refreshed
- Dashboards are refreshed in parallel for efficiency

### Environment Variables

- `CHROMIUM_EXECUTABLE`: Path to Chromium/Chrome executable (auto-detected if not set)

## HTTP Server

When the `-http` flag is provided, the server starts an HTTP file server that serves dashboard screenshots.

### Endpoint

- `GET /dashboards/{id}.png`: Returns the PNG screenshot for the specified dashboard
- `GET /dashboards/{id}.bmp`: Returns the BMP screenshot for the specified dashboard

The correct endpoint depends on the `imageFormat` configured for each dashboard.

### Authentication

Dashboards can be protected with two types of authentication:

1. **Password authentication** (via `passwordFile`):
   - Password stored in a file
   - Client must provide `?password=<value>` query parameter
   - Example: `curl http://localhost:8080/dashboards/weather.png?password=secret123`

2. **Token authentication** (via `authTokenFile`):
   - Token stored in a file
   - Client must provide `Authorization` header
   - Supports both `Authorization: Bearer <token>` and `Authorization: <token>`
   - Example: `curl -H "Authorization: Bearer mytoken123" http://localhost:8080/dashboards/calendar.png`

If neither `passwordFile` nor `authTokenFile` is configured, the dashboard is publicly accessible.

### Response Headers

The HTTP response includes useful metadata headers:

- `Last-Modified`: Timestamp when the screenshot was last refreshed (RFC 2822 format)
- `ETag`: Entity tag for cache validation (format: `"dashboardID-timestamp-size"`)
- `Cache-Control`: Set to `public, must-revalidate` to enable client-side caching with validation
- `X-Dashboard-ID`: The dashboard identifier
- `X-Load-Time-MS`: Time it took to load and capture the screenshot in milliseconds
- `Content-Type`: `image/png` or `image/bmp` (depending on configured format)
- `Content-Length`: Size of the image file in bytes

### HTTP Caching

The server implements proper HTTP caching using both `Last-Modified` and `ETag` headers:

1. **Conditional Requests**: Clients can send `If-None-Match` (ETag) or `If-Modified-Since` headers
2. **304 Not Modified**: When the image hasn't changed, the server returns `304 Not Modified` with no body
3. **Bandwidth Savings**: Reduces bandwidth usage for clients that poll the endpoint frequently

**Example with caching:**
```bash
# First request - downloads full image
curl -i http://localhost:8080/dashboards/weather.png -o weather.png

# Subsequent request - saves ETag from first response
ETAG=$(curl -s -I http://localhost:8080/dashboards/weather.png | grep -i etag | cut -d' ' -f2 | tr -d '\r')

# Conditional request - returns 304 if unchanged
curl -H "If-None-Match: $ETAG" -i http://localhost:8080/dashboards/weather.png
```

### Examples

```bash
# Public dashboard (no authentication)
curl http://localhost:8080/dashboards/news.png -o news.png

# Password-protected dashboard
curl "http://localhost:8080/dashboards/weather.png?password=secret123" -o weather.png

# Token-protected dashboard
curl -H "Authorization: Bearer mytoken456" \
  http://localhost:8080/dashboards/calendar.png -o calendar.png

# Check last-modified time
curl -I http://localhost:8080/dashboards/news.png
```

## Output

For each dashboard, the server creates:

- `./data/<dashboard-id>.<ext>`: Screenshot of the dashboard (`.png` or `.bmp` depending on `imageFormat`)
- `./data/<dashboard-id>.json`: Metadata file containing:
  ```json
  {
    "dashboardId": "weather",
    "url": "https://example.com/weather",
    "loadTimeMs": 1234,
    "refreshedAt": "2026-04-05T12:00:00Z",
    "success": true,
    "screenshotPath": "./data/weather.png"
  }
  ```

## API Usage

You can also use this as a library:

```go
package main

import (
    "context"
    "log"
    
    "github.com/diamondburned/eink-server/internal/config"
    "github.com/diamondburned/eink-server/internal/puppeteer"
)

func main() {
    cfg, err := config.Load("config.json")
    if err != nil {
        log.Fatal(err)
    }
    
    ctx := context.Background()
    manager, err := puppeteer.NewManager(ctx, cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer manager.Close()
    
    // Refresh specific dashboards
    err = manager.RefreshDashboards(ctx, []string{"weather", "calendar"})
    if err != nil {
        log.Fatal(err)
    }
}
```

## License

See LICENSE file.
