package handler

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/multica-ai/multica/server/internal/logger"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

func (h *Handler) DisableWorkspace(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "id")
	uid := parseUUID(workspaceID)

	ws, err := h.Queries.GetWorkspace(r.Context(), uid)
	if err != nil {
		writeError(w, http.StatusNotFound, "workspace not found")
		return
	}

	if ws.Disabled {
		writeError(w, http.StatusConflict, "workspace already disabled")
		return
	}

	if err := h.Queries.UpdateWorkspaceDisabled(r.Context(), db.UpdateWorkspaceDisabledParams{
		ID:       uid,
		Disabled: true,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to disable workspace")
		return
	}

	slog.Info("admin disabled workspace", append(logger.RequestAttrs(r), "workspace_id", workspaceID)...)

	ws.Disabled = true
	userID := requestUserID(r)
	h.publish(protocol.EventWorkspaceUpdated, workspaceID, "member", userID, map[string]any{"workspace": workspaceToResponse(ws)})

	writeJSON(w, http.StatusOK, workspaceToResponse(ws))
}

func (h *Handler) EnableWorkspace(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "id")
	uid := parseUUID(workspaceID)

	ws, err := h.Queries.GetWorkspace(r.Context(), uid)
	if err != nil {
		writeError(w, http.StatusNotFound, "workspace not found")
		return
	}

	if !ws.Disabled {
		writeError(w, http.StatusConflict, "workspace is not disabled")
		return
	}

	if err := h.Queries.UpdateWorkspaceDisabled(r.Context(), db.UpdateWorkspaceDisabledParams{
		ID:       uid,
		Disabled: false,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to enable workspace")
		return
	}

	slog.Info("admin enabled workspace", append(logger.RequestAttrs(r), "workspace_id", workspaceID)...)

	ws.Disabled = false
	userID := requestUserID(r)
	h.publish(protocol.EventWorkspaceUpdated, workspaceID, "member", userID, map[string]any{"workspace": workspaceToResponse(ws)})

	writeJSON(w, http.StatusOK, workspaceToResponse(ws))
}
