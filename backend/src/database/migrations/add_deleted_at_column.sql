-- Migration: Add deleted_at column to users table
-- This allows for soft deletion of users

ALTER TABLE users ADD COLUMN deleted_at DATETIME DEFAULT NULL;

-- Add index for performance when filtering out deleted users
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at); 