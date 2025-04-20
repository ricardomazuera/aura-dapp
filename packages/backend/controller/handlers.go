package controller

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Required types for controllers
type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

type Habit struct {
	ID            string    `json:"id"`
	UserID        string    `json:"userId"`
	Name          string    `json:"name"`
	DaysCompleted int       `json:"daysCompleted"`
	Completed     bool      `json:"completed"`
	CreatedAt     time.Time `json:"createdAt"`
}

type Wallet struct {
	PublicKey           string `json:"publicKey"`
	EncryptedPrivateKey string `json:"encryptedPrivateKey"`
	Address             string `json:"address"`
}

type LoginRequest struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
}

type LoginResponse struct {
	Success bool    `json:"success"`
	Message string  `json:"message"`
	Wallet  *Wallet `json:"wallet,omitempty"`
}

// Controller structure that maintains the database connection
type Controller struct {
	DB *sql.DB
}

// NewController creates a new controller instance
func NewController(db *sql.DB) *Controller {
	return &Controller{DB: db}
}

// LoginHandler handles login requests
func (c *Controller) LoginHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := authenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
		return
	}

	var request LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if userID != request.UserID {
		http.Error(w, "User ID mismatch", http.StatusForbidden)
		return
	}

	// Check if user already has a wallet
	var wallet Wallet
	var exists bool

	err = c.DB.QueryRow("SELECT public_key, encrypted_private_key, address FROM wallets WHERE user_id = $1", userID).
		Scan(&wallet.PublicKey, &wallet.EncryptedPrivateKey, &wallet.Address)

	if err == nil {
		exists = true
	} else if err != sql.ErrNoRows {
		log.Printf("Database error checking wallet: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	response := LoginResponse{}

	if exists {
		// If the user already has a wallet, return success
		response.Success = true
		response.Message = "User already has a wallet"
		response.Wallet = &wallet
	} else {
		// Create a new wallet for the user
		// In a real case, here we would call the Chipi SDK function
		// to create the wallet with account abstraction

		// NOTE: This is a simulated implementation, in production
		// you would use the Chipi SDK to generate these values
		newWallet := Wallet{
			PublicKey:           fmt.Sprintf("public_key_%s", generateID()),
			EncryptedPrivateKey: fmt.Sprintf("encrypted_key_%s", generateID()),
			Address:             fmt.Sprintf("0x%s", generateID()),
		}

		// Save the wallet in the database
		_, err := c.DB.Exec(
			"INSERT INTO wallets (user_id, public_key, encrypted_private_key, address) VALUES ($1, $2, $3, $4)",
			userID, newWallet.PublicKey, newWallet.EncryptedPrivateKey, newWallet.Address,
		)

		if err != nil {
			log.Printf("Error saving wallet: %v", err)
			http.Error(w, "Failed to save wallet", http.StatusInternalServerError)
			return
		}

		response.Success = true
		response.Message = "Wallet created successfully"
		response.Wallet = &newWallet
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetUserRoleHandler handles requests to obtain the user's role
func (c *Controller) GetUserRoleHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := authenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
		return
	}

	var user User
	user.ID = userID
	user.Email = extractEmailFromToken(r)

	// Check if user exists in the database
	err = c.DB.QueryRow("SELECT role FROM users_profiles WHERE id = $1", userID).Scan(&user.Role)
	if err == sql.ErrNoRows {
		// User doesn't exist, create a new user profile with default role
		user.Role = "free" // Default role
		_, err := c.DB.Exec("INSERT INTO users_profiles (id, email, role) VALUES ($1, $2, $3)",
			userID, user.Email, user.Role)
		if err != nil {
			log.Printf("Error creating user profile: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
	} else if err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Return user with role
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// GetHabitsHandler handles requests to obtain the user's habits
func (c *Controller) GetHabitsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := authenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
		return
	}

	// Get habits for user from database
	rows, err := c.DB.Query(
		"SELECT id, user_id, name, days_completed, completed, created_at FROM habits WHERE user_id = $1 ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var habits []Habit
	for rows.Next() {
		var h Habit
		if err := rows.Scan(&h.ID, &h.UserID, &h.Name, &h.DaysCompleted, &h.Completed, &h.CreatedAt); err != nil {
			log.Printf("Error scanning habit row: %v", err)
			continue
		}
		habits = append(habits, h)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Error iterating habits rows: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Return empty array if no habits found
	if habits == nil {
		habits = []Habit{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(habits)
}

// CreateHabitHandler handles requests to create a new habit
func (c *Controller) CreateHabitHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := authenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
		return
	}

	// Parse request body
	var request struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Get user role to check limits
	var userRole string
	err = c.DB.QueryRow("SELECT role FROM users_profiles WHERE id = $1", userID).Scan(&userRole)
	if err == sql.ErrNoRows {
		userRole = "free" // Default role if not found
	} else if err != nil {
		log.Printf("Database error getting user role: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Count existing habits
	var habitCount int
	err = c.DB.QueryRow("SELECT COUNT(*) FROM habits WHERE user_id = $1", userID).Scan(&habitCount)
	if err != nil {
		log.Printf("Database error counting habits: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Check if user has reached their habit limit
	maxHabits := 1 // Default for free users
	if userRole == "pro" {
		maxHabits = 5
	}

	if habitCount >= maxHabits {
		http.Error(w, "You have reached the maximum number of habits for your plan", http.StatusForbidden)
		return
	}

	// Create new habit
	newHabit := Habit{
		ID:            uuid.New().String(),
		UserID:        userID,
		Name:          request.Name,
		DaysCompleted: 0,
		Completed:     false,
		CreatedAt:     time.Now(),
	}

	// Insert habit into database
	_, err = c.DB.Exec(
		"INSERT INTO habits (id, user_id, name, days_completed, completed, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
		newHabit.ID, newHabit.UserID, newHabit.Name, newHabit.DaysCompleted, newHabit.Completed, newHabit.CreatedAt,
	)
	if err != nil {
		log.Printf("Error creating habit: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newHabit)
}

// UpdateHabitProgressHandler handles requests to update a habit's progress
func (c *Controller) UpdateHabitProgressHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := authenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
		return
	}

	// Get habit ID from path
	path := r.URL.Path
	segments := strings.Split(path, "/")
	if len(segments) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	habitID := segments[3]

	// Check if habit exists and belongs to the user
	var habit Habit
	err = c.DB.QueryRow(
		"SELECT id, user_id, name, days_completed, completed, created_at FROM habits WHERE id = $1 AND user_id = $2",
		habitID, userID,
	).Scan(
		&habit.ID, &habit.UserID, &habit.Name, &habit.DaysCompleted, &habit.Completed, &habit.CreatedAt,
	)

	if err == sql.ErrNoRows {
		http.Error(w, "Habit not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Increment days completed
	habit.DaysCompleted++

	// Check if habit is completed (7 days)
	if habit.DaysCompleted >= 7 {
		habit.Completed = true
		habit.DaysCompleted = 7 // Cap at 7 days
	}

	// Update habit in database
	_, err = c.DB.Exec(
		"UPDATE habits SET days_completed = $1, completed = $2 WHERE id = $3",
		habit.DaysCompleted, habit.Completed, habit.ID,
	)
	if err != nil {
		log.Printf("Error updating habit: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(habit)
}

// Helper functions

func authenticateUser(r *http.Request) (string, error) {
	// Get token from Authorization header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", fmt.Errorf("no authorization header")
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")

	// Parse the JWT token without validation first to extract claims
	parser := new(jwt.Parser)
	token, _, err := parser.ParseUnverified(tokenString, jwt.MapClaims{})
	if err != nil {
		return "", fmt.Errorf("could not parse token: %v", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", fmt.Errorf("invalid token claims")
	}

	// Validate the token expiration
	exp, ok := claims["exp"].(float64)
	if !ok || int64(exp) < time.Now().Unix() {
		return "", fmt.Errorf("token expired")
	}

	// Extract user ID (sub) from claims
	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return "", fmt.Errorf("user ID not found in token")
	}

	// Validate the issuer is from Supabase
	iss, ok := claims["iss"].(string)
	if !ok || !strings.Contains(iss, "supabase") {
		return "", fmt.Errorf("invalid token issuer: %s", iss)
	}

	return sub, nil
}

func extractEmailFromToken(r *http.Request) string {
	// Get token from Authorization header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")

	// Parse token without validation
	token, _, err := new(jwt.Parser).ParseUnverified(tokenString, jwt.MapClaims{})
	if err != nil {
		return ""
	}

	// Extract email from claims
	if claims, ok := token.Claims.(jwt.MapClaims); ok {
		if email, ok := claims["email"].(string); ok {
			return email
		}
	}

	return ""
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
