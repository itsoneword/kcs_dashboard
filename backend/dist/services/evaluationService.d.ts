import { Evaluation, CreateEvaluationRequest, UpdateEvaluationRequest, CaseEvaluation, CreateCaseEvaluationRequest, UpdateCaseEvaluationRequest, EvaluationStats, ReportFilters } from '../types';
declare class EvaluationService {
    getAllEvaluations(filters?: {
        engineerId?: number;
        engineerIds?: number[];
        coachUserId?: number;
        coachUserIds?: number[];
        leadUserId?: number;
        leadUserIds?: number[];
        startDate?: string;
        endDate?: string;
        year?: number;
        years?: number[];
        month?: number;
        months?: number[];
    }): Evaluation[];
    getEvaluationById(id: number): Evaluation | null;
    createEvaluation(evaluationData: CreateEvaluationRequest, createdBy: number): Evaluation;
    updateEvaluation(id: number, updateData: UpdateEvaluationRequest, updatedBy: number): Evaluation;
    deleteEvaluation(id: number, deletedBy: number): void;
    getEvaluationsByCoach(coachUserId: number): Evaluation[];
    getEvaluationsByLead(leadUserId: number): Evaluation[];
    getCasesByEvaluationId(evaluationId: number): CaseEvaluation[];
    private createDefaultCases;
    addCase(evaluationId: number, caseData: CreateCaseEvaluationRequest): CaseEvaluation;
    updateCase(caseId: number, updateData: UpdateCaseEvaluationRequest): CaseEvaluation;
    deleteCase(caseId: number): void;
    getCaseById(id: number): CaseEvaluation | null;
    getEmptyCases(evaluationId: number): CaseEvaluation[];
    checkCaseIdExists(caseId: string): {
        exists: boolean;
        evaluation?: any;
    } | null;
    generateStats(filters: ReportFilters): EvaluationStats;
}
declare const _default: EvaluationService;
export default _default;
//# sourceMappingURL=evaluationService.d.ts.map