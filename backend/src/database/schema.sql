-- KCS Portal Database Schema
-- SQLite database for KCS Performance Tracking System

-- Users table (from MS domain or mock auth) - only people who login to system
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ms_user_id TEXT UNIQUE,  -- Microsoft user ID (nullable for mock auth)
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,  -- For mock auth, will be null when MS SSO is implemented
    name TEXT NOT NULL,
    is_coach BOOLEAN DEFAULT FALSE,
    is_lead BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,   -- system admin role
    is_manager BOOLEAN DEFAULT FALSE, -- manager role
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL
);

-- Engineers (workers) - separate entities, no user accounts needed
CREATE TABLE IF NOT EXISTS engineers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    lead_user_id INTEGER REFERENCES users(id), -- who is their lead
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Manager assignments (managers can be assigned to leads)
CREATE TABLE IF NOT EXISTS manager_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_id INTEGER REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL
);

-- Create a unique index for active manager assignments instead of using WHERE clause
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_manager_assignments 
ON manager_assignments(manager_id, assigned_to) 
WHERE deleted_at IS NULL;

-- Coach assignments (many-to-many: coaches can have multiple engineers, engineers can have multiple coaches over time)
CREATE TABLE IF NOT EXISTS engineer_coach_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_id INTEGER REFERENCES engineers(id),
    coach_user_id INTEGER REFERENCES users(id),
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(engineer_id, coach_user_id, start_date)
);

-- Monthly evaluations (one per engineer per month) - simplified date storage
CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_id INTEGER REFERENCES engineers(id),
    coach_user_id INTEGER REFERENCES users(id),
    evaluation_date DATE NOT NULL,  -- YYYY-MM-DD format, quarter calculated in UI
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id), -- track who last modified
    deleted_at DATETIME DEFAULT NULL
);

-- Individual case evaluations (7 predefined + expandable)
CREATE TABLE IF NOT EXISTS case_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_id INTEGER REFERENCES evaluations(id),
    case_number INTEGER NOT NULL, -- 1-7 (or more)
    case_id TEXT, -- actual case ID if available
    kb_potential BOOLEAN DEFAULT FALSE,
    article_linked BOOLEAN DEFAULT FALSE,
    article_improved BOOLEAN DEFAULT FALSE,
    improvement_opportunity BOOLEAN DEFAULT FALSE,
    article_created BOOLEAN DEFAULT FALSE,
    create_opportunity BOOLEAN DEFAULT FALSE,
    relevant_link BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    UNIQUE(evaluation_id, case_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_evaluations_engineer_date ON evaluations(engineer_id, evaluation_date);
CREATE INDEX IF NOT EXISTS idx_case_evaluations_evaluation ON case_evaluations(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_assignments_active ON engineer_coach_assignments(is_active, engineer_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_engineers_lead ON engineers(lead_user_id);
CREATE INDEX IF NOT EXISTS idx_engineers_active ON engineers(is_active);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_evaluations_deleted_at ON evaluations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_evaluations_date_deleted ON evaluations(evaluation_date, deleted_at);
CREATE INDEX IF NOT EXISTS idx_case_evaluations_deleted_at ON case_evaluations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(is_manager);
CREATE INDEX IF NOT EXISTS idx_manager_assignments ON manager_assignments(manager_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_deleted_at ON manager_assignments(deleted_at);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluations_unique_engineer_month 
ON evaluations(engineer_id, strftime('%Y-%m', evaluation_date)) 
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_evaluations_unique_case_id 
ON case_evaluations(evaluation_id, case_id) 
WHERE deleted_at IS NULL AND case_id IS NOT NULL;

-- Triggers to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_evaluations_timestamp 
    AFTER UPDATE ON evaluations
    BEGIN
        UPDATE evaluations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;