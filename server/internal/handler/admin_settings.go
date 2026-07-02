package handler

import (
	"encoding/json"
	"net/http"

	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type registrationSettings struct {
	Enabled bool `json:"enabled"`
}

func (h *Handler) GetRegistrationStatus(w http.ResponseWriter, r *http.Request) {
	val, err := h.Queries.GetSetting(r.Context(), "registration_enabled")
	enabled := err == nil && val == "true"

	writeJSON(w, http.StatusOK, registrationSettings{Enabled: enabled})
}

func (h *Handler) SetRegistrationStatus(w http.ResponseWriter, r *http.Request) {
	var req registrationSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	val := "false"
	if req.Enabled {
		val = "true"
	}

	if err := h.Queries.UpsertSetting(r.Context(), db.UpsertSettingParams{
		Key:   "registration_enabled",
		Value: val,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update setting")
		return
	}

	writeJSON(w, http.StatusOK, registrationSettings{Enabled: req.Enabled})
}
