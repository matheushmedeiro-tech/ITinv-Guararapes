package main

import (
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type EquipmentItem struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	Type               string `json:"type"`
	Origin             string `json:"origin"`
	Formatted          bool   `json:"formatted"`
	Configured         bool   `json:"configured"`
	Status             string `json:"status"`
	ProblemType        string `json:"problemType"`
	ProblemDescription string `json:"problemDescription"`
}

type StockItem struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Type          string `json:"type"`
	Origin        string `json:"origin"`
	TotalQuantity int    `json:"totalQuantity"`
	MinQuantity   int    `json:"minQuantity"`
	Notes         string `json:"notes"`
}

type StockLoan struct {
	ID       string `json:"id"`
	ItemID   string `json:"itemId"`
	ItemName string `json:"itemName"`
	ItemType string `json:"itemType"`
	Quantity int    `json:"quantity"`
	LoanTo   string `json:"loanTo"`
	LoanDate string `json:"loanDate"`
	Notes    string `json:"notes"`
}

type AppState struct {
	Equipment             []EquipmentItem `json:"equipment"`
	EquipmentTypes        []string        `json:"equipmentTypes"`
	Origins               []string        `json:"origins"`
	ProblemTypes          []string        `json:"problemTypes"`
	StockItems            []StockItem     `json:"stockItems"`
	StockLoans            []StockLoan     `json:"stockLoans"`
	StockTypes            []string        `json:"stockTypes"`
	StockLocations        []string        `json:"stockLocations"`
	StockLoanDestinations []string        `json:"stockLoanDestinations"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

type UserResponse struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

const sessionTTL = 24 * time.Hour

type userSession struct {
	email     string
	role      string
	expiresAt time.Time
}

type sessionStore struct {
	mu       sync.RWMutex
	sessions map[string]userSession
}

func newSessionStore() *sessionStore {
	s := &sessionStore{sessions: make(map[string]userSession)}
	go s.cleanupLoop()
	return s
}

func (s *sessionStore) create(email, role string) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := hex.EncodeToString(b)

	s.mu.Lock()
	s.sessions[token] = userSession{
		email:     email,
		role:      role,
		expiresAt: time.Now().Add(sessionTTL),
	}
	s.mu.Unlock()

	return token, nil
}

func (s *sessionStore) get(token string) (userSession, bool) {
	s.mu.RLock()
	sess, ok := s.sessions[token]
	s.mu.RUnlock()

	if !ok || time.Now().After(sess.expiresAt) {
		if ok {
			s.delete(token)
		}
		return userSession{}, false
	}
	return sess, true
}

func (s *sessionStore) delete(token string) {
	s.mu.Lock()
	delete(s.sessions, token)
	s.mu.Unlock()
}

func (s *sessionStore) cleanupLoop() {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for k, v := range s.sessions {
			if now.After(v.expiresAt) {
				delete(s.sessions, k)
			}
		}
		s.mu.Unlock()
	}
}

type rateLimiter struct {
	mu          sync.Mutex
	attempts    map[string][]time.Time
	maxAttempts int
	window      time.Duration
}

func newRateLimiter(maxAttempts int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		attempts:    make(map[string][]time.Time),
		maxAttempts: maxAttempts,
		window:      window,
	}
	go rl.cleanupLoop()
	return rl
}

func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	var recent []time.Time
	for _, t := range rl.attempts[key] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}

	if len(recent) >= rl.maxAttempts {
		rl.attempts[key] = recent
		return false
	}

	rl.attempts[key] = append(recent, now)
	return true
}

func (rl *rateLimiter) cleanupLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-rl.window)
		for k, attempts := range rl.attempts {
			var recent []time.Time
			for _, t := range attempts {
				if t.After(cutoff) {
					recent = append(recent, t)
				}
			}
			if len(recent) == 0 {
				delete(rl.attempts, k)
			} else {
				rl.attempts[k] = recent
			}
		}
		rl.mu.Unlock()
	}
}

var defaultAppState = AppState{
	Equipment:             []EquipmentItem{},
	EquipmentTypes:        []string{"Computer", "Monitor", "Notebook", "Printer", "Other"},
	Origins:               []string{"Warehouse", "New stock", "Lease", "Office", "Repair"},
	ProblemTypes:          []string{"Screen issue", "Battery", "Performance", "Network", "Other"},
	StockItems:            []StockItem{},
	StockLoans:            []StockLoan{},
	StockTypes:            []string{"Cabo", "Memória", "Fonte", "Teclado", "Mouse", "Adaptador", "Outro"},
	StockLocations:        []string{"TI - Almoxarifado"},
	StockLoanDestinations: []string{"Financeiro", "RH", "Recepção"},
}

const defaultStateFilePath = "data/state.json"
const stateKey = "main"
const maxBodySize = 10 << 20 // 10 MB

type stateStore interface {
	Load() (AppState, error)
	Save(AppState) error
}

type fileStore struct {
	path string
}

func (s *fileStore) Load() (AppState, error) {
	raw, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return normalizeState(defaultAppState), nil
		}
		return AppState{}, err
	}

	var state AppState
	if err := json.Unmarshal(raw, &state); err != nil {
		return AppState{}, err
	}

	return normalizeState(state), nil
}

func (s *fileStore) Save(state AppState) error {
	state = normalizeState(state)
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}

	return os.WriteFile(s.path, data, 0o644)
}

type postgresStore struct {
	db *sql.DB
}

func newPostgresStore(databaseURL string) (*postgresStore, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	store := &postgresStore{db: db}
	if err := store.migrate(); err != nil {
		return nil, err
	}

	if err := store.ensureSeed(); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *postgresStore) migrate() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS app_state (
			state_key TEXT PRIMARY KEY,
			data JSONB NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	return err
}

func (s *postgresStore) ensureSeed() error {
	state, err := json.Marshal(normalizeState(defaultAppState))
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`
		INSERT INTO app_state (state_key, data)
		VALUES ($1, $2::jsonb)
		ON CONFLICT (state_key) DO NOTHING
	`, stateKey, string(state))
	return err
}

func (s *postgresStore) Load() (AppState, error) {
	var raw string
	err := s.db.QueryRow(`SELECT data::text FROM app_state WHERE state_key = $1`, stateKey).Scan(&raw)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return normalizeState(defaultAppState), nil
		}
		return AppState{}, err
	}

	var state AppState
	if err := json.Unmarshal([]byte(raw), &state); err != nil {
		return AppState{}, err
	}

	return normalizeState(state), nil
}

func (s *postgresStore) Save(state AppState) error {
	state = normalizeState(state)
	raw, err := json.Marshal(state)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`
		INSERT INTO app_state (state_key, data, updated_at)
		VALUES ($1, $2::jsonb, NOW())
		ON CONFLICT (state_key)
		DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
	`, stateKey, string(raw))
	return err
}

type stateServer struct {
	mu            sync.RWMutex
	state         AppState
	store         stateStore
	sessions      *sessionStore
	limiter       *rateLimiter
	allowedOrigin string
}

func main() {
	server, err := newServer()
	if err != nil {
		log.Fatalf("failed to initialize server: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/api/login", server.corsMiddleware(http.HandlerFunc(server.handleLogin)))
	mux.Handle("/api/logout", server.corsMiddleware(http.HandlerFunc(server.handleLogout)))
	mux.Handle("/api/me", server.corsMiddleware(http.HandlerFunc(server.handleMe)))
	mux.Handle("/api/app-state", server.corsMiddleware(http.HandlerFunc(server.handleAppState)))
	mux.Handle("/api/health", server.corsMiddleware(http.HandlerFunc(handleHealth)))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	log.Printf("Starting ITINV backend on port %s (CORS origin: %s)", port, server.allowedOrigin)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func newServer() (*stateServer, error) {
	store, storageName, err := newStateStoreFromEnv()
	if err != nil {
		return nil, err
	}

	state, err := store.Load()
	if err != nil {
		return nil, err
	}

	log.Printf("State storage backend: %s", storageName)
	return &stateServer{
		state:         state,
		store:         store,
		sessions:      newSessionStore(),
		limiter:       newRateLimiter(10, 15*time.Minute),
		allowedOrigin: getAllowedOrigin(),
	}, nil
}

func newStateStoreFromEnv() (stateStore, string, error) {
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL != "" {
		store, err := newPostgresStore(databaseURL)
		if err != nil {
			return nil, "", err
		}
		return store, "postgres", nil
	}

	stateFilePath := strings.TrimSpace(os.Getenv("STATE_FILE_PATH"))
	if stateFilePath == "" {
		stateFilePath = defaultStateFilePath
	}

	return &fileStore{path: stateFilePath}, "file", nil
}

func getAdminEmail() string {
	email := os.Getenv("ADMIN_EMAIL")
	if email == "" {
		log.Fatal("ADMIN_EMAIL is required")
	}
	return strings.TrimSpace(email)
}

func getAdminPassword() string {
	password := os.Getenv("ADMIN_PASSWORD")
	if password == "" {
		log.Fatal("ADMIN_PASSWORD is required")
	}
	return strings.TrimSpace(password)
}

func getAllowedOrigin() string {
	origin := strings.TrimSpace(os.Getenv("ALLOWED_ORIGIN"))
	if origin == "" {
		return "*"
	}
	return origin
}

func normalizeState(state AppState) AppState {
	if state.Equipment == nil {
		state.Equipment = []EquipmentItem{}
	}
	if len(state.EquipmentTypes) == 0 {
		state.EquipmentTypes = defaultAppState.EquipmentTypes
	}
	if len(state.Origins) == 0 {
		state.Origins = defaultAppState.Origins
	}
	if len(state.ProblemTypes) == 0 {
		state.ProblemTypes = defaultAppState.ProblemTypes
	}
	if state.StockItems == nil {
		state.StockItems = []StockItem{}
	}
	if state.StockLoans == nil {
		state.StockLoans = []StockLoan{}
	}
	if len(state.StockTypes) == 0 {
		state.StockTypes = defaultAppState.StockTypes
	}
	if len(state.StockLocations) == 0 {
		state.StockLocations = defaultAppState.StockLocations
	}
	if len(state.StockLoanDestinations) == 0 {
		state.StockLoanDestinations = defaultAppState.StockLoanDestinations
	}
	return state
}

func (s *stateServer) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	clientIP := getClientIP(r)
	if !s.limiter.allow(clientIP) {
		respondError(w, http.StatusTooManyRequests, "Too many login attempts. Try again later.")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 4<<10)
	var payload LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	email := strings.TrimSpace(payload.Email)
	password := strings.TrimSpace(payload.Password)

	adminEmail := getAdminEmail()
	adminPassword := getAdminPassword()
	emailMatch := strings.EqualFold(email, adminEmail)
	passMatch := subtle.ConstantTimeCompare([]byte(password), []byte(adminPassword)) == 1

	if !emailMatch || !passMatch {
		respondError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	token, err := s.sessions.create(adminEmail, "admin")
	if err != nil {
		log.Printf("failed to create session: %v", err)
		respondError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	respondJSON(w, LoginResponse{Token: token, Email: adminEmail, Role: "admin"})
}

func (s *stateServer) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	token := extractBearerToken(r)
	if token != "" {
		s.sessions.delete(token)
	}

	respondJSON(w, map[string]bool{"ok": true})
}

func (s *stateServer) handleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", "GET")
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	sess, ok := s.authorize(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	respondJSON(w, UserResponse{Email: sess.email, Role: sess.role})
}

func (s *stateServer) handleAppState(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.authorize(r); !ok {
		respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	switch r.Method {
	case http.MethodGet:
		s.mu.RLock()
		state := s.state
		s.mu.RUnlock()
		respondJSON(w, state)

	case http.MethodPost:
		r.Body = http.MaxBytesReader(w, r.Body, int64(maxBodySize))
		var payload AppState
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			var maxBytesErr *http.MaxBytesError
			if errors.As(err, &maxBytesErr) {
				respondError(w, http.StatusRequestEntityTooLarge, "Request body too large")
				return
			}
			respondError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		payload = normalizeState(payload)

		s.mu.Lock()
		s.state = payload
		err := s.store.Save(payload)
		s.mu.Unlock()
		if err != nil {
			log.Printf("error saving state: %v", err)
			respondError(w, http.StatusInternalServerError, "Failed to save state")
			return
		}

		respondJSON(w, s.state)

	default:
		w.Header().Set("Allow", "GET, POST")
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", "GET")
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	respondJSON(w, map[string]bool{"ok": true})
}

func extractBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return ""
}

func (s *stateServer) authorize(r *http.Request) (userSession, bool) {
	token := extractBearerToken(r)
	if token == "" {
		return userSession{}, false
	}
	return s.sessions.get(token)
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("failed to write response: %v", err)
	}
}

func respondError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(ErrorResponse{Error: message})
}

func (s *stateServer) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := s.allowedOrigin
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if origin != "*" {
			w.Header().Set("Vary", "Origin")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if ip := strings.TrimSpace(strings.Split(xff, ",")[0]); ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
