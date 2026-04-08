# eink-server Project Overview

## Goal

Create a production-ready Go-based eink-server application for managing and rendering eink dashboards using Chromium/Puppeteer. The server should:

- Use a single Chromium instance for all dashboards with proper lifecycle management
- Refresh dashboards in parallel based on configurable schedules
- Support per-dashboard refresh times with smart scheduling
- Provide webhook support, custom headers/URL parameters, and screenshot post-processing
- Use structured logging with log/slog
- Serve screenshots via HTTP with authentication
- Have clean architecture with proper error handling using errgroup

## Project Structure

```
/home/diamond/Scripts/diamondburned/eink-server/server/
├── internal/
│   ├── config/      - Configuration loading and types
│   ├── puppeteer/   - Chromium browser management
│   ├── imaging/     - Screenshot post-processing (dithering, BMP/PNG encoding)
│   └── web/         - HTTP server with chi/v5
├── main.go          - CLI entry point with errgroup
├── go.mod           - Dependencies (chromedp, chi/v5, errgroup)
├── config.example.json - Real config for diamonds-desk dashboard
└── README.md        - Comprehensive documentation
```

## Key Dependencies

- `github.com/chromedp/chromedp` - Browser automation
- `github.com/go-chi/chi/v5` - HTTP router
- `golang.org/x/sync/errgroup` - Goroutine management
- `golang.org/x/image/bmp` - BMP encoding
