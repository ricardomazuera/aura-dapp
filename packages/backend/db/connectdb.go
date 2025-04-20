package db

import (
	"context"
	"database/sql"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// DB is a global variable that contains the database connection
var DB *sql.DB

// InitDB initializes the database connection
func InitDB() (*sql.DB, error) {
	// Load environment variables from .env file
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: Error loading .env file:", err)
	}

	// Connect to Supabase PostgreSQL database
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		log.Println("Warning: DATABASE_URL not set in environment variables")
		log.Println("Using default connection string for local development")
		connStr = os.Getenv("DATABASE_URL_LOCAL")
		if connStr == "" {
			connStr = "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable"
		}
	}

	log.Printf("Connecting to database...")

	// Open DB connection
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	// Configure connection pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Test database connection with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}

	log.Println("Connected to database successfully")

	// Save the connection in the global variable
	DB = db

	return db, nil
}

// GetDB returns the database connection
func GetDB() *sql.DB {
	return DB
}
