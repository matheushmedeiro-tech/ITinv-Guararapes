package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

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
	Loaned             bool   `json:"loaned"`
	LoanTo             string `json:"loanTo"`
	LoanDate           string `json:"loanDate"`
}

type AppState struct {
	Equipment      []EquipmentItem `json:"equipment"`
	EquipmentTypes []string        `json:"equipmentTypes"`
	Origins        []string        `json:"origins"`
	ProblemTypes   []string        `json:"problemTypes"`
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

var defaultAppState = AppState{
	Equipment: []EquipmentItem{
		{
			ID:                 "1",
			Name:               "Workstation A1",
			Type:               "Computer",
			Origin:             "Warehouse",
			Formatted:          true,
			Configured:         true,
			Status:             "OK",
			ProblemDescription: "",
			Loaned:             false,
			LoanTo:             "",
			LoanDate:           "",
		},
		{
			ID:                 "2",
			Name:               "Reception Monitor",
			Type:               "Monitor",
			Origin:             "New stock",
			Formatted:          false,
			Configured:         false,
			Status:             "Problem",
			ProblemType:        "Screen issue",
			ProblemDescription: "Flickering screen during startup.",
			Loaned:             true,
			LoanTo:             "Finance",
			LoanDate:           "2026-04-01",
		},
		{
			ID:                 "3",
			Name:               "Finance Notebook",
			Type:               "Notebook",
			Origin:             "Lease",
			Formatted:          true,
			Configured:         false,
			Status:             "OK",
			ProblemType:        "",
			ProblemDescription: "",
			Loaned:             false,
			LoanTo:             "",
			LoanDate:           "",
		},
	},
	EquipmentTypes: []string{"Computer", "Monitor", "Notebook", "Printer", "Other"},
	Origins:        []string{"Warehouse", "New stock", "Lease", "Office", "Repair"},
	ProblemTypes:   []string{"Screen issue", "Battery", "Performance", "Network", "Other"},
}

const defaultStateFilePath = "data/state.json"
const stateKey = "main"

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

func main() {
	server, err := newServer()
	if err != nil {
		log.Fatalf("failed to initialize server: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/api/app-state", server.corsMiddleware(http.HandlerFunc(server.handleAppState)))
	mux.Handle("/api/login", server.corsMiddleware(http.HandlerFunc(server.handleLogin)))
	mux.Handle("/api/me", server.corsMiddleware(http.HandlerFunc(server.handleMe)))
	mux.Handle("/api/health", server.corsMiddleware(http.HandlerFunc(handleHealth)))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	log.Printf("Starting ITINV backend on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

type stateServer struct {
	mu    sync.RWMutex
	state AppState
	store stateStore
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
	return &stateServer{state: state, store: store}, nil
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

func getAuthToken() string {
	secret := getAdminEmail() + ":" + getAdminPassword()
	sum := sha256.Sum256([]byte(secret))
	return fmt.Sprintf("%x", sum[:])
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
	return state
}

func (s *stateServer) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	email := strings.TrimSpace(payload.Email)
	password := strings.TrimSpace(payload.Password)

	if !strings.EqualFold(email, getAdminEmail()) || password != getAdminPassword() {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	respondJSON(w, LoginResponse{Token: getAuthToken(), Email: getAdminEmail(), Role: "admin"})
}

func (s *stateServer) handleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", "GET")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !authorize(r) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	respondJSON(w, UserResponse{Email: getAdminEmail(), Role: "admin"})
}

func (s *stateServer) handleAppState(w http.ResponseWriter, r *http.Request) {
	if !authorize(r) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	switch r.Method {
	case http.MethodGet:
		s.mu.RLock()
		state := s.state
		s.mu.RUnlock()
		respondJSON(w, state)

	case http.MethodPost:
		var payload AppState
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
			return
		}

		payload = normalizeState(payload)

		s.mu.Lock()
		s.state = payload
		err := s.store.Save(payload)
		s.mu.Unlock()
		if err != nil {
			log.Printf("error saving state: %v", err)
			http.Error(w, "Failed to save state", http.StatusInternalServerError)
			return
		}

		respondJSON(w, s.state)

	default:
		w.Header().Set("Allow", "GET, POST")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func authorize(r *http.Request) bool {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		token := strings.TrimPrefix(auth, "Bearer ")
		return token == getAuthToken()
	}
	return false
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", "GET")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	respondJSON(w, map[string]bool{"ok": true})
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("failed to write response: %v", err)
	}
}

func (s *stateServer) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
