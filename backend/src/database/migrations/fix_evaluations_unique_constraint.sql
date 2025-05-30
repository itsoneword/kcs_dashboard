-- Migration: Fix evaluations unique constraint
-- This migration addresses two issues:
-- 1. Exclude soft-deleted evaluations from unique constraint
-- 2. Change constraint to use year-month instead of full date (since evaluations are monthly)

-- First, let's backup the current data
CREATE TEMPORARY TABLE evaluations_backup AS 
SELECT * FROM evaluations;

-- Drop the entire table (this removes all constraints)
DROP TABLE evaluations;

-- Recreate the table without the old UNIQUE constraint
CREATE TABLE evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_id INTEGER REFERENCES engineers(id),
    coach_user_id INTEGER REFERENCES users(id),
    evaluation_date DATE NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    deleted_at DATETIME DEFAULT NULL
);

-- Restore the data
INSERT INTO evaluations (id, engineer_id, coach_user_id, evaluation_date, created_by, created_at, updated_at, updated_by, deleted_at)
SELECT id, engineer_id, coach_user_id, evaluation_date, created_by, created_at, updated_at, updated_by, deleted_at
FROM evaluations_backup;

-- Drop the backup table
DROP TABLE evaluations_backup;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_evaluations_engineer_date ON evaluations(engineer_id, evaluation_date);
CREATE INDEX IF NOT EXISTS idx_evaluations_deleted_at ON evaluations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_evaluations_date_deleted ON evaluations(evaluation_date, deleted_at);

-- Create new unique constraint that:
-- 1. Excludes soft-deleted records (WHERE deleted_at IS NULL)
-- 2. Uses year-month instead of full date (strftime('%Y-%m', evaluation_date))
CREATE UNIQUE INDEX idx_evaluations_unique_engineer_month 
ON evaluations(engineer_id, strftime('%Y-%m', evaluation_date)) 
WHERE deleted_at IS NULL;

-- Recreate the update trigger
CREATE TRIGGER IF NOT EXISTS update_evaluations_timestamp 
    AFTER UPDATE ON evaluations
    BEGIN
        UPDATE evaluations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END; 