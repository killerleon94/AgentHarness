package realtime

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"sync"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/auth"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// MembershipChecker verifies a user belongs to a workspace.
type MembershipChecker interface {
	IsMember(ctx context.Context, userID, workspaceID string) bool
}

// PATResolver resolves a Personal Access Token to a user ID.
// Returns the user ID and true if the token is valid, or ("", false) otherwise.
type PATResolver interface {
	ResolveToken(ctx context.Context, token string) (userID string, ok bool)
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// TODO: Restrict origins in production
		return true
	},
}

// Client represents a single WebSocket connection with identity.
type Client struct {
	hub         *Hub
	conn        *websocket.Conn
	send        chan []byte
	userID      string
	workspaceID string
}

// InboundHandler processes incoming WebSocket messages from clients.
// Returns response bytes and whether to send ack/error back to the sender.
type InboundHandler func(ctx context.Context, client *Client, msgType string, payload json.RawMessage) (response []byte, success bool)

// Hub manages WebSocket connections organized by workspace rooms and group rooms.
type Hub struct {
	rooms          map[string]map[*Client]bool // workspaceID -> clients
	groupRooms     map[string]map[*Client]bool // groupID -> clients (for group chat)
	broadcast      chan []byte                 // global broadcast (daemon events)
	register       chan *Client
	unregister     chan *Client
	mu             sync.RWMutex
	InboundHandler InboundHandler // handles inbound WS messages
}

// NewHub creates a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]bool),
		groupRooms: make(map[string]map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub event loop.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			room := client.workspaceID
			if h.rooms[room] == nil {
				h.rooms[room] = make(map[*Client]bool)
			}
			h.rooms[room][client] = true
			total := 0
			for _, r := range h.rooms {
				total += len(r)
			}
			h.mu.Unlock()
			slog.Info("ws client connected", "workspace_id", room, "total_clients", total)

		case client := <-h.unregister:
			h.mu.Lock()
			room := client.workspaceID
			if clients, ok := h.rooms[room]; ok {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					close(client.send)
					if len(clients) == 0 {
						delete(h.rooms, room)
					}
				}
			}
			// Clean up group rooms
			for gid, gclients := range h.groupRooms {
				if _, exists := gclients[client]; exists {
					delete(gclients, client)
					if len(gclients) == 0 {
						delete(h.groupRooms, gid)
					}
				}
			}
			total := 0
			for _, r := range h.rooms {
				total += len(r)
			}
			h.mu.Unlock()
			slog.Info("ws client disconnected", "workspace_id", room, "total_clients", total)

		case message := <-h.broadcast:
			// Global broadcast for daemon events (no workspace filtering)
			h.mu.RLock()
			// Copy bytes — json.Marshal may reuse pooled buffer
			msgCopy := make([]byte, len(message))
			copy(msgCopy, message)
			var slow []*Client
			for _, clients := range h.rooms {
				for client := range clients {
					select {
					case client.send <- msgCopy:
					default:
						slow = append(slow, client)
					}
				}
			}
			h.mu.RUnlock()
			if len(slow) > 0 {
				h.mu.Lock()
				for _, client := range slow {
					room := client.workspaceID
					if clients, ok := h.rooms[room]; ok {
						if _, exists := clients[client]; exists {
							delete(clients, client)
							close(client.send)
							if len(clients) == 0 {
								delete(h.rooms, room)
							}
						}
					}
				}
				h.mu.Unlock()
			}
		}
	}
}

// BroadcastToWorkspace sends a message only to clients in the given workspace.
func (h *Hub) BroadcastToWorkspace(workspaceID string, message []byte) {
	h.mu.RLock()
	clients := h.rooms[workspaceID]
	// Copy bytes — json.Marshal may reuse pooled buffer
	msgCopy := make([]byte, len(message))
	copy(msgCopy, message)
	var slow []*Client
	for client := range clients {
		select {
		case client.send <- msgCopy:
		default:
			slow = append(slow, client)
		}
	}
	h.mu.RUnlock()

	// Remove slow clients under write lock
	if len(slow) > 0 {
		h.mu.Lock()
		for _, client := range slow {
			if room, ok := h.rooms[workspaceID]; ok {
				if _, exists := room[client]; exists {
					delete(room, client)
					close(client.send)
					if len(room) == 0 {
						delete(h.rooms, workspaceID)
					}
				}
			}
		}
		h.mu.Unlock()
	}
}

// SendToUser sends a message to all connections belonging to a specific user,
// regardless of which workspace room they are in. Connections in excludeWorkspace
// are skipped (they already receive the message via BroadcastToWorkspace).
func (h *Hub) SendToUser(userID string, message []byte, excludeWorkspace ...string) {
	exclude := ""
	if len(excludeWorkspace) > 0 {
		exclude = excludeWorkspace[0]
	}

	h.mu.RLock()
	type target struct {
		client      *Client
		workspaceID string
	}
	var targets []target
	for wsID, clients := range h.rooms {
		if wsID == exclude {
			continue
		}
		for client := range clients {
			if client.userID == userID {
				targets = append(targets, target{client, wsID})
			}
		}
	}
	h.mu.RUnlock()

	// Copy bytes — json.Marshal may reuse pooled buffer
	msgCopy := make([]byte, len(message))
	copy(msgCopy, message)

	var slow []target
	for _, t := range targets {
		select {
		case t.client.send <- msgCopy:
		default:
			slow = append(slow, t)
		}
	}

	// Remove slow clients under write lock (same pattern as BroadcastToWorkspace)
	if len(slow) > 0 {
		h.mu.Lock()
		for _, t := range slow {
			if room, ok := h.rooms[t.workspaceID]; ok {
				if _, exists := room[t.client]; exists {
					delete(room, t.client)
					close(t.client.send)
					if len(room) == 0 {
						delete(h.rooms, t.workspaceID)
					}
				}
			}
		}
		h.mu.Unlock()
	}
}

// Broadcast sends a message to all connected clients (used for daemon events).
func (h *Hub) Broadcast(message []byte) {
	h.broadcast <- message
}

// RegisterGroup subscribes a client to a group room.
func (h *Hub) RegisterGroup(client *Client, groupID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.groupRooms[groupID] == nil {
		h.groupRooms[groupID] = make(map[*Client]bool)
	}
	h.groupRooms[groupID][client] = true
}

// UnregisterGroup unsubscribes a client from a group room.
func (h *Hub) UnregisterGroup(client *Client, groupID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.groupRooms[groupID]; ok {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.groupRooms, groupID)
		}
	}
}

// BroadcastToGroup sends a message to all clients subscribed to a group room.
func (h *Hub) BroadcastToGroup(groupID string, message []byte) {
	h.mu.RLock()
	clients := h.groupRooms[groupID]
	// Copy bytes — json.Marshal may reuse pooled buffer
	msgCopy := make([]byte, len(message))
	copy(msgCopy, message)
	var slow []*Client
	for client := range clients {
		select {
		case client.send <- msgCopy:
		default:
			slow = append(slow, client)
		}
	}
	h.mu.RUnlock()

	if len(slow) > 0 {
		h.mu.Lock()
		for _, client := range slow {
			if room, ok := h.groupRooms[groupID]; ok {
				if _, exists := room[client]; exists {
					delete(room, client)
					close(client.send)
					if len(room) == 0 {
						delete(h.groupRooms, groupID)
					}
				}
			}
		}
		h.mu.Unlock()
	}
}

// UnregisterClientFromAllGroups removes a client from all group rooms.
func (h *Hub) UnregisterClientFromAllGroups(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for groupID, clients := range h.groupRooms {
		if _, exists := clients[client]; exists {
			delete(clients, client)
			if len(clients) == 0 {
				delete(h.groupRooms, groupID)
			}
		}
	}
}

