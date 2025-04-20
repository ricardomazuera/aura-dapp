package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

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

// In-memory storage for demonstration purposes
// In a real application, you would use a database
var users = map[string]User{}
var habits = map[string][]Habit{}
var wallets = map[string]Wallet{}

func init() {
	// Load environment variables from .env file
	godotenv.Load()
}

func main() {
	mux := http.NewServeMux()

	// Set up API routes
	mux.HandleFunc("GET /api/user/role", getUserRoleHandler)
	mux.HandleFunc("GET /api/habits", getHabitsHandler)
	mux.HandleFunc("POST /api/habits", createHabitHandler)
	mux.HandleFunc("PUT /api/habits/{habitId}/progress", updateHabitProgressHandler)
	mux.HandleFunc("POST /api/login", loginHandler)

	// Set up CORS middleware
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Start server
	handler := c.Handler(mux)
	fmt.Printf("Server running on port %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := authenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
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

	wallet, exists := wallets[userID]

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

		// TODO: Implement logic to save the wallet in Supabase
		wallets[userID] = newWallet

		response.Success = true
		response.Message = "Wallet created successfully"
		response.Wallet = &newWallet
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getUserRoleHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := authenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check if user exists in our store
	user, exists := users[userID]
	if !exists {
		// Create new user with default role
		user = User{
			ID:    userID,
			Email: extractEmailFromToken(r),
			Role:  "free", // Default role for new users
		}
		users[userID] = user
	}

	// Return user with role
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func getHabitsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := authenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get habits for user
	userHabits, exists := habits[userID]
	if !exists {
		userHabits = []Habit{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(userHabits)
}

func createHabitHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := authenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
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

	// Get user to check role limits
	user, exists := users[userID]
	if !exists {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Check if user has reached their habit limit
	userHabits, _ := habits[userID]
	maxHabits := 1 // Default for free users
	if user.Role == "pro" {
		maxHabits = 5
	}

	if len(userHabits) >= maxHabits {
		http.Error(w, "You have reached the maximum number of habits for your plan", http.StatusForbidden)
		return
	}

	// Create new habit
	newHabit := Habit{
		ID:            generateID(),
		UserID:        userID,
		Name:          request.Name,
		DaysCompleted: 0,
		Completed:     false,
		CreatedAt:     time.Now(),
	}

	// Add habit to store
	userHabits = append(userHabits, newHabit)
	habits[userID] = userHabits

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newHabit)
}

func updateHabitProgressHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := authenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get habit ID from path
	habitID := strings.TrimPrefix(r.URL.Path, "/api/habits/")
	habitID = strings.TrimSuffix(habitID, "/progress")

	// Find and update habit
	userHabits, exists := habits[userID]
	if !exists {
		http.Error(w, "No habits found", http.StatusNotFound)
		return
	}

	var updatedHabit Habit
	var found bool

	for i, habit := range userHabits {
		if habit.ID == habitID {
			found = true
			// Increment days completed
			userHabits[i].DaysCompleted++

			// Check if habit is completed (7 days)
			if userHabits[i].DaysCompleted >= 7 {
				userHabits[i].Completed = true
				userHabits[i].DaysCompleted = 7 // Cap at 7
			}

			updatedHabit = userHabits[i]
			break
		}
	}

	if !found {
		http.Error(w, "Habit not found", http.StatusNotFound)
		return
	}

	// Update habits store
	habits[userID] = userHabits

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedHabit)
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

	// Check if the token is intended for our application
	// The following URLs should match your Supabase project URLs
	supabaseURL := os.Getenv("SUPABASE_URL")
	if supabaseURL == "" {
		log.Println("Warning: SUPABASE_URL not set in environment variables")
	} else if !strings.Contains(iss, supabaseURL) {
		return "", fmt.Errorf("token not issued for this application")
	}

	// In a production environment, we should validate the JWT signature
	// using the Supabase JWT secret or public key
	supabaseJWTSecret := os.Getenv("SUPABASE_JWT_SECRET")
	if supabaseJWTSecret != "" {
		_, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Check the signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}

			// Use the Supabase JWT secret to verify the signature
			return []byte(supabaseJWTSecret), nil
		})

		if err != nil {
			return "", fmt.Errorf("invalid token signature: %v", err)
		}
	} else {
		log.Println("Warning: SUPABASE_JWT_SECRET not set, skipping token signature validation")
	}

	// Validate that the user exists in Supabase Authentication
	// For a real implementation with Supabase, we would check
	// against the Supabase auth.users table or make an API call

	// Option 1: If you have access to the Supabase database directly:
	// Make a database query to check if the user exists
	// Example: SELECT COUNT(*) FROM auth.users WHERE id = $1

	// Option 2: Use Supabase Admin API to check if the user exists
	// This requires the service role key which should be kept secure
	if os.Getenv("VALIDATE_USER_EXISTS") == "true" {
		exists, err := checkUserExists(sub)
		if err != nil {
			return "", fmt.Errorf("error checking if user exists: %v", err)
		}
		if !exists {
			return "", fmt.Errorf("user does not exist in Supabase")
		}
	}

	return sub, nil
}

// checkUserExists verifies if a user exists in Supabase
// This is an example implementation that would need to be updated
// with your actual Supabase API calls
func checkUserExists(userID string) (bool, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseServiceKey := os.Getenv("SUPABASE_SERVICE_KEY")

	if supabaseURL == "" || supabaseServiceKey == "" {
		log.Println("Warning: Supabase URL or service key not set, skipping user existence check")
		return true, nil
	}

	// Create a request to Supabase Admin API to check if user exists
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/auth/v1/admin/users/%s", supabaseURL, userID), nil)
	if err != nil {
		return false, err
	}

	// Set the required headers
	req.Header.Set("apikey", supabaseServiceKey)
	req.Header.Set("Authorization", "Bearer "+supabaseServiceKey)

	// Send the request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	// Check the response status
	if resp.StatusCode == http.StatusOK {
		return true, nil
	} else if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}

	return false, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
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
