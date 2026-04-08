// Package puppeteer manages Chromium browser instances for capturing dashboard screenshots.
package puppeteer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync/atomic"
	"time"

	"github.com/chromedp/cdproto/fetch"
	"github.com/chromedp/chromedp"
	"github.com/diamondburned/eink-server/internal/config"
	"github.com/diamondburned/eink-server/internal/imaging"
	"github.com/puzpuzpuz/xsync/v4"
	"golang.org/x/sync/errgroup"
)

// Manager manages a single Chromium instance for all dashboards
type Manager struct {
	cfg           *config.Config
	execAllocOpts []chromedp.ExecAllocatorOption
	metadata      *xsync.Map[string, *config.Metadata]
}

// NewManager creates a new puppeteer manager (does not start browser yet)
func NewManager(cfg *config.Config) (*Manager, error) {
	opts := slices.Concat(
		chromedp.DefaultExecAllocatorOptions[:],
		[]chromedp.ExecAllocatorOption{
			chromedp.NoFirstRun,
			chromedp.NoDefaultBrowserCheck,
			chromedp.Flag("headless", true),
			chromedp.Flag("autoplay-policy", "no-user-gesture-required"),
			chromedp.Flag("bwsi", true),
			chromedp.Flag("check-for-update-interval", "31536000"),
			chromedp.Flag("disable-features", "Translate"),
			chromedp.Flag("disable-infobars", true),
			chromedp.Flag("disable-notifications", true),
			chromedp.Flag("disable-search-engine-choice-screen", true),
			chromedp.Flag("disable-session-crashed-bubble", true),
			chromedp.Flag("disable-sync", true),
			chromedp.Flag("disable-translate", true),
			chromedp.Flag("hide-scrollbars", true),
			chromedp.Flag("incognito", true),
			chromedp.Flag("noerrdialogs", true),
			// Force unique user data dir to prevent collisions with any
			// existing browser instances.
			chromedp.UserDataDir(filepath.Join(cfg.DataDir, "chromium-user-data")),
		},
	)

	// Add user defined flags
	for _, f := range cfg.ExtraChromiumFlags {
		name := strings.TrimPrefix(f, "--")
		value := any(true)
		if n, v, ok := strings.Cut(name, "="); ok {
			name = n
			value = v
		}
		opts = append(opts, chromedp.Flag(name, value))
	}

	execPath := os.Getenv("CHROMIUM_EXECUTABLE")
	if execPath == "" {
		// Fallback to searching in PATH if not specified
		if path, err := exec.LookPath("chromium"); err == nil {
			execPath = path
		} else if path, err := exec.LookPath("google-chrome"); err == nil {
			execPath = path
		} else if path, err := exec.LookPath("chromium-browser"); err == nil {
			execPath = path
		} else if path, err := exec.LookPath("chrome"); err == nil {
			execPath = path
		} else {
			return nil, fmt.Errorf("no chromium executable found in CHROMIUM_EXECUTABLE env or PATH (checked: chromium, google-chrome, chromium-browser, chrome)")
		}
	}

	slog.Info("Using Chromium executable", "path", execPath)
	opts = append(opts, chromedp.ExecPath(execPath))

	return &Manager{
		cfg:           cfg,
		execAllocOpts: opts,
		metadata:      xsync.NewMap[string, *config.Metadata](),
	}, nil
}

// Metadata returns the in-memory metadata for the given dashboard ID.
// It returns a zero-value Metadata (with only DashboardID set) if no metadata
// has been stored yet (i.e. before the first successful refresh).
func (m *Manager) Metadata(id string) *config.Metadata {
	metadata, ok := m.metadata.Load(id)
	if !ok {
		return &config.Metadata{DashboardID: id}
	}
	return metadata
}

// RefreshResult represents the result of a dashboard refresh operation.
type RefreshResult struct {
	RefreshedDashboards []string
	RefreshedAt         time.Time
}

