import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { apiCounter } from './stores/apiCounter';
import type {
    User,
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UpdateUserRolesRequest,
    ApiError,
    Engineer,
    CoachAssignment,
    Evaluation,
    CaseEvaluation,
    CreateEngineerRequest,
    CreateAssignmentRequest,
    CreateEvaluationRequest,
    CreateCaseEvaluationRequest,
    UpdateCaseEvaluationRequest,
    EvaluationStats,
    ReportFilters,
    DashboardOverview,
    ExcelImportPreview,
    ExcelImportResult,
    ExcelImportRequest,
    ManagerAssignment
} from './types';

class ApiService {
    private api: AxiosInstance;
    private baseURL: string;

    constructor() {
        // Dynamically determine the backend URL based on how frontend is accessed
        this.baseURL = this.getBackendUrl();

        this.api = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Add request interceptor to include auth token and count API calls
        this.api.interceptors.request.use((config) => {
            if (browser) {
                const token = localStorage.getItem('auth_token');
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                // Count API call
                const route = `${config.method?.toUpperCase()} ${config.url}`;
                apiCounter.increment(route);
            }
            return config;
        });

        // Add response interceptor to handle auth errors
        this.api.interceptors.response.use(
            (response) => response,
            (error) => {
                // Handle rate limiting errors
                if (error.response?.status === 429) {
                    const message = error.response?.data?.error || 'Too many requests. Please wait a moment and try again.';
                    console.warn('Rate limit exceeded:', message);
                    // Don't redirect on rate limit, just let the error bubble up
                    return Promise.reject(new Error(message));
                }

                // Only redirect to login on 401 (Unauthorized), not 403 (Forbidden)
                if (error.response?.status === 401) {
                    if (browser) {
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('user');

                        // Prevent infinite redirects - only redirect if not already on login page
                        const currentPath = window.location.pathname;
                        if (currentPath !== '/login') {
                            window.location.href = '/login';
                        }
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    // Authentication methods
    async login(credentials: LoginRequest): Promise<AuthResponse> {
        const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/login', credentials);

        if (browser && response.data.token) {
            localStorage.setItem('auth_token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }

        return response.data;
    }

    async register(userData: RegisterRequest): Promise<AuthResponse> {
        const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/register', userData);

        if (browser && response.data.token) {
            localStorage.setItem('auth_token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }

        return response.data;
    }

    async logout(): Promise<void> {
        try {
            await this.api.post('/auth/logout');
        } finally {
            if (browser) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
            }
        }
    }

    async getCurrentUser(): Promise<{ user: User }> {
        const response: AxiosResponse<{ user: User }> = await this.api.get('/auth/me');
        return response.data;
    }

    // User management methods (admin only)
    async getAllUsers(): Promise<{ users: User[] }> {
        const response: AxiosResponse<{ users: User[] }> = await this.api.get('/auth/users');
        return response.data;
    }

    async updateUserRoles(userId: number, roles: UpdateUserRolesRequest): Promise<{ user: User; message: string }> {
        const response: AxiosResponse<{ user: User; message: string }> = await this.api.put(`/auth/users/${userId}/roles`, roles);
        return response.data;
    }

    async deleteUser(userId: number): Promise<{ message: string }> {
        const response = await this.api.delete(`/admin/users/${userId}`);
        return response.data;
    }

    // Add changeUserPassword method to API service
    async changeUserPassword(userId: number, password: string): Promise<{ message: string }> {
        const response = await this.api.post(
            `/auth/users/${userId}/password`,
            { newPassword: password }
        );
        return response.data;
    }

    // Manager assignment methods
    async getAllManagerAssignments(): Promise<{ assignments: ManagerAssignment[] }> {
        const response = await this.api.get('/admin/managers/assignments');
        return response.data;
    }

    async getUsersForManager(managerId: number): Promise<{ users: User[] }> {
        const response = await this.api.get(`/admin/managers/${managerId}/users`);
        return response.data;
    }

    async getManagerForUser(userId: number): Promise<{ manager: User | null }> {
        const response = await this.api.get(`/admin/users/${userId}/manager`);
        return response.data;
    }

    async assignManagerToUser(managerId: number, userId: number): Promise<{ message: string }> {
        const response = await this.api.post(`/admin/managers/assign`, { manager_id: managerId, assigned_to: userId });
        return response.data;
    }

    async removeManagerFromUser(managerId: number, userId: number): Promise<{ message: string }> {
        const response = await this.api.post(`/admin/managers/remove`, { manager_id: managerId, assigned_to: userId });
        return response.data;
    }

    // Utility methods
    getStoredToken(): string | null {
        if (!browser) return null;
        return localStorage.getItem('auth_token');
    }

    getStoredUser(): User | null {
        if (!browser) return null;
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }

    isAuthenticated(): boolean {
        return !!this.getStoredToken();
    }

    // Engineer management methods
    async getAllEngineers(filters?: any): Promise<{ engineers: Engineer[] }> {
        const params = new URLSearchParams();
        if (filters) {
            Object.keys(filters).forEach(key => {
                if (filters[key] !== undefined && filters[key] !== '') {
                    params.append(key, filters[key].toString());
                }
            });
        }

        const url = `/engineers${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await this.api.get(url);
        return response.data;
    }

    async getEngineersForEvaluation(): Promise<{ engineers: Engineer[] }> {
        const response = await this.api.get('/engineers/for-evaluation');
        return response.data;
    }

    async getEngineersByCoach(coachId: number): Promise<{ engineers: Engineer[] }> {
        const response = await this.api.get(`/engineers/by-coach/${coachId}`);
        return response.data;
    }

    async getEngineersByLead(leadId: number): Promise<{ engineers: Engineer[] }> {
        const response = await this.api.get(`/engineers/by-lead/${leadId}`);
        return response.data;
    }

    async searchEngineers(searchTerm: string, leadId?: number): Promise<{ engineers: Engineer[] }> {
        const params = new URLSearchParams({ q: searchTerm });
        if (leadId) params.append('lead_id', leadId.toString());

        const response: AxiosResponse<{ engineers: Engineer[] }> = await this.api.get(`/engineers/search?${params}`);
        return response.data;
    }

    async getEngineerById(id: number): Promise<{ engineer: Engineer }> {
        const response: AxiosResponse<{ engineer: Engineer }> = await this.api.get(`/engineers/${id}`);
        return response.data;
    }

    async createEngineer(engineerData: CreateEngineerRequest): Promise<{ engineer: Engineer; message: string }> {
        const response: AxiosResponse<{ engineer: Engineer; message: string }> = await this.api.post('/engineers', engineerData);
        return response.data;
    }

    async updateEngineer(id: number, updateData: Partial<Engineer>): Promise<{ engineer: Engineer; message: string }> {
        const response: AxiosResponse<{ engineer: Engineer; message: string }> = await this.api.put(`/engineers/${id}`, updateData);
        return response.data;
    }

    // Coach assignment methods
    async getEngineerAssignments(engineerId: number): Promise<{ assignments: CoachAssignment[] }> {
        const response: AxiosResponse<{ assignments: CoachAssignment[] }> = await this.api.get(`/engineers/${engineerId}/assignments`);
        return response.data;
    }

    async createCoachAssignment(assignmentData: CreateAssignmentRequest): Promise<{ assignment: CoachAssignment; message: string }> {
        const response: AxiosResponse<{ assignment: CoachAssignment; message: string }> = await this.api.post('/engineers/assignments', assignmentData);
        return response.data;
    }

    async endCoachAssignment(assignmentId: number, endDate: string): Promise<{ assignment: CoachAssignment; message: string }> {
        const response: AxiosResponse<{ assignment: CoachAssignment; message: string }> = await this.api.put(`/engineers/assignments/${assignmentId}/end`, { end_date: endDate });
        return response.data;
    }

    // Evaluation methods
    async getAllEvaluations(filters?: {
        engineer_id?: number;
        coach_user_id?: number;
        lead_user_id?: number;
        engineer_ids?: number[];
        coach_user_ids?: number[];
        lead_user_ids?: number[];
        start_date?: string;
        end_date?: string;
        year?: number;
        years?: number[];
        month?: number;
        months?: number[];
    }): Promise<{ evaluations: Evaluation[] }> {
        const params = new URLSearchParams();

        // support array filters first
        if (filters?.engineer_ids?.length) filters.engineer_ids.forEach(id => params.append('engineer_ids', id.toString()));
        if (filters?.coach_user_ids?.length) filters.coach_user_ids.forEach(id => params.append('coach_user_ids', id.toString()));
        if (filters?.lead_user_ids?.length) filters.lead_user_ids.forEach(id => params.append('lead_user_ids', id.toString()));
        // backward-compatible single values
        if (filters?.engineer_id) params.append('engineer_id', filters.engineer_id.toString());
        if (filters?.coach_user_id) params.append('coach_user_id', filters.coach_user_id.toString());
        if (filters?.lead_user_id) params.append('lead_user_id', filters.lead_user_id.toString());

        if (filters?.start_date) params.append('start_date', filters.start_date);
        if (filters?.end_date) params.append('end_date', filters.end_date);
        // support array and single year/month
        if (filters?.years?.length) filters.years.forEach(y => params.append('years', y.toString()));
        if (filters?.year) params.append('year', filters.year.toString());
        if (filters?.months?.length) filters.months.forEach(m => params.append('months', m.toString()));
        if (filters?.month) params.append('month', filters.month.toString());

        const queryString = params.toString();
        const url = queryString ? `/evaluations?${queryString}` : '/evaluations';

        const response: AxiosResponse<{ evaluations: Evaluation[] }> = await this.api.get(url);
        return response.data;
    }

    async getEvaluationById(id: number): Promise<{ evaluation: Evaluation }> {
        const response: AxiosResponse<{ evaluation: Evaluation }> = await this.api.get(`/evaluations/${id}`);
        return response.data;
    }

    async createEvaluation(evaluationData: CreateEvaluationRequest): Promise<{ evaluation: Evaluation; message: string }> {
        const response: AxiosResponse<{ evaluation: Evaluation; message: string }> = await this.api.post('/evaluations', evaluationData);
        return response.data;
    }

    async updateEvaluation(id: number, updateData: { evaluation_date?: string }): Promise<{ evaluation: Evaluation; message: string }> {
        const response: AxiosResponse<{ evaluation: Evaluation; message: string }> = await this.api.put(`/evaluations/${id}`, updateData);
        return response.data;
    }

    async deleteEvaluation(id: number): Promise<{ message: string }> {
        const response: AxiosResponse<{ message: string }> = await this.api.delete(`/evaluations/${id}`);
        return response.data;
    }

    // Case evaluation methods
    async addCaseToEvaluation(evaluationId: number, caseData: CreateCaseEvaluationRequest): Promise<{ case: CaseEvaluation; message: string }> {
        const response: AxiosResponse<{ case: CaseEvaluation; message: string }> = await this.api.post(`/evaluations/${evaluationId}/cases`, caseData);
        return response.data;
    }

    async updateCaseEvaluation(caseId: number, updateData: UpdateCaseEvaluationRequest): Promise<{ case: CaseEvaluation; message: string }> {
        const response: AxiosResponse<{ case: CaseEvaluation; message: string }> = await this.api.put(`/evaluations/cases/${caseId}`, updateData);
        return response.data;
    }

    async deleteCaseEvaluation(caseId: number): Promise<{ message: string }> {
        const response: AxiosResponse<{ message: string }> = await this.api.delete(`/evaluations/cases/${caseId}`);
        return response.data;
    }

    async checkCaseIdExists(caseId: string): Promise<{ exists: boolean; evaluation?: any }> {
        const response: AxiosResponse<{ exists: boolean; evaluation?: any }> = await this.api.get(`/evaluations/cases/check/${encodeURIComponent(caseId)}`);
        return response.data;
    }

    // Reports methods
    async getEvaluationStats(filters?: ReportFilters): Promise<{ stats: EvaluationStats; filters: ReportFilters }> {
        const params = new URLSearchParams();
        if (filters?.engineer_id) params.append('engineer_id', filters.engineer_id.toString());
        if (filters?.engineer_ids && filters.engineer_ids.length > 0) {
            filters.engineer_ids.forEach(id => params.append('engineer_ids', id.toString()));
        }
        if (filters?.coach_user_id) params.append('coach_user_id', filters.coach_user_id.toString());
        if (filters?.lead_user_id) params.append('lead_user_id', filters.lead_user_id.toString());
        if (filters?.start_date) params.append('start_date', filters.start_date);
        if (filters?.end_date) params.append('end_date', filters.end_date);
        if (filters?.quarter) params.append('quarter', filters.quarter);
        if (filters?.year) params.append('year', filters.year.toString());

        const queryString = params.toString();
        const url = queryString ? `/reports/stats?${queryString}` : '/reports/stats';

        const response: AxiosResponse<{ stats: EvaluationStats; filters: ReportFilters }> = await this.api.get(url);
        return response.data;
    }

    async getTeamStats(filters?: { start_date?: string; end_date?: string; year?: number; quarter?: string }): Promise<{ stats: EvaluationStats; filters: ReportFilters }> {
        const params = new URLSearchParams();
        if (filters?.start_date) params.append('start_date', filters.start_date);
        if (filters?.end_date) params.append('end_date', filters.end_date);
        if (filters?.year) params.append('year', filters.year.toString());
        if (filters?.quarter) params.append('quarter', filters.quarter);

        const queryString = params.toString();
        const url = queryString ? `/reports/my-team?${queryString}` : '/reports/my-team';

        const response: AxiosResponse<{ stats: EvaluationStats; filters: ReportFilters }> = await this.api.get(url);
        return response.data;
    }

    async getEngineerStats(engineerId: number, filters?: { start_date?: string; end_date?: string; year?: number; quarter?: string }): Promise<{ stats: EvaluationStats; filters: ReportFilters; engineer_id: number }> {
        const params = new URLSearchParams();
        if (filters?.start_date) params.append('start_date', filters.start_date);
        if (filters?.end_date) params.append('end_date', filters.end_date);
        if (filters?.year) params.append('year', filters.year.toString());
        if (filters?.quarter) params.append('quarter', filters.quarter);

        const queryString = params.toString();
        const url = queryString ? `/reports/engineer/${engineerId}?${queryString}` : `/reports/engineer/${engineerId}`;

        const response: AxiosResponse<{ stats: EvaluationStats; filters: ReportFilters; engineer_id: number }> = await this.api.get(url);
        return response.data;
    }

    async getQuarterlyStats(year: number): Promise<{ year: number; quarterly_stats: Record<string, EvaluationStats> }> {
        const response: AxiosResponse<{ year: number; quarterly_stats: Record<string, EvaluationStats> }> = await this.api.get(`/reports/quarterly?year=${year}`);
        return response.data;
    }

    async getEngineersForReports(): Promise<{ engineers: Engineer[] }> {
        const response: AxiosResponse<{ engineers: Engineer[] }> = await this.api.get('/reports/engineers');
        return response.data;
    }

    async getEvaluationsForReports(filters?: ReportFilters): Promise<{ evaluations: Evaluation[]; filters: ReportFilters }> {
        const params = new URLSearchParams();
        if (filters?.engineer_id) params.append('engineer_id', filters.engineer_id.toString());
        if (filters?.coach_user_id) params.append('coach_user_id', filters.coach_user_id.toString());
        if (filters?.lead_user_id) params.append('lead_user_id', filters.lead_user_id.toString());
        if (filters?.start_date) params.append('start_date', filters.start_date);
        if (filters?.end_date) params.append('end_date', filters.end_date);
        if (filters?.quarter) params.append('quarter', filters.quarter);
        if (filters?.year) params.append('year', filters.year.toString());

        const queryString = params.toString();
        const url = queryString ? `/reports/evaluations?${queryString}` : '/reports/evaluations';

        const response: AxiosResponse<{ evaluations: Evaluation[]; filters: ReportFilters }> = await this.api.get(url);
        return response.data;
    }

    async getBatchStats(filters: ReportFilters & { engineer_ids?: number[] }): Promise<{
        overall_stats: EvaluationStats;
        quarterly_stats: Record<string, EvaluationStats>;
        individual_stats: Record<string, EvaluationStats>;
        monthly_data: Record<string, any[]>;
    }> {
        const params = new URLSearchParams();
        if (filters.year) params.append('year', filters.year.toString());
        if (filters.quarter) params.append('quarter', filters.quarter);
        if (filters.start_date) params.append('start_date', filters.start_date);
        if (filters.end_date) params.append('end_date', filters.end_date);
        if (filters.engineer_ids?.length) {
            params.append('engineer_ids', filters.engineer_ids.join(','));
        }

        const response = await this.api.get(`/reports/batch-stats?${params.toString()}`);
        return response.data;
    }

    // Dashboard methods
    async getDashboardOverview(): Promise<{ overview: DashboardOverview }> {
        const response: AxiosResponse<{ overview: DashboardOverview }> = await this.api.get('/dashboard/overview');
        return response.data;
    }

    // Health check
    async healthCheck(): Promise<{ status: string; database: string; timestamp: string }> {
        const response = await this.api.get('/health');
        return response.data;
    }

    // Database management methods (admin only)
    async getDatabaseStatus(): Promise<{ status: string; path: string; size: number; lastModified: string; timestamp: string }> {
        const response = await this.api.get('/admin/database/status');
        return response.data;
    }

    async createDatabaseBackup(): Promise<{ message: string; backupPath: string; size: number; timestamp: string }> {
        const response = await this.api.post('/admin/database/backup');
        return response.data;
    }

    async getDatabaseBackups(): Promise<{ backups: Array<{ filename: string; path: string; size: number; created: string }> }> {
        const response = await this.api.get('/admin/database/backups');
        return response.data;
    }

    async getDatabaseSchema(): Promise<{ tables: any[]; indexes: any[]; triggers: any[]; timestamp: string }> {
        const response = await this.api.get('/admin/database/schema');
        return response.data;
    }

    async getDatabaseMigrations(): Promise<{ migrations: Array<{ filename: string; path: string; size: number; modified: string; content: string; type: string }> }> {
        const response = await this.api.get('/admin/database/migrations');
        return response.data;
    }

    async executeSql(sql: string, confirmDangerous?: boolean): Promise<{ message: string; result: any; timestamp: string }> {
        const response = await this.api.post('/admin/database/execute-sql', { sql, confirmDangerous });
        return response.data;
    }

    async changeDatabasePath(newDbPath: string): Promise<{ message: string; newPath: string; status: string; size: number; lastModified: string; timestamp: string }> {
        const response: AxiosResponse<{ message: string; newPath: string; status: string; size: number; lastModified: string; timestamp: string }> = await this.api.post('/debug/database/change-path', { db_path: newDbPath });
        return response.data;
    }

    // Excel Import methods
    async importExcelPreview(file: File, year: number, importAsRole?: 'coach' | 'admin'): Promise<{ success: boolean; preview: ExcelImportPreview; message: string }> {
        const formData = new FormData();
        formData.append('excel_file', file);
        formData.append('year', year.toString());
        if (importAsRole) {
            formData.append('import_as_role', importAsRole);
        }

        const response: AxiosResponse<{ success: boolean; preview: ExcelImportPreview; message: string }> = await this.api.post('/evaluations/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }

    async importExcelData(file: File, year: number, coachSelections: Record<string, number>, importAsRole?: 'coach' | 'admin'): Promise<{ success: boolean; result: ExcelImportResult; message: string }> {
        const formData = new FormData();
        formData.append('excel_file', file);
        formData.append('year', year.toString());
        formData.append('coach_selections', JSON.stringify(coachSelections));
        if (importAsRole) {
            formData.append('import_as_role', importAsRole);
        }

        const response: AxiosResponse<{ success: boolean; result: ExcelImportResult; message: string }> = await this.api.post('/evaluations/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }

    // Cache utilities for reports
    getCachedReportData(cacheKey: string): any | null {
        if (!browser) return null;
        const cached = localStorage.getItem(`report_cache_${cacheKey}`);
        if (!cached) return null;

        try {
            const data = JSON.parse(cached);
            // Check if cache is older than 30 minutes
            const now = Date.now();
            if (now - data.timestamp > 30 * 60 * 1000) {
                localStorage.removeItem(`report_cache_${cacheKey}`);
                return null;
            }
            return data.data;
        } catch {
            localStorage.removeItem(`report_cache_${cacheKey}`);
            return null;
        }
    }

    setCachedReportData(cacheKey: string, data: any): void {
        if (!browser) return;
        const cacheData = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(`report_cache_${cacheKey}`, JSON.stringify(cacheData));
    }

    clearReportCache(): void {
        if (!browser) return;
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('report_cache_')) {
                localStorage.removeItem(key);
            }
        });
    }

    private getBackendUrl(): string {
        // Use environment variable if available
        if (env.PUBLIC_API_URL) {
            return env.PUBLIC_API_URL;
        }

        // In browser, dynamically determine based on current window location
        if (browser && typeof window !== 'undefined') {
            const { protocol, hostname } = window.location;
            // Use the same protocol and hostname as the frontend, but port 3000 for backend
            return `${protocol}//${hostname}:3000/api`;
        }

        // Fallback for SSR or when window is not available
        return 'http://localhost:3000/api';
    }
}

// Create singleton instance
export const apiService = new ApiService();
export default apiService; 