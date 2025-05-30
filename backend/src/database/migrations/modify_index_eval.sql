-- Drop existing unique index (required to replace it)
DROP INDEX IF EXISTS idx_evaluations_engineer_date;

-- Create new partial unique index that ignores deleted rows
CREATE UNIQUE INDEX idx_evaluations_engineer_date_not_deleted 
ON evaluations(engineer_id, evaluation_date) 
WHERE deleted_at IS NULL;
