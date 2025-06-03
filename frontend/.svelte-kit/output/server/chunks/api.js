import axios from "axios";
import { p as public_env } from "./shared-server.js";
import { w as writable } from "./index.js";
function createAPICounterStore() {
  const { subscribe, update } = writable({
    count: 0,
    calls: []
  });
  return {
    subscribe,
    increment: (route) => {
      update((store) => {
        const call = {
          route,
          timestamp: Date.now()
        };
        console.log(`API Call #${store.count + 1}: ${route}`);
        return {
          count: store.count + 1,
          calls: [...store.calls, call]
        };
      });
    },
    reset: () => {
      update(() => ({
        count: 0,
        calls: []
      }));
    }
  };
}
createAPICounterStore();
class ApiService {
  api;
  baseURL;
  constructor() {
    this.baseURL = this.getBackendUrl();
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json"
      }
    });
    this.api.interceptors.request.use((config) => {
      return config;
    });
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          const message = error.response?.data?.error || "Too many requests. Please wait a moment and try again.";
          console.warn("Rate limit exceeded:", message);
          return Promise.reject(new Error(message));
        }
        if (error.response?.status === 401) ;
        return Promise.reject(error);
      }
    );
  }
  // Authentication methods
  async login(credentials) {
    const response = await this.api.post("/auth/login", credentials);
    return response.data;
  }
  async register(userData) {
    const response = await this.api.post("/auth/register", userData);
    return response.data;
  }
  async logout() {
    try {
      await this.api.post("/auth/logout");
    } finally {
    }
  }
  async getCurrentUser() {
    const response = await this.api.get("/auth/me");
    return response.data;
  }
  // User management methods (admin only)
  async getAllUsers() {
    const response = await this.api.get("/auth/users");
    return response.data;
  }
  async updateUserRoles(userId, roles) {
    const response = await this.api.put(`/auth/users/${userId}/roles`, roles);
    return response.data;
  }
  async deleteUser(userId) {
    const response = await this.api.delete(`/admin/users/${userId}`);
    return response.data;
  }
  // Add changeUserPassword method to API service
  async changeUserPassword(userId, password) {
    const response = await this.api.post(
      `/auth/users/${userId}/password`,
      { newPassword: password }
    );
    return response.data;
  }
  // Manager assignment methods
  async getAllManagerAssignments() {
    const response = await this.api.get("/admin/managers/assignments");
    return response.data;
  }
  async getUsersForManager(managerId) {
    const response = await this.api.get(`/admin/managers/${managerId}/users`);
    return response.data;
  }
  async getManagerForUser(userId) {
    const response = await this.api.get(`/admin/users/${userId}/manager`);
    return response.data;
  }
  async assignManagerToUser(managerId, userId) {
    const response = await this.api.post(`/admin/managers/assign`, { manager_id: managerId, assigned_to: userId });
    return response.data;
  }
  async removeManagerFromUser(managerId, userId) {
    const response = await this.api.post(`/admin/managers/remove`, { manager_id: managerId, assigned_to: userId });
    return response.data;
  }
  // Utility methods
  getStoredToken() {
    return null;
  }
  getStoredUser() {
    return null;
  }
  isAuthenticated() {
    return !!this.getStoredToken();
  }
  // Engineer management methods
  async getAllEngineers(filters) {
    const params = new URLSearchParams();
    if (filters) {
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== void 0 && filters[key] !== "") {
          params.append(key, filters[key].toString());
        }
      });
    }
    const url = `/engineers${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await this.api.get(url);
    return response.data;
  }
  async getEngineersForEvaluation() {
    const response = await this.api.get("/engineers/for-evaluation");
    return response.data;
  }
  async getEngineersByCoach(coachId) {
    const response = await this.api.get(`/engineers/by-coach/${coachId}`);
    return response.data;
  }
  async getEngineersByLead(leadId) {
    const response = await this.api.get(`/engineers/by-lead/${leadId}`);
    return response.data;
  }
  async searchEngineers(searchTerm, leadId) {
    const params = new URLSearchParams({ q: searchTerm });
    if (leadId) params.append("lead_id", leadId.toString());
    const response = await this.api.get(`/engineers/search?${params}`);
    return response.data;
  }
  async getEngineerById(id) {
    const response = await this.api.get(`/engineers/${id}`);
    return response.data;
  }
  async createEngineer(engineerData) {
    const response = await this.api.post("/engineers", engineerData);
    return response.data;
  }
  async updateEngineer(id, updateData) {
    const response = await this.api.put(`/engineers/${id}`, updateData);
    return response.data;
  }
  // Coach assignment methods
  async getEngineerAssignments(engineerId) {
    const response = await this.api.get(`/engineers/${engineerId}/assignments`);
    return response.data;
  }
  async createCoachAssignment(assignmentData) {
    const response = await this.api.post("/engineers/assignments", assignmentData);
    return response.data;
  }
  async endCoachAssignment(assignmentId, endDate) {
    const response = await this.api.put(`/engineers/assignments/${assignmentId}/end`, { end_date: endDate });
    return response.data;
  }
  // Evaluation methods
  async getAllEvaluations(filters) {
    const params = new URLSearchParams();
    if (filters?.engineer_ids?.length) filters.engineer_ids.forEach((id) => params.append("engineer_ids", id.toString()));
    if (filters?.coach_user_ids?.length) filters.coach_user_ids.forEach((id) => params.append("coach_user_ids", id.toString()));
    if (filters?.lead_user_ids?.length) filters.lead_user_ids.forEach((id) => params.append("lead_user_ids", id.toString()));
    if (filters?.engineer_id) params.append("engineer_id", filters.engineer_id.toString());
    if (filters?.coach_user_id) params.append("coach_user_id", filters.coach_user_id.toString());
    if (filters?.lead_user_id) params.append("lead_user_id", filters.lead_user_id.toString());
    if (filters?.start_date) params.append("start_date", filters.start_date);
    if (filters?.end_date) params.append("end_date", filters.end_date);
    if (filters?.years?.length) filters.years.forEach((y) => params.append("years", y.toString()));
    if (filters?.year) params.append("year", filters.year.toString());
    if (filters?.months?.length) filters.months.forEach((m) => params.append("months", m.toString()));
    if (filters?.month) params.append("month", filters.month.toString());
    const queryString = params.toString();
    const url = queryString ? `/evaluations?${queryString}` : "/evaluations";
    const response = await this.api.get(url);
    return response.data;
  }
  async getEvaluationById(id) {
    const response = await this.api.get(`/evaluations/${id}`);
    return response.data;
  }
  async createEvaluation(evaluationData) {
    const response = await this.api.post("/evaluations", evaluationData);
    return response.data;
  }
  async updateEvaluation(id, updateData) {
    const response = await this.api.put(`/evaluations/${id}`, updateData);
    return response.data;
  }
  async deleteEvaluation(id) {
    const response = await this.api.delete(`/evaluations/${id}`);
    return response.data;
  }
  // Case evaluation methods
  async addCaseToEvaluation(evaluationId, caseData) {
    const response = await this.api.post(`/evaluations/${evaluationId}/cases`, caseData);
    return response.data;
  }
  async updateCaseEvaluation(caseId, updateData) {
    const response = await this.api.put(`/evaluations/cases/${caseId}`, updateData);
    return response.data;
  }
  async deleteCaseEvaluation(caseId) {
    const response = await this.api.delete(`/evaluations/cases/${caseId}`);
    return response.data;
  }
  async checkCaseIdExists(caseId) {
    const response = await this.api.get(`/evaluations/cases/check/${encodeURIComponent(caseId)}`);
    return response.data;
  }
  // Reports methods
  async getEvaluationStats(filters) {
    const params = new URLSearchParams();
    if (filters?.engineer_id) params.append("engineer_id", filters.engineer_id.toString());
    if (filters?.engineer_ids && filters.engineer_ids.length > 0) {
      filters.engineer_ids.forEach((id) => params.append("engineer_ids", id.toString()));
    }
    if (filters?.coach_user_id) params.append("coach_user_id", filters.coach_user_id.toString());
    if (filters?.lead_user_id) params.append("lead_user_id", filters.lead_user_id.toString());
    if (filters?.start_date) params.append("start_date", filters.start_date);
    if (filters?.end_date) params.append("end_date", filters.end_date);
    if (filters?.quarter) params.append("quarter", filters.quarter);
    if (filters?.year) params.append("year", filters.year.toString());
    const queryString = params.toString();
    const url = queryString ? `/reports/stats?${queryString}` : "/reports/stats";
    const response = await this.api.get(url);
    return response.data;
  }
  async getTeamStats(filters) {
    const params = new URLSearchParams();
    if (filters?.start_date) params.append("start_date", filters.start_date);
    if (filters?.end_date) params.append("end_date", filters.end_date);
    if (filters?.year) params.append("year", filters.year.toString());
    if (filters?.quarter) params.append("quarter", filters.quarter);
    const queryString = params.toString();
    const url = queryString ? `/reports/my-team?${queryString}` : "/reports/my-team";
    const response = await this.api.get(url);
    return response.data;
  }
  async getEngineerStats(engineerId, filters) {
    const params = new URLSearchParams();
    if (filters?.start_date) params.append("start_date", filters.start_date);
    if (filters?.end_date) params.append("end_date", filters.end_date);
    if (filters?.year) params.append("year", filters.year.toString());
    if (filters?.quarter) params.append("quarter", filters.quarter);
    const queryString = params.toString();
    const url = queryString ? `/reports/engineer/${engineerId}?${queryString}` : `/reports/engineer/${engineerId}`;
    const response = await this.api.get(url);
    return response.data;
  }
  async getQuarterlyStats(year) {
    const response = await this.api.get(`/reports/quarterly?year=${year}`);
    return response.data;
  }
  async getEngineersForReports() {
    const response = await this.api.get("/reports/engineers");
    return response.data;
  }
  async getEvaluationsForReports(filters) {
    const params = new URLSearchParams();
    if (filters?.engineer_id) params.append("engineer_id", filters.engineer_id.toString());
    if (filters?.coach_user_id) params.append("coach_user_id", filters.coach_user_id.toString());
    if (filters?.lead_user_id) params.append("lead_user_id", filters.lead_user_id.toString());
    if (filters?.start_date) params.append("start_date", filters.start_date);
    if (filters?.end_date) params.append("end_date", filters.end_date);
    if (filters?.quarter) params.append("quarter", filters.quarter);
    if (filters?.year) params.append("year", filters.year.toString());
    const queryString = params.toString();
    const url = queryString ? `/reports/evaluations?${queryString}` : "/reports/evaluations";
    const response = await this.api.get(url);
    return response.data;
  }
  async getBatchStats(filters) {
    const params = new URLSearchParams();
    if (filters.year) params.append("year", filters.year.toString());
    if (filters.quarter) params.append("quarter", filters.quarter);
    if (filters.start_date) params.append("start_date", filters.start_date);
    if (filters.end_date) params.append("end_date", filters.end_date);
    if (filters.engineer_ids?.length) {
      params.append("engineer_ids", filters.engineer_ids.join(","));
    }
    const response = await this.api.get(`/reports/batch-stats?${params.toString()}`);
    return response.data;
  }
  // Dashboard methods
  async getDashboardOverview() {
    const response = await this.api.get("/dashboard/overview");
    return response.data;
  }
  // Health check
  async healthCheck() {
    const response = await this.api.get("/health");
    return response.data;
  }
  // Database management methods (admin only)
  async getDatabaseStatus() {
    const response = await this.api.get("/admin/database/status");
    return response.data;
  }
  async createDatabaseBackup() {
    const response = await this.api.post("/admin/database/backup");
    return response.data;
  }
  async getDatabaseBackups() {
    const response = await this.api.get("/admin/database/backups");
    return response.data;
  }
  async getDatabaseSchema() {
    const response = await this.api.get("/admin/database/schema");
    return response.data;
  }
  async getDatabaseMigrations() {
    const response = await this.api.get("/admin/database/migrations");
    return response.data;
  }
  async executeSql(sql, confirmDangerous) {
    const response = await this.api.post("/admin/database/execute-sql", { sql, confirmDangerous });
    return response.data;
  }
  async changeDatabasePath(newDbPath) {
    const response = await this.api.post("/debug/database/change-path", { db_path: newDbPath });
    return response.data;
  }
  // Excel Import methods
  async importExcelPreview(file, year, importAsRole) {
    const formData = new FormData();
    formData.append("excel_file", file);
    formData.append("year", year.toString());
    if (importAsRole) {
      formData.append("import_as_role", importAsRole);
    }
    const response = await this.api.post("/evaluations/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return response.data;
  }
  async importExcelData(file, year, coachSelections, importAsRole) {
    const formData = new FormData();
    formData.append("excel_file", file);
    formData.append("year", year.toString());
    formData.append("coach_selections", JSON.stringify(coachSelections));
    if (importAsRole) {
      formData.append("import_as_role", importAsRole);
    }
    const response = await this.api.post("/evaluations/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return response.data;
  }
  // Cache utilities for reports
  getCachedReportData(cacheKey) {
    return null;
  }
  setCachedReportData(cacheKey, data) {
    return;
  }
  clearReportCache() {
    return;
  }
  getBackendUrl() {
    if (public_env.PUBLIC_API_URL) {
      return public_env.PUBLIC_API_URL;
    }
    return "http://localhost:3000/api";
  }
}
const apiService = new ApiService();
export {
  apiService as a
};
