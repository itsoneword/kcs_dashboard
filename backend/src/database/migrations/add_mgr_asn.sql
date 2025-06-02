-- Simple migration script for manager role functionality

-- 1. Add is_manager column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN is_manager BOOLEAN DEFAULT FALSE;

-- 2. Create manager_assignments table
CREATE TABLE IF NOT EXISTS manager_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_id INTEGER REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL
);

-- 3. Create a unique index for manager assignments
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_manager_assignments 
ON manager_assignments(manager_id, assigned_to) 
WHERE deleted_at IS NULL;

-- 4. Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(is_manager);
CREATE INDEX IF NOT EXISTS idx_manager_assignments ON manager_assignments(manager_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_deleted_at ON manager_assignments(deleted_at);