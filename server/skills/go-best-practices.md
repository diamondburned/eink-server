# Go Best Practices for eink-server

## Naming Conventions

### No "Get" Prefix for Getters
- Methods should be `Metadata()` not `GetMetadata()`
- Go convention: simple noun for getters
- Only use "Get" if it implies fetching from remote source

### Field Naming
- Use clear, unambiguous units in field names
- `pageLoadDelaySec` not `pageLoadDelayMs` (when using seconds)
- Make units obvious to prevent confusion

## Type Design

### Custom Duration Type
- Implement `encoding.TextUnmarshaler` for parsing from JSON
- Implement `encoding.TextMarshaler` for serializing to JSON
- Allows automatic parsing of duration strings like "5m", "1h30m"

Example:
```go
type Duration time.Duration

func (d *Duration) UnmarshalText(text []byte) error {
    dur, err := time.ParseDuration(string(text))
    if err != nil {
        return err
    }
    *d = Duration(dur)
    return nil
}
```

### String-Based Enums
- Use typed strings for configuration enums
- Define as `type T string` with `const ()` blocks
- Provides type safety while remaining JSON-friendly

Example:
```go
type HTTPMethod string

const (
    HTTPMethodGET  HTTPMethod = "GET"
    HTTPMethodPOST HTTPMethod = "POST"
)
```

## Image Processing

### Standard Library Dithering
- Use `image/draw.FloydSteinberg` for dithering
- Create custom palettes with `color.Palette`
- Configurable color depth (2, 4, 16 levels)

Example:
```go
palette := color.Palette{
    color.Black,
    color.Gray{85},
    color.Gray{170},
    color.White,
}
dithered := image.NewPaletted(bounds, palette)
draw.FloydSteinberg.Draw(dithered, bounds, img, image.Point{})
```

## Chromedp Best Practices

### Browser Initialization Warning
- The first `chromedp.Run()` call on a context allocates the browser
- Using a context with timeout for initial allocation is problematic
- **Solution**: Start browser once during initialization without timeout
- Keep browser running for lifetime of application

### Context Management
- Create one allocator context for browser lifetime
- Create tab contexts for individual dashboard screenshots
- Cancel tab contexts after each screenshot to clean up

Example:
```go
// Create browser once
allocCtx, allocCancel := chromedp.NewExecAllocator(ctx, opts...)
browserCtx, browserCancel := chromedp.NewContext(allocCtx)

// For each screenshot
tabCtx, tabCancel := chromedp.NewContext(browserCtx)
defer tabCancel()
chromedp.Run(tabCtx, actions...)
```

## Package Documentation

### Package-Level Comments
- Every package should have a package-level documentation comment
- Placed before `package` declaration
- Explains purpose and key concepts

Example:
```go
// Package puppeteer manages Chromium browser instances for capturing
// dashboard screenshots. It handles browser lifecycle, tab management,
// and screenshot scheduling.
package puppeteer
```

## Router Choice

### chi/v5 Benefits
- Clean URL parameter extraction: `chi.URLParam(r, "id")`
- Built-in middleware: logging, recovery, real IP
- Lightweight and idiomatic Go
- Better than stdlib for complex routing
