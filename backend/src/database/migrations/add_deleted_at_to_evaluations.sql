-- Migration: Add deleted_at column to evaluations table
-- This allows for soft deletion of evaluations

ALTER TABLE evaluations ADD COLUMN deleted_at DATETIME DEFAULT NULL;

-- Add index for performance when filtering out deleted evaluations
CREATE INDEX IF NOT EXISTS idx_evaluations_deleted_at ON evaluations(deleted_at);

-- Add index for performance on common queries (evaluation_date + deleted_at)
CREATE INDEX IF NOT EXISTS idx_evaluations_date_deleted 
ON evaluations(evaluation_date, deleted_at); 