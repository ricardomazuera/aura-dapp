package controller

import (
	"database/sql"
	"net/http"

	"github.com/rs/cors"
)

// SetupRoutes configures all API routes
func SetupRoutes(db *sql.DB) http.Handler {
	// Create a new controller instance
	controller := NewController(db)

	// Create a new HTTP multiplexer
	mux := http.NewServeMux()

	// Configure routes
	mux.HandleFunc("GET /api/user/role", controller.GetUserRoleHandler)
	mux.HandleFunc("PUT /api/user/role", controller.UpdateUserRoleHandler)
	mux.HandleFunc("GET /api/habits", controller.GetHabitsHandler)
	mux.HandleFunc("POST /api/habits", controller.CreateHabitHandler)
	mux.HandleFunc("PUT /api/habits/{habitId}/progress", controller.UpdateHabitProgressHandler)
	mux.HandleFunc("POST /api/login", controller.LoginHandler)

	// Configure CORS
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	})

	// Return handler with CORS middleware applied
	return corsHandler.Handler(mux)
}
