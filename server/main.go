package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"slices"
	"syscall"

	"github.com/diamondburned/eink-server/internal/config"
	"github.com/diamondburned/eink-server/internal/puppeteer"
	"github.com/diamondburned/eink-server/internal/web"
	"golang.org/x/sync/errgroup"
	"libdb.so/hserve"
)

var (
	configPath   = "config.json"
	debugLogging = false
)

func main() {
	flag.StringVar(&configPath, "config", configPath, "Path to configuration file")
	flag.BoolVar(&debugLogging, "debug", debugLogging, "Enable debug logging")
	flag.Parse()

	if debugLogging {
		slog.SetLogLoggerLevel(slog.LevelDebug)
	}

	if configPath == "" {
		slog.Error("Config file path is required")
		os.Exit(1)
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		slog.Error("Failed to load config", "error", err)
		os.Exit(1)
	}

	// Determine which dashboards to manage from given argv, or all if omitted.
	if ids := flag.Args(); len(ids) > 0 {
		cfg.Dashboards = slices.DeleteFunc(cfg.Dashboards, func(d config.Dashboard) bool {
			return !slices.Contains(ids, d.ID)
		})
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	manager, err := puppeteer.NewManager(cfg)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to create puppeteer manager", "error", err)
		os.Exit(1)
	}

	g, ctx := errgroup.WithContext(ctx)

	if cfg.WebServer.ListenAddress != "" {
		webServer := web.NewServer(cfg, manager)

		g.Go(func() error {
			slog.InfoContext(ctx,
				"Starting HTTP server",
				"addr", cfg.WebServer.ListenAddress)

			return hserve.ListenAndServe(ctx, cfg.WebServer.ListenAddress, webServer.Handler())
		})
	}

	g.Go(func() error {
	})

	if err := g.Wait(); err != nil && err != context.Canceled {
		slog.ErrorContext(ctx,
			"Error running server",
			"error", err)
		os.Exit(1)
	}

	slog.DebugContext(ctx, "eink-server shutdown complete")
}
