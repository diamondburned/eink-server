# Technical Discoveries

## Go Standard Library

### image/draw Dithering
- Go's standard library provides `draw.FloydSteinberg`
- No external dependencies needed for dithering
- Create palettes with configurable color depth
- Works with `image.Paletted` for output

### encoding Package Interfaces
- `encoding.TextUnmarshaler` and `encoding.TextMarshaler` automatically handle JSON parsing
- When a type implements these interfaces, `encoding/json` uses them
- Perfect for custom types like Duration that need special parsing

## chromedp Behavior

### Browser Allocation Timing
- The first `chromedp.Run()` call on a context allocates the browser
- Using a context with timeout for this is problematic
- Browser allocation can take several seconds
- **Best practice**: Allocate browser during initialization without timeout
- Keep browser running for application lifetime

### Context Hierarchy
- Allocator context → Browser context → Tab contexts
- Canceling tab context cleans up that tab
- Canceling browser context shuts down browser
- Never cancel allocator context until shutdown

## HTTP Routing

### chi/v5 Advantages
- Cleaner than stdlib `http.ServeMux` for parameterized routes
- Built-in middleware ecosystem
- `chi.URLParam(r, "id")` is cleaner than parsing path manually
- Supports route groups for organizing endpoints

### Middleware Patterns
- chi allows per-route and per-group middleware
- `RealIP` middleware essential when behind reverse proxy
- `Logger` middleware should use slog for consistency

## Error Handling

### errgroup Pattern
- Perfect for managing multiple blocking goroutines
- Shared context for coordinated cancellation
- First error cancels all other goroutines
- Clean shutdown on SIGINT/SIGTERM

Example:
```go
g, ctx := errgroup.WithContext(ctx)

g.Go(func() error {
    return manager.Start(ctx)
})

g.Go(func() error {
    return server.ListenAndServe()
})

if err := g.Wait(); err != nil {
    // Handle first error
}
```

## Configuration Loading

### Relative Path Resolution
- Files referenced in config (`headersFromFile`, etc.) should be relative to config file
- Use `filepath.Dir(configPath)` as base directory
- Makes configs portable and relocatable

## Timing and Scheduling

### Minutely Ticker Benefits
- More efficient than checking every second
- Dashboard refresh times are typically minutes/hours
- One-minute granularity is sufficient for eink displays
- Reduces CPU usage during idle periods

### Due Time Calculation
- Check: `time.Since(lastRefresh) >= refreshInterval`
- Simple and reliable
- Works across restarts when metadata is persisted
- No need for complex scheduling algorithms
