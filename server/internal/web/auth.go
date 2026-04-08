package web

import (
	"crypto/subtle"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/diamondburned/eink-server/internal/config"
	"github.com/go-chi/chi/v5"
)

func (s *Server) mustAuthenticateDashboardMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		dashboard, ok := s.cfg.DashboardByID(chi.URLParam(r, "id"))
		if !ok {
			http.Error(w, "Dashboard not found", http.StatusNotFound)
			return
		}

		authenticated, err := authenticateDashboardRequest(r, dashboard)
		if err != nil {
			slog.ErrorContext(r.Context(),
				"Failed to authenticate dashboard request",
				"error", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		if !authenticated {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func authenticateDashboardRequest(r *http.Request, dashboard *config.Dashboard) (bool, error) {
	wantPassword, err := dashboard.ReadPassword()
	if err != nil {
		return false, fmt.Errorf("failed to read dashboard password: %w", err)
	}

	if wantPassword != "" {
		if dashboard.PasswordIsBearerToken {
			authHeader := r.Header.Get("Authorization")
			authValue, ok := strings.CutPrefix(authHeader, "Bearer ")
			if !ok || !constantStringEq(authValue, wantPassword) {
				return false, nil // Authorization header missing or does not start with "Bearer "
			}
		} else {
			gotPassword := r.FormValue("password")
			if !constantStringEq(gotPassword, wantPassword) {
				return false, nil // Password does not match
			}
		}
	}

	return true, nil
}

func constantStringEq(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
