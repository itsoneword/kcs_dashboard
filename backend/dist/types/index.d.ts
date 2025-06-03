import { Request } from 'express';
export interface User {
    id: number;
    ms_user_id?: string;
    email: string;
    password_hash?: string;
    name: string;
    is_coach: boolean;
    is_lead: boolean;
    is_admin: boolean;
    is_manager: boolean;
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
export interface EngineerCoachAssignment {
    id: number;
    engineer_id: number;
    coach_user_id: number;
    start_date: string;
    end_date?: string;
    is_active: boolean;
    created_at: string;
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
export interface AuthRequest extends Request {
    user?: User;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface CreateUserRequest {
    email: string;
    password: string;
    name: string;
    role?: 'coach' | 'lead' | 'manager';
}
export interface UpdateUserRolesRequest {
    is_coach?: boolean;
    is_lead?: boolean;
    is_admin?: boolean;
    is_manager?: boolean;
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
export interface UpdateEvaluationRequest {
    evaluation_date?: string;
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
export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    userId?: number;
    action?: string;
    targetId?: number;
    targetType?: string;
    details?: any;
}
export interface UpdateEngineerRequest {
    name?: string;
    lead_user_id?: number;
    is_active?: boolean;
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
export interface CreateCoachAssignmentRequest {
    engineer_id: number;
    coach_user_id: number;
    start_date: string;
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
    link_rate: number;
    average_score: number;
}
export interface ReportFilters {
    engineer_id?: number;
    engineer_ids?: number[];
    coach_user_id?: number;
    coach_user_ids?: number[];
    lead_user_id?: number;
    lead_user_ids?: number[];
    start_date?: string;
    end_date?: string;
    quarter?: string;
    year?: number;
    years?: number[];
    month?: number;
    months?: number[];
}
//# sourceMappingURL=index.d.ts.map