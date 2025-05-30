-- Migration: Add deleted_at column to case_evaluations table
-- This allows for soft deletion of case evaluations

ALTER TABLE case_evaluations ADD COLUMN deleted_at DATETIME DEFAULT NULL;

-- Add index for performance when filtering out deleted cases
CREATE INDEX IF NOT EXISTS idx_case_evaluations_deleted_at ON case_evaluations(deleted_at);

-- Add unique constraint for case_id within evaluation (excluding deleted cases)
-- This ensures case_id is unique per evaluation when not deleted
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_evaluations_unique_case_id 
ON case_evaluations(evaluation_id, case_id) 
WHERE deleted_at IS NULL AND case_id IS NOT NULL; 