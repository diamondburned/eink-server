// Package web provides HTTP server functionality for serving dashboard screenshots.
package web

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path"

	"github.com/diamondburned/eink-server/internal/config"
	"github.com/diamondburned/eink-server/internal/puppeteer"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// Server represents the HTTP server for serving dashboard screenshots
type Server struct {
	cfg     *config.Config
	manager *puppeteer.Manager
}

// NewServer creates a new web server
func NewServer(cfg *config.Config, manager *puppeteer.Manager) *Server {
	return &Server{
		cfg:     cfg,
		manager: manager,
	}
}

// Handler returns the HTTP handler for the server
func (s *Server) Handler() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)

	r.Group(func(r chi.Router) {
		r.Use(s.mustAuthenticateDashboardMiddleware)
		r.Get("/dashboards/{id}", s.serveDashboard)
		r.Get("/dashboards/{id}.png", s.serveDashboard)
		r.Get("/dashboards/{id}.bmp", s.serveDashboard)
		r.Get("/dashboards/{id}.json", s.serveDashboardMetadata)
	})

	return r
}

// serveDashboard serves a dashboard screenshot
func (s *Server) serveDashboard(w http.ResponseWriter, r *http.Request) {
	// Default caching header behavior:
	w.Header().Set("Cache-Control", "public, must-revalidate")

	dashboard, ok := s.cfg.DashboardByID(chi.URLParam(r, "id"))
	if !ok {
		http.Error(w, "Dashboard not found", http.StatusNotFound)
		return
	}

	// Force canonical extension via StatusFound redirection:
	if ext := path.Ext(r.URL.Path); ext != dashboard.ImageFormat.FileExtension() {
		canonicalPath := "/dashboards/" + dashboard.ID + dashboard.ImageFormat.FileExtension()
		http.Redirect(w, r, canonicalPath, http.StatusFound)
		return
	}

	metadata := s.manager.Metadata(dashboard.ID)

	if !metadata.IsSuccess() {
		http.Error(w, "Dashboard screenshot not yet available", http.StatusConflict)
		return
	}

	if metadata.IsSuccess() {
		w.Header().Set("ETag", fmt.Sprintf(`"%s-%d"`, dashboard.ID, metadata.RefreshedAt.Unix()))
	}

	screenshotFile, err := os.Open(metadata.ScreenshotPath)
	if err != nil {
		warnInternalError(r, w,
			"Failed to open dashboard screenshot",
			"dashboard_id", dashboard.ID,
			"error", err)
		return
	}
	defer screenshotFile.Close()

	http.ServeContent(w, r, dashboard.ScreenshotName(), metadata.RefreshedAt, screenshotFile)
}

func (s *Server) serveDashboardMetadata(w http.ResponseWriter, r *http.Request) {
	// Get dashboard config
	dashboard, ok := s.cfg.DashboardByID(chi.URLParam(r, "id"))
	if !ok {
		http.Error(w, "Dashboard not found", http.StatusNotFound)
		return
	}

	metadata := s.manager.Metadata(dashboard.ID)

	// Show the canonicalized URL path instead of the local filesystem path.
	metadata.ScreenshotPath = "/dashboards/" + dashboard.ID + dashboard.ImageFormat.FileExtension()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metadata)
}

func warnInternalError(r *http.Request, w http.ResponseWriter, msg string, fields ...any) {
	slog.WarnContext(r.Context(), msg, fields...)
	http.Error(w, "Internal server error", http.StatusInternalServerError)
}