// StartPeriodicRefresh starts a background goroutine that periodically refreshes
// all dashboards based on their configured refresh times.
func (m *Manager) StartPeriodicRefresh(ctx context.Context, checkPeriod time.Duration) error {
	slog.InfoContext(ctx,
		"Managing dashboards",
		"dashboards", slices.Collect(m.cfg.DashboardIDs()),
		"checkPeriod", checkPeriod)

	if _, err := m.RefreshDashboards(ctx, true); err != nil {
		return fmt.Errorf("failed to refresh dashboards initially: %w", err)
	}

	ticker := time.Tick(checkPeriod)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker:
			if _, err := m.RefreshDashboards(ctx, false); err != nil {
				return fmt.Errorf("failed to refresh dashboards: %w", err)
			}
		}
	}
}

// RefreshDashboards refreshes the given dashboards in parallel. If the
// dashboard has been recently refreshed and is not due for refresh, it will be
// skipped. To bypass this, use it with [force] set to true.
//
// A true value is only returned when all the specified dashboards were
// refreshed successfully. If any dashboard failed to refresh, false is returned
// along with the error.
func (m *Manager) RefreshDashboards(ctx context.Context, force bool, ids ...string) (bool, error) {
	allocCtx, cancelAlloc := chromedp.NewExecAllocator(ctx, m.execAllocOpts...)
	defer cancelAlloc()

	// Set the primary context to be the one with the browser.
	// Do this so we don't make mistakes.
	ctx = allocCtx

	dashboardsToRefresh := make([]*config.Dashboard, 0, len(ids))
	for i, dashboard := range m.cfg.Dashboards {
		if ids == nil || slices.Contains(ids, dashboard.ID) {
			dashboardsToRefresh = append(dashboardsToRefresh, &m.cfg.Dashboards[i])
		}
	}
	slog.DebugContext(ctx,
		"Collected dashboards to refresh",
		"total", len(dashboardsToRefresh))

	var errg errgroup.Group
	defer errg.Wait()

	if m.cfg.NoParallel {
		errg.SetLimit(1)
	} else {
		errg.SetLimit(runtime.GOMAXPROCS(0))
	}

	startTime := time.Now()
	var failed atomic.Bool

	for _, dashboard := range dashboardsToRefresh {
		metadata := m.Metadata(dashboard.ID)

		if !force && !metadata.IsStale(startTime, time.Duration(dashboard.RefreshTime)) && metadata.IsSuccess() && filepath.Base(metadata.ScreenshotPath) == dashboard.ScreenshotName() {
			slog.DebugContext(ctx,
				"Dashboard not due for refresh, skipping",
				"id", dashboard.ID,
				"refresh_time", dashboard.RefreshTime,
				"last_refreshed", metadata.RefreshedAt.Format(time.RFC3339))
			continue
		}

		errg.Go(func() error {
			if err := m.refreshDashboard(ctx, dashboard, startTime); err != nil {
				slog.ErrorContext(ctx,
					"Failed to refresh dashboard",
					"dashboard_id", dashboard.ID,
					"error", err)
				failed.Store(true)
			}
			return nil
		})
	}

	err := errg.Wait()
	slog.DebugContext(ctx, "Dashboard refresh complete")
	return !failed.Load(), err
}

// refreshDashboard refreshes a single dashboard
func (m *Manager) refreshDashboard(ctx context.Context, dashboard *config.Dashboard, startTime time.Time) error {
	metadata := config.Metadata{
		DashboardID: dashboard.ID,
		RefreshedAt: startTime,
	}

	// Build URL with parameters
	targetURL, err := dashboard.BuildURL()
	if err != nil {
		return fmt.Errorf("failed to build URL: %w", err)
	}

	screenshotResult, err := m.refreshDashboardScreenshot(ctx, dashboard, targetURL)
	if err != nil {
		return fmt.Errorf("failed to refresh dashboard screenshot: %w", err)
	}
	slog.DebugContext(ctx,
		"Dashboard screenshot refreshed",
		"dashboard_id", dashboard.ID,
		"screenshot_path", screenshotResult.ScreenshotPath)

	metadata.ScreenshotPath = screenshotResult.ScreenshotPath

	m.metadata.Store(dashboard.ID, &metadata)
	slog.DebugContext(ctx,
		"Dashboard metadata stored",
		"dashboard_id", dashboard.ID,
		"refreshed_at", metadata.RefreshedAt.Format(time.RFC3339))

	var dispatchedWebhooks atomic.Int64
	if len(dashboard.Webhooks) > 0 {
		var errg errgroup.Group
		if dashboard.WebhookSequential {
			errg.SetLimit(1)
		}

		for _, webhook := range dashboard.Webhooks {
			errg.Go(func() error {
				if err := m.dispatchWebhook(ctx, webhook); err != nil {
					slog.ErrorContext(ctx, "Failed to trigger webhook",
						"dashboard_id", dashboard.ID,
						"error", err)
					return err
				}

				dispatchedWebhooks.Add(1)
				return nil
			})
		}
		_ = errg.Wait() // error already logged; using this for SetLimit only
		slog.DebugContext(ctx,
			"Webhook dispatch complete",
			"dashboard_id", dashboard.ID,
			"dispatched_webhooks_count", dispatchedWebhooks.Load(),
			"total_webhooks_count", len(dashboard.Webhooks))
	}

	slog.InfoContext(ctx,
		"Finished refreshing dashboard",
		"dashboard_id", dashboard.ID,
		"dispatched_webhooks_count", dispatchedWebhooks.Load())

	return nil
}

type refreshDashboardScreenshotResult struct {
	ScreenshotPath string
}

func (m *Manager) refreshDashboardScreenshot(ctx context.Context, dashboard *config.Dashboard, targetURL *url.URL) (*refreshDashboardScreenshotResult, error) {
	// Create a new tab context for this dashboard
	// This creates a new tab in the existing browser instance
	ctx, cancelTask := chromedp.NewContext(ctx)
	defer cancelTask()

	// Ensure that the browser is gracefully closed when we're done.
	defer func() {
		slog.DebugContext(ctx, "Closing browser instance")

		if err := chromedp.Cancel(ctx); err != nil {
			slog.WarnContext(ctx,
				"Failed to close browser gracefully at shutdown",
				"error", err)
		} else {
			slog.DebugContext(ctx, "Browser closed successfully at shutdown")
		}
	}()

	// Listen for fetch events to inject headers
	chromedp.ListenTarget(ctx, func(ev any) {
		switch ev := ev.(type) {
		case *fetch.EventRequestPaused:
			go func() {
				fetchReq := fetch.ContinueRequest(ev.RequestID)

				slog.DebugContext(ctx,
					"Intercepted fetch request from chromedp",
					"method", fetchReq.Method,
					"url", ev.Request.URL)

				requestURL, err := url.Parse(ev.Request.URL)
				if err != nil {
					slog.WarnContext(ctx,
						"Failed to parse request URL when intercepting fetch request for header injection",
						"url", ev.Request.URL,
						"error", err)
				} else if requestURL.Host == targetURL.Host && requestURL.Scheme == targetURL.Scheme {
					for k, v := range dashboard.Headers {
						fetchReq.Headers = append(fetchReq.Headers, &fetch.HeaderEntry{
							Name:  k,
							Value: v,
						})
					}
				}

				if err := chromedp.Run(ctx, fetchReq); err != nil {
					slog.WarnContext(ctx, "Failed to continue request", "error", err)
				}
			}()
		}
	})

	targetFetchPatternURL := &url.URL{
		Scheme: targetURL.Scheme,
		Host:   targetURL.Host,
		Path:   "/*",
	}

	// Prepare actions
	actions := []chromedp.Action{
		fetch.Enable().WithPatterns([]*fetch.RequestPattern{
			{URLPattern: targetFetchPatternURL.String()},
		}),
		chromedp.EmulateViewport(
			int64(dashboard.ScreenWidth),
			int64(dashboard.ScreenHeight),
		),
		chromedp.Navigate(targetURL.String()),
		chromedp.WaitVisible(`body`, chromedp.ByQuery),
		chromedp.ActionFunc(func(context.Context) error {
			delay := time.Duration(dashboard.PageLoadDelay)
			slog.DebugContext(ctx,
				"Waiting before screenshot",
				"dashboard_id", dashboard.ID,
				"delay", delay)

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
				return nil
			}
		}),
	}

	extraCSS := dashboard.CSSExtras
	if dashboard.CSSFilter != "" {
		extraCSS += fmt.Sprintf("\n\nbody { filter: %s !important; }\n\n", dashboard.CSSFilter)
	}

	// Inject CSS filters if needed
	if extraCSS != "" {
		cssJSON, err := json.Marshal(extraCSS)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal CSS filter: %w", err)
		}

		actions = append(actions, chromedp.Evaluate(fmt.Sprintf(`(function(css){
			const style = document.createElement('style');
			style.type = 'text/css';
			style.innerHTML = css;
			document.head.appendChild(style);
		})(%s)`, cssJSON), nil))
	}

	// Take screenshot by the end
	var screenshotPNG []byte
	actions = append(actions,
		chromedp.ScreenshotScale("body", dashboard.ImageScale, &screenshotPNG, chromedp.ByQuery),
		chromedp.ResetViewport(),
	)

	slog.DebugContext(ctx,
		"Running screenshot actions using existing browser instance",
		"dashboard_id", dashboard.ID)
	startTime := time.Now()

	if err := chromedp.Run(ctx, actions...); err != nil {
		return nil, fmt.Errorf("failed to take screenshot: %w", err)
	}

	finishTime := time.Now()
	slog.DebugContext(ctx,
		"Screenshot actions completed",
		"dashboard_id", dashboard.ID,
		"time_taken", finishTime.Sub(startTime))

	// Process screenshot for format conversion or dithering
	screenshotName := dashboard.ID + dashboard.ImageFormat.FileExtension()
	screenshotPath := filepath.Join(m.cfg.DataDir, screenshotName)

	// Create a temporary screenshot file first:
	tmpFile, err := os.CreateTemp(m.cfg.DataDir, fmt.Sprintf(".tmp.*-%s", screenshotName))
	if err != nil {
		return nil, fmt.Errorf("failed to create temp screenshot file: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)
	defer tmpFile.Close()

	if err := imaging.ProcessScreenshot(
		bytes.NewReader(screenshotPNG),
		dashboard.Postprocessing,
		dashboard.ImageFormat,
		dashboard.ImageScale,
		tmpFile,
	); err != nil {
		return nil, fmt.Errorf("failed to process screenshot: %w", err)
	}

	slog.DebugContext(ctx,
		"Screenshot post-processed into temporary file",
		"dashboard_id", dashboard.ID,
		"dithering_algorithm", dashboard.Postprocessing.Dithering.Algorithm,
		"image_format", dashboard.ImageFormat,
		"path_temp", tmpPath)

	if err := tmpFile.Close(); err != nil {
		return nil, fmt.Errorf("failed to close temp screenshot file: %w", err)
	}

	// Use move to finalize the screenshot to ensure that the file never appears
	// partially written.
	if err := os.Rename(tmpPath, screenshotPath); err != nil {
		return nil, fmt.Errorf("failed to move temp screenshot file to final location: %w", err)
	}

	slog.DebugContext(ctx,
		"Screenshot saved successfully",
		"dashboard_id", dashboard.ID,
		"path", screenshotPath,
		"path_temp", tmpPath)

	return &refreshDashboardScreenshotResult{
		ScreenshotPath: screenshotPath,
	}, nil
}

func (m *Manager) dispatchWebhook(ctx context.Context, webhook config.Webhook) error {
	timeout := time.Duration(webhook.Timeout)
	if timeout == 0 {
		timeout = time.Duration(m.cfg.DefaultWebhookTimeout)
	}
	if timeout == 0 {
		timeout = 10 * time.Second // Fallback default timeout
	}

	client := &http.Client{Timeout: timeout}

	req, err := webhook.BuildRequest(ctx)
	if err != nil {
		return fmt.Errorf("failed to build webhook request: %w", err)
	}

	slog.DebugContext(ctx,
		"Triggering dashboard webhook",
		"webhook_url", req.URL.String(),
		"webhook_method", webhook.Method)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook request: %w", err)
	}
	defer resp.Body.Close()
	slog.DebugContext(ctx,
		"Webhook HTTP response received",
		"method", webhook.Method,
		"url", webhook.URL,
		"status", resp.StatusCode)

	// Discard response body
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	slog.InfoContext(ctx,
		"Webhook dispatched successfully",
		"method", webhook.Method,
		"url", webhook.URL,
		"status", resp.StatusCode)

	return nil
}