// HandleWebSocket upgrades an HTTP connection to WebSocket with JWT or PAT auth.
func HandleWebSocket(hub *Hub, mc MembershipChecker, pr PATResolver, queries *db.Queries, w http.ResponseWriter, r *http.Request) {
	tokenStr := r.URL.Query().Get("token")
	workspaceID := r.URL.Query().Get("workspace_id")

	if tokenStr == "" || workspaceID == "" {
		http.Error(w, `{"error":"token and workspace_id required"}`, http.StatusUnauthorized)
		return
	}

	var userID string

	if strings.HasPrefix(tokenStr, "mul_") {
		// PAT authentication
		if pr == nil {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}
		uid, ok := pr.ResolveToken(r.Context(), tokenStr)
		if !ok {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}
		userID = uid
	} else {
		// JWT authentication
		token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return auth.JWTSecret(), nil
		})
		if err != nil || !token.Valid {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
			return
		}

		uid, ok := claims["sub"].(string)
		if !ok || strings.TrimSpace(uid) == "" {
			http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
			return
		}
		userID = uid
	}

	// Verify user state (disabled, password change required) if queries is available
	var isSysAdmin bool
	if queries != nil {
		uid := pgtype.UUID{}
		if err := uid.Scan(userID); err != nil {
			http.Error(w, `{"error":"invalid user ID"}`, http.StatusInternalServerError)
			return
		}
		user, err := queries.GetUser(r.Context(), uid)
		if err != nil {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}
		if user.Disabled {
			http.Error(w, `{"error":"account disabled"}`, http.StatusForbidden)
			return
		}
		if user.PasswordChangeRequired {
			http.Error(w, `{"error":"password change required"}`, http.StatusForbidden)
			return
		}
		isSysAdmin = user.Role == "admin"
	}

	// Verify user is a member of the workspace (system admins bypass)
	if !isSysAdmin && !mc.IsMember(r.Context(), userID, workspaceID) {
		http.Error(w, `{"error":"not a member of this workspace"}`, http.StatusForbidden)
		return
	}

	// Check workspace is not disabled (system admins bypass)
	if !isSysAdmin && queries != nil {
		var wsID pgtype.UUID
		if err := wsID.Scan(workspaceID); err != nil {
			http.Error(w, `{"error":"invalid workspace ID"}`, http.StatusInternalServerError)
			return
		}
		ws, err := queries.GetWorkspace(r.Context(), wsID)
		if err != nil || ws.Disabled {
			http.Error(w, `{"error":"workspace is disabled"}`, http.StatusForbidden)
			return
		}
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("websocket upgrade failed", "error", err)
		return
	}

	// 10 MB read limit to accommodate large agent responses
	conn.SetReadLimit(10 << 20)

	client := &Client{
		hub:         hub,
		conn:        conn,
		send:        make(chan []byte, 256),
		userID:      userID,
		workspaceID: workspaceID,
	}
	hub.register <- client

	go client.writePump()
	go client.readPump()
}

// UserID returns the user ID associated with this client.
func (c *Client) UserID() string { return c.userID }

// WorkspaceID returns the workspace ID associated with this client.
func (c *Client) WorkspaceID() string { return c.workspaceID }

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				slog.Debug("websocket read error", "error", err, "user_id", c.userID, "workspace_id", c.workspaceID)
			}
			break
		}

		if c.hub.InboundHandler == nil {
			slog.Debug("ws message received, no handler registered", "user_id", c.userID, "workspace_id", c.workspaceID)
			continue
		}

		var msg protocol.Message
		if err := json.Unmarshal(raw, &msg); err != nil {
			slog.Debug("ws message parse error", "error", err, "user_id", c.userID)
			continue
		}

		resp, success := c.hub.InboundHandler(context.Background(), c, msg.Type, msg.Payload)
		if len(resp) > 0 && c.workspaceID != "" {
			// Copy resp bytes — json.Marshal returns pooled buffer slices that can
			// be mutated by subsequent marshal calls (e.g. during publish/broadcast).
			respCopy := make([]byte, len(resp))
			copy(respCopy, resp)
			select {
			case c.send <- respCopy:
			default:
				slog.Warn("ws response dropped: client send buffer full", "user_id", c.userID)
			}
		}
		_ = success
	}
}

func (c *Client) writePump() {
	defer c.conn.Close()

	for message := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
			slog.Warn("websocket write error", "error", err)
			return
		}
	}
}
