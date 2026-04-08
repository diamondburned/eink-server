# Architecture Decisions

## Key Design Patterns

### Single Chromium Instance
- Spawn Chrome once via `Start()` method and keep it running
- Only clean up tabs between dashboard refreshes
- Do NOT restart browser for each screenshot

### Decoupled Lifecycle
- `NewManager()` creates unstarted instance
- `Start(ctx)` blocks forever and actually starts browser
- This allows clean initialization and testing

### errgroup.Group Pattern
- All goroutines (browser, HTTP server, refresh loop) managed via errgroup
- Provides proper error handling and graceful shutdown
- If any goroutine fails, all others are cancelled via shared context

### Refresh Scheduling
- **Minutely ticker**: Check every minute which dashboards are due for refresh
- **Due calculation**: Based on last refresh time + refresh interval
- **Metadata tracking**: Load existing metadata on startup to determine which dashboards need refreshing
- **Parallel processing**: Refresh multiple dashboards concurrently using goroutines

### Configuration Design
- **Typed enums**: Use `type T string` with `const ()` blocks for string-based config values
- **Duration type**: Custom `Duration` type implementing `encoding.TextUnmarshaler` and `encoding.TextMarshaler` for automatic JSON parsing
- **File loading**: Headers and URL params can be loaded from files using `headersFromFile` and `urlParamsFromFile`

### CLI Design
- Dashboard IDs as positional arguments (not flags)
- Example: `./eink-server -config config.json weather calendar`
- Clean and simple interface

### HTTP Routing
- Use chi/v5 router with built-in middleware
- Separate `internal/web` package for HTTP handling
- Route pattern: `/dashboards/{id}.png` (plural for consistency)

### Logging
- Use `log/slog` with context-aware logging throughout
- Always use `slog.XContext` variants for structured logging
- Pass context through all function calls
