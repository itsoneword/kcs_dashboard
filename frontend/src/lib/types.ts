export interface User {
    id: number;
    ms_user_id?: string;
    email: string;
    name: string;
    is_coach: boolean;
    is_lead: boolean;
    is_admin: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}

export interface Engineer {
    id: number;
    name: string;
    lead_user_id: number | null;
    is_active: boolean;
    created_at: string;
    lead_name?: string;
    coach_name?: string;
}

export interface CoachAssignment {
    id: number;
    engineer_id: number;
    coach_user_id: number;
    start_date: string;
    end_date: string | null;
    is_active: boolean;
    created_at: string;
    engineer_name?: string;
    coach_name?: string;
}

export interface Evaluation {
    id: number;
    engineer_id: number;
    coach_user_id: number;
    evaluation_date: string;
    created_by: number;
    created_at: string;
    updated_at: string;
    updated_by: number;
    engineer_name?: string;
    coach_name?: string;
    lead_name?: string;
    case_count?: number;
    cases?: CaseEvaluation[];
}

export interface CaseEvaluation {
    id: number;
    evaluation_id: number;
    case_number: number;
    case_id: string | null;
    kb_potential: boolean;
    article_linked: boolean;
    article_improved: boolean;
    improvement_opportunity: boolean;
    article_created: boolean;
    create_opportunity: boolean;
    relevant_link: boolean;
    notes: string | null;
    created_at: string;
    deleted_at?: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
}

export interface AuthResponse {
    message: string;
    user: User;
    token: string;
}

export interface ApiError {
    error: string;
}

export interface UpdateUserRolesRequest {
    is_coach?: boolean;
    is_lead?: boolean;
    is_admin?: boolean;
}

export interface CreateEngineerRequest {
    name: string;
    lead_user_id?: number;
}

export interface CreateAssignmentRequest {
    engineer_id: number;
    coach_user_id: number;
    start_date: string;
}

export interface CreateEvaluationRequest {
    engineer_id: number;
    evaluation_date: string;
}

export interface CreateCaseEvaluationRequest {
    case_id?: string;
    kb_potential?: boolean;
    article_linked?: boolean;
    article_improved?: boolean;
    improvement_opportunity?: boolean;
    article_created?: boolean;
    create_opportunity?: boolean;
    relevant_link?: boolean;
    notes?: string;
}

export interface UpdateCaseEvaluationRequest {
    case_id?: string;
    kb_potential?: boolean;
    article_linked?: boolean;
    article_improved?: boolean;
    improvement_opportunity?: boolean;
    article_created?: boolean;
    create_opportunity?: boolean;
    relevant_link?: boolean;
    notes?: string;
}

export interface EvaluationStats {
    total_evaluations: number;
    total_cases: number;
    evaluated_cases: number;
    kb_potential_count: number;
    article_linked_count: number;
    article_improved_count: number;
    improvement_opportunity_count: number;
    article_created_count: number;
    create_opportunity_count: number;
    relevant_link_count: number;
    kb_potential_percentage: number;
    article_linked_percentage: number;
    article_improved_percentage: number;
    improvement_opportunity_percentage: number;
    article_created_percentage: number;
    create_opportunity_percentage: number;
    relevant_link_percentage: number;
}

export interface ReportFilters {
    engineer_id?: number;
    engineer_ids?: number[];
    coach_user_id?: number;
    lead_user_id?: number;
    start_date?: string;
    end_date?: string;
    quarter?: string;
    year?: number;
}

export interface DashboardOverview {
    total_evaluations: number;
    this_month_evaluations: number;
    total_engineers: number;
    total_coaches: number;
    current_month: string;
}

// Excel Import Types
export interface ExcelImportCase {
    case_number: number;
    quarter: string;
    month: string | null;
    notes: string | null;
    parameters: Record<string, boolean | null>;
}

export interface ExcelImportEngineer {
    name: string;
    coach_name: string | null;
    evaluations: {
        quarter: string;
        cases: ExcelImportCase[];
    }[];
}

export interface ExcelImportConflict {
    engineer_name: string;
    current_coach: string;
    excel_coach: string | null;
    action: 'skip' | 'reassign' | 'manual';
}

export interface ExcelImportPreview {
    engineers: ExcelImportEngineer[];
    conflicts: ExcelImportConflict[];
    metadata: {
        coach_name: string | null;
        total_cases: number;
        quarters_found: string[];
        file_name: string;
    };
    errors: string[];
    missing_coaches: {
        engineer_name: string;
        excel_coach_name: string | null;
        suggested_action: 'assign_to_importer' | 'manual_select';
    }[];
    coach_ownership_warning: {
        detected_coach: string;
        importing_user: string;
        should_block_import: boolean;
    } | null;
}

export interface ExcelImportResult {
    success: boolean;
    imported_engineers: number;
    imported_evaluations: number;
    imported_cases: number;
    skipped_engineers: string[];
    errors: string[];
}

export interface ExcelImportRequest {
    year: number;
    import_as_role?: 'coach' | 'admin';
    coach_selections?: Record<string, number>; // engineer_name -> coach_user_id
} 