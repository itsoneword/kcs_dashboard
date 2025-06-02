import Database from 'better-sqlite3';
import path from 'path';
import {
    Evaluation,
    CreateEvaluationRequest,
    UpdateEvaluationRequest,
    CaseEvaluation,
    CreateCaseEvaluationRequest,
    UpdateCaseEvaluationRequest,
    EvaluationStats,
    ReportFilters
} from '../types';
import logger from '../utils/logger';

const dbPath = path.join(__dirname, '../..', process.env.DATABASE_PATH || '../database/kcs_portal.db');
const db = new Database(dbPath);

class EvaluationService {
    // Get all evaluations with optional filtering
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
    }): Evaluation[] {
        try {
            let query = `
                SELECT 
                    ev.*,
                    e.name as engineer_name,
                    u.name as coach_name,
                    l.name as lead_name
                FROM evaluations ev
                INNER JOIN engineers e ON ev.engineer_id = e.id
                INNER JOIN users u ON ev.coach_user_id = u.id
                LEFT JOIN users l ON e.lead_user_id = l.id
                WHERE ev.deleted_at IS NULL
            `;
            const params: any[] = [];

            if (filters?.engineerIds?.length) {
                const placeholders = filters.engineerIds.map(() => '?').join(', ');
                query += ` AND ev.engineer_id IN (${placeholders})`;
                params.push(...filters.engineerIds);
            } else if (filters?.engineerId) {
                query += ' AND ev.engineer_id = ?';
                params.push(filters.engineerId);
            }

            if (filters?.coachUserIds?.length) {
                const placeholders = filters.coachUserIds.map(() => '?').join(', ');
                query += ` AND ev.coach_user_id IN (${placeholders})`;
                params.push(...filters.coachUserIds);
            } else if (filters?.coachUserId) {
                query += ' AND ev.coach_user_id = ?';
                params.push(filters.coachUserId);
            }

            if (filters?.leadUserIds?.length) {
                const placeholders = filters.leadUserIds.map(() => '?').join(', ');
                query += ` AND e.lead_user_id IN (${placeholders})`;
                params.push(...filters.leadUserIds);
            } else if (filters?.leadUserId) {
                query += ' AND e.lead_user_id = ?';
                params.push(filters.leadUserId);
            }

            if (filters?.startDate) {
                query += ' AND ev.evaluation_date >= ?';
                params.push(filters.startDate);
            }

            if (filters?.endDate) {
                query += ' AND ev.evaluation_date <= ?';
                params.push(filters.endDate);
            }

            if (filters?.year) {
                query += ' AND strftime(\'%Y\', ev.evaluation_date) = ?';
                params.push(filters.year.toString());
            }

            if (filters?.years?.length) {
                const placeholdersY = filters.years.map(() => '?').join(', ');
                query += ` AND strftime('%Y', ev.evaluation_date) IN (${placeholdersY})`;
                params.push(...filters.years.map(y => y.toString()));
            }

            if (filters?.month) {
                query += ' AND strftime(\'%m\', ev.evaluation_date) = ?';
                params.push(filters.month.toString().padStart(2, '0'));
            }

            if (filters?.months?.length) {
                const placeholdersM = filters.months.map(() => '?').join(', ');
                query += ` AND strftime('%m', ev.evaluation_date) IN (${placeholdersM})`;
                params.push(...filters.months.map(m => m.toString().padStart(2, '0')));
            }

            query += ' ORDER BY ev.evaluation_date DESC, e.name ASC';

            // Debug: log filters, SQL, and params
            // logger.debug('getAllEvaluations filters:', filters);
            // logger.debug('getAllEvaluations SQL:', query, 'params:', params);
            // console.log('getAllEvaluations filters:', filters);
            // console.log('getAllEvaluations SQL:', query, 'params:', params);

            const stmt = db.prepare(query);
            const evaluations = stmt.all(...params) as Evaluation[];

            // Add case count for each evaluation
            const caseCountStmt = db.prepare(`
                SELECT COUNT(*) as case_count 
                FROM case_evaluations 
                WHERE evaluation_id = ? AND case_id IS NOT NULL AND case_id != '' AND deleted_at IS NULL
            `);

            evaluations.forEach(evaluation => {
                const result = caseCountStmt.get(evaluation.id) as { case_count: number };
                evaluation.case_count = result.case_count;
            });

            return evaluations;
        } catch (error) {
            logger.error('Error getting evaluations:', error);
            throw new Error('Failed to get evaluations');
        }
    }

    // Get evaluation by ID with cases
    getEvaluationById(id: number): Evaluation | null {
        try {
            const stmt = db.prepare(`
                SELECT 
                    ev.*,
                    e.name as engineer_name,
                    u.name as coach_name
                FROM evaluations ev
                INNER JOIN engineers e ON ev.engineer_id = e.id
                INNER JOIN users u ON ev.coach_user_id = u.id
                WHERE ev.id = ? AND ev.deleted_at IS NULL
            `);

            const evaluation = stmt.get(id) as Evaluation | null;
            if (evaluation) {
                evaluation.cases = this.getCasesByEvaluationId(id);
            }

            return evaluation;
        } catch (error) {
            logger.error('Error getting evaluation by ID:', error);
            throw new Error('Failed to get evaluation');
        }
    }

    // Create new evaluation
    createEvaluation(evaluationData: CreateEvaluationRequest, createdBy: number): Evaluation {
        try {
            // Check if evaluation already exists for this engineer and month (excluding soft-deleted)
            const existingStmt = db.prepare(`
                SELECT id FROM evaluations 
                WHERE engineer_id = ? AND strftime('%Y-%m', evaluation_date) = strftime('%Y-%m', ?) AND deleted_at IS NULL
            `);
            const existing = existingStmt.get(evaluationData.engineer_id, evaluationData.evaluation_date);

            if (existing) {
                throw new Error('Evaluation already exists for this engineer and month');
            }

            // Get coach assignment for this engineer
            const coachStmt = db.prepare(`
                SELECT coach_user_id FROM engineer_coach_assignments 
                WHERE engineer_id = ? AND is_active = 1
                LIMIT 1
            `);
            const assignment = coachStmt.get(evaluationData.engineer_id) as { coach_user_id: number } | undefined;

            if (!assignment) {
                throw new Error('No active coach assignment found for this engineer');
            }

            const stmt = db.prepare(`
                INSERT INTO evaluations (engineer_id, coach_user_id, evaluation_date, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                evaluationData.engineer_id,
                assignment.coach_user_id,
                evaluationData.evaluation_date,
                createdBy,
                createdBy
            );

            // Create 7 default case evaluations
            this.createDefaultCases(result.lastInsertRowid as number);

            const newEvaluation = this.getEvaluationById(result.lastInsertRowid as number);
            if (!newEvaluation) {
                throw new Error('Failed to retrieve created evaluation');
            }

            logger.info(`Evaluation created: Engineer ${newEvaluation.engineer_name} for ${evaluationData.evaluation_date}`);
            return newEvaluation;
        } catch (error) {
            logger.error('Error creating evaluation:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to create evaluation');
        }
    }

    // Update evaluation
    updateEvaluation(id: number, updateData: UpdateEvaluationRequest, updatedBy: number): Evaluation {
        try {
            const existingEvaluation = this.getEvaluationById(id);
            if (!existingEvaluation) {
                throw new Error('Evaluation not found');
            }

            const updates: string[] = [];
            const params: any[] = [];

            if (updateData.evaluation_date !== undefined) {
                updates.push('evaluation_date = ?');
                params.push(updateData.evaluation_date);
            }

            if (updates.length === 0) {
                return existingEvaluation;
            }

            updates.push('updated_by = ?');
            params.push(updatedBy);
            params.push(id);

            const stmt = db.prepare(`
                UPDATE evaluations 
                SET ${updates.join(', ')}
                WHERE id = ?
            `);

            stmt.run(...params);

            const updatedEvaluation = this.getEvaluationById(id);
            if (!updatedEvaluation) {
                throw new Error('Failed to retrieve updated evaluation');
            }

            logger.info(`Evaluation updated: ID ${id} by user ${updatedBy}`);
            return updatedEvaluation;
        } catch (error) {
            logger.error('Error updating evaluation:', error);
            throw new Error('Failed to update evaluation');
        }
    }

    // Soft delete evaluation
    deleteEvaluation(id: number, deletedBy: number): void {
        try {
            const existingEvaluation = this.getEvaluationById(id);
            if (!existingEvaluation) {
                throw new Error('Evaluation not found');
            }

            const stmt = db.prepare(`
                UPDATE evaluations 
                SET deleted_at = CURRENT_TIMESTAMP, updated_by = ?
                WHERE id = ?
            `);

            stmt.run(deletedBy, id);

            logger.info(`Evaluation soft deleted: ID ${id} (Engineer: ${existingEvaluation.engineer_name}, Date: ${existingEvaluation.evaluation_date}) by user ${deletedBy}`);
        } catch (error) {
            logger.error('Error deleting evaluation:', error);
            throw new Error('Failed to delete evaluation');
        }
    }

    // Get evaluations by coach
    getEvaluationsByCoach(coachUserId: number): Evaluation[] {
        try {
            return this.getAllEvaluations({ coachUserId });
        } catch (error) {
            logger.error('Error getting evaluations by coach:', error);
            throw new Error('Failed to get evaluations by coach');
        }
    }

    // Get evaluations by lead (for engineers under their management)
    getEvaluationsByLead(leadUserId: number): Evaluation[] {
        try {
            const stmt = db.prepare(`
                SELECT 
                    ev.*,
                    e.name as engineer_name,
                    u.name as coach_name,
                    l.name as lead_name
                FROM evaluations ev
                INNER JOIN engineers e ON ev.engineer_id = e.id
                INNER JOIN users u ON ev.coach_user_id = u.id
                LEFT JOIN users l ON e.lead_user_id = l.id
                WHERE e.lead_user_id = ? AND ev.deleted_at IS NULL
                ORDER BY ev.evaluation_date DESC, e.name ASC
            `);
            const evaluations = stmt.all(leadUserId) as Evaluation[];

            // Add case count for each evaluation
            const caseCountStmt = db.prepare(`
                SELECT COUNT(*) as case_count 
                FROM case_evaluations 
                WHERE evaluation_id = ? AND case_id IS NOT NULL AND case_id != '' AND deleted_at IS NULL
            `);

            evaluations.forEach(evaluation => {
                const result = caseCountStmt.get(evaluation.id) as { case_count: number };
                evaluation.case_count = result.case_count;
            });

            return evaluations;
        } catch (error) {
            logger.error('Error getting evaluations by lead:', error);
            throw new Error('Failed to get evaluations by lead');
        }
    }

    // Case Evaluation Methods
    getCasesByEvaluationId(evaluationId: number): CaseEvaluation[] {
        try {
            const stmt = db.prepare(`
                SELECT * FROM case_evaluations 
                WHERE evaluation_id = ? AND deleted_at IS NULL
                ORDER BY case_number ASC
            `);
            return stmt.all(evaluationId) as CaseEvaluation[];
        } catch (error) {
            logger.error('Error getting cases by evaluation ID:', error);
            throw new Error('Failed to get cases');
        }
    }

    // Create default 7 cases for new evaluation
    private createDefaultCases(evaluationId: number): void {
        try {
            const stmt = db.prepare(`
                INSERT INTO case_evaluations (evaluation_id, case_number)
                VALUES (?, ?)
            `);

            for (let i = 1; i <= 7; i++) {
                stmt.run(evaluationId, i);
            }
        } catch (error) {
            logger.error('Error creating default cases:', error);
            throw new Error('Failed to create default cases');
        }
    }

    // Add new case to evaluation
    addCase(evaluationId: number, caseData: CreateCaseEvaluationRequest): CaseEvaluation {
        try {
            // Check if case_id already exists for this evaluation (excluding deleted cases)
            if (caseData.case_id) {
                const existingCaseStmt = db.prepare(`
                    SELECT id FROM case_evaluations 
                    WHERE evaluation_id = ? AND case_id = ? AND deleted_at IS NULL
                `);
                const existingCase = existingCaseStmt.get(evaluationId, caseData.case_id);

                if (existingCase) {
                    throw new Error('A case with this ID already exists in this evaluation');
                }
            }

            // Get the next case number by finding the highest case_number for this evaluation
            const maxCaseNumberStmt = db.prepare(`
                SELECT COALESCE(MAX(case_number), 0) as max_case_number 
                FROM case_evaluations 
                WHERE evaluation_id = ?
            `);
            const result = maxCaseNumberStmt.get(evaluationId) as { max_case_number: number };
            const nextCaseNumber = result.max_case_number + 1;

            const stmt = db.prepare(`
                INSERT INTO case_evaluations (
                    evaluation_id, case_number, case_id, kb_potential, article_linked,
                    article_improved, improvement_opportunity, article_created,
                    create_opportunity, relevant_link, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const insertResult = stmt.run(
                evaluationId,
                nextCaseNumber,
                caseData.case_id || null,
                caseData.kb_potential ? 1 : 0,
                caseData.article_linked ? 1 : 0,
                caseData.article_improved ? 1 : 0,
                caseData.improvement_opportunity ? 1 : 0,
                caseData.article_created ? 1 : 0,
                caseData.create_opportunity ? 1 : 0,
                caseData.relevant_link ? 1 : 0,
                caseData.notes || null
            );

            const newCase = this.getCaseById(insertResult.lastInsertRowid as number);
            if (!newCase) {
                throw new Error('Failed to retrieve created case');
            }

            logger.info(`Case added to evaluation ${evaluationId}: Case #${nextCaseNumber} (ID: ${caseData.case_id || 'none'})`);
            return newCase;
        } catch (error) {
            logger.error('Error adding case:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to add case');
        }
    }

    // Update case evaluation
    updateCase(caseId: number, updateData: UpdateCaseEvaluationRequest): CaseEvaluation {
        try {
            const existingCase = this.getCaseById(caseId);
            if (!existingCase) {
                throw new Error('Case not found');
            }

            const updates: string[] = [];
            const params: any[] = [];

            if (updateData.case_id !== undefined) {
                updates.push('case_id = ?');
                params.push(updateData.case_id);
            }

            if (updateData.kb_potential !== undefined) {
                updates.push('kb_potential = ?');
                params.push(updateData.kb_potential ? 1 : 0);
            }

            if (updateData.article_linked !== undefined) {
                updates.push('article_linked = ?');
                params.push(updateData.article_linked ? 1 : 0);
            }

            if (updateData.article_improved !== undefined) {
                updates.push('article_improved = ?');
                params.push(updateData.article_improved ? 1 : 0);
            }

            if (updateData.improvement_opportunity !== undefined) {
                updates.push('improvement_opportunity = ?');
                params.push(updateData.improvement_opportunity ? 1 : 0);
            }

            if (updateData.article_created !== undefined) {
                updates.push('article_created = ?');
                params.push(updateData.article_created ? 1 : 0);
            }

            if (updateData.create_opportunity !== undefined) {
                updates.push('create_opportunity = ?');
                params.push(updateData.create_opportunity ? 1 : 0);
            }

            if (updateData.relevant_link !== undefined) {
                updates.push('relevant_link = ?');
                params.push(updateData.relevant_link ? 1 : 0);
            }

            if (updateData.notes !== undefined) {
                updates.push('notes = ?');
                params.push(updateData.notes);
            }

            if (updates.length === 0) {
                return existingCase;
            }

            params.push(caseId);
            const stmt = db.prepare(`
                UPDATE case_evaluations 
                SET ${updates.join(', ')}
                WHERE id = ?
            `);

            stmt.run(...params);

            const updatedCase = this.getCaseById(caseId);
            if (!updatedCase) {
                throw new Error('Failed to retrieve updated case');
            }

            return updatedCase;
        } catch (error) {
            logger.error('Error updating case:', error);
            throw new Error('Failed to update case');
        }
    }

    // Soft delete case evaluation
    deleteCase(caseId: number): void {
        try {
            const existingCase = this.getCaseById(caseId);
            if (!existingCase) {
                throw new Error('Case not found');
            }

            if (existingCase.deleted_at) {
                throw new Error('Case is already deleted');
            }

            const stmt = db.prepare(`
                UPDATE case_evaluations 
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);

            stmt.run(caseId);

            logger.info(`Case soft deleted: ID ${caseId}`);
        } catch (error) {
            logger.error('Error deleting case:', error);
            throw new Error('Failed to delete case');
        }
    }

    // Get case by ID
    getCaseById(id: number): CaseEvaluation | null {
        try {
            const stmt = db.prepare('SELECT * FROM case_evaluations WHERE id = ?');
            return stmt.get(id) as CaseEvaluation | null;
        } catch (error) {
            logger.error('Error getting case by ID:', error);
            throw new Error('Failed to get case');
        }
    }

    // Get empty cases from evaluation (cases without case_id that can be populated)
    getEmptyCases(evaluationId: number): CaseEvaluation[] {
        try {
            const stmt = db.prepare(`
                SELECT * FROM case_evaluations 
                WHERE evaluation_id = ? AND (case_id IS NULL OR case_id = '') AND deleted_at IS NULL
                ORDER BY case_number ASC
            `);
            return stmt.all(evaluationId) as CaseEvaluation[];
        } catch (error) {
            logger.error('Error getting empty cases:', error);
            throw new Error('Failed to get empty cases');
        }
    }

    // Check if case ID exists in any evaluation (excluding deleted cases)
    checkCaseIdExists(caseId: string): { exists: boolean; evaluation?: any } | null {
        try {
            if (!caseId || caseId.trim() === '') {
                return { exists: false };
            }

            const stmt = db.prepare(`
                SELECT 
                    ce.id,
                    ce.evaluation_id,
                    ce.case_id,
                    ev.evaluation_date,
                    e.name as engineer_name,
                    u.name as coach_name
                FROM case_evaluations ce
                INNER JOIN evaluations ev ON ce.evaluation_id = ev.id
                INNER JOIN engineers e ON ev.engineer_id = e.id
                INNER JOIN users u ON ev.coach_user_id = u.id
                WHERE ce.case_id = ? AND ce.deleted_at IS NULL AND ev.deleted_at IS NULL
                LIMIT 1
            `);

            const result = stmt.get(caseId.trim()) as {
                id: number;
                evaluation_id: number;
                case_id: string;
                evaluation_date: string;
                engineer_name: string;
                coach_name: string;
            } | undefined;

            if (result) {
                return {
                    exists: true,
                    evaluation: {
                        evaluation_id: result.evaluation_id,
                        evaluation_date: result.evaluation_date,
                        engineer_name: result.engineer_name,
                        coach_name: result.coach_name
                    }
                };
            }

            return { exists: false };
        } catch (error) {
            logger.error('Error checking case ID existence:', error);
            throw new Error('Failed to check case ID');
        }
    }

    // Generate statistics for reports
    generateStats(filters: ReportFilters): EvaluationStats {
        try {
            let query = `
                SELECT 
                    COUNT(DISTINCT ev.id) as total_evaluations,
                    COUNT(ce.id) as total_cases,
                    COUNT(CASE WHEN ce.case_id IS NOT NULL AND ce.case_id != '' THEN 1 END) as evaluated_cases,
                    SUM(CASE WHEN ce.kb_potential = 1 THEN 1 ELSE 0 END) as kb_potential_count,
                    SUM(CASE WHEN ce.article_linked = 1 THEN 1 ELSE 0 END) as article_linked_count,
                    SUM(CASE WHEN ce.article_improved = 1 THEN 1 ELSE 0 END) as article_improved_count,
                    SUM(CASE WHEN ce.improvement_opportunity = 1 THEN 1 ELSE 0 END) as improvement_opportunity_count,
                    SUM(CASE WHEN ce.article_created = 1 THEN 1 ELSE 0 END) as article_created_count,
                    SUM(CASE WHEN ce.create_opportunity = 1 THEN 1 ELSE 0 END) as create_opportunity_count,
                    SUM(CASE WHEN ce.relevant_link = 1 THEN 1 ELSE 0 END) as relevant_link_count
                FROM evaluations ev
                INNER JOIN engineers e ON ev.engineer_id = e.id
                LEFT JOIN case_evaluations ce ON ev.id = ce.evaluation_id AND ce.deleted_at IS NULL
                WHERE ev.deleted_at IS NULL
            `;
            const params: any[] = [];

            if (filters.engineer_id) {
                query += ' AND ev.engineer_id = ?';
                params.push(filters.engineer_id);
            }

            if (filters.engineer_ids && filters.engineer_ids.length > 0) {
                const placeholders = filters.engineer_ids.map(() => '?').join(',');
                query += ` AND ev.engineer_id IN (${placeholders})`;
                params.push(...filters.engineer_ids);
            }

            if (filters.coach_user_id) {
                query += ' AND ev.coach_user_id = ?';
                params.push(filters.coach_user_id);
            }

            if (filters.coach_user_ids && filters.coach_user_ids.length > 0) {
                const placeholders = filters.coach_user_ids.map(() => '?').join(',');
                query += ` AND ev.coach_user_id IN (${placeholders})`;
                params.push(...filters.coach_user_ids);
            }

            if (filters.lead_user_id) {
                query += ' AND e.lead_user_id = ?';
                params.push(filters.lead_user_id);
            }

            if (filters.lead_user_ids && filters.lead_user_ids.length > 0) {
                const placeholders = filters.lead_user_ids.map(() => '?').join(',');
                query += ` AND e.lead_user_id IN (${placeholders})`;
                params.push(...filters.lead_user_ids);
            }

            if (filters.start_date) {
                query += ' AND ev.evaluation_date >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                query += ' AND ev.evaluation_date <= ?';
                params.push(filters.end_date);
            }

            if (filters.year) {
                query += ' AND strftime(\'%Y\', ev.evaluation_date) = ?';
                params.push(filters.year.toString());
            }

            if (filters.years && filters.years.length > 0) {
                const placeholdersY = filters.years.map(() => '?').join(',');
                query += ` AND strftime('%Y', ev.evaluation_date) IN (${placeholdersY})`;
                params.push(...filters.years.map(y => y.toString()));
            }

            if (filters.quarter) {
                // Map quarters to month ranges
                const quarterMonths: Record<string, [string, string]> = {
                    'Q1': ['01', '03'],
                    'Q2': ['04', '06'],
                    'Q3': ['07', '09'],
                    'Q4': ['10', '12']
                };

                if (quarterMonths[filters.quarter]) {
                    const [startMonth, endMonth] = quarterMonths[filters.quarter];
                    query += ' AND strftime(\'%m\', ev.evaluation_date) BETWEEN ? AND ?';
                    params.push(startMonth, endMonth);
                }
            }

            if (filters.month) {
                query += ' AND strftime(\'%m\', ev.evaluation_date) = ?';
                params.push(filters.month.toString().padStart(2, '0'));
            }

            if (filters.months && filters.months.length > 0) {
                const placeholdersM = filters.months.map(() => '?').join(',');
                query += ` AND strftime('%m', ev.evaluation_date) IN (${placeholdersM})`;
                params.push(...filters.months.map(m => m.toString().padStart(2, '0')));
            }

            const stmt = db.prepare(query);
            const result = stmt.get(...params) as any;

            // Calculate percentages
            const totalCases = result.total_cases || 0;
            const articleLinkedCount = result.article_linked_count || 0;
            const stats: EvaluationStats = {
                total_evaluations: result.total_evaluations || 0,
                total_cases: totalCases,
                evaluated_cases: result.evaluated_cases || 0,
                kb_potential_count: result.kb_potential_count || 0,
                article_linked_count: result.article_linked_count || 0,
                article_improved_count: result.article_improved_count || 0,
                improvement_opportunity_count: result.improvement_opportunity_count || 0,
                article_created_count: result.article_created_count || 0,
                create_opportunity_count: result.create_opportunity_count || 0,
                relevant_link_count: result.relevant_link_count || 0,
                kb_potential_percentage: totalCases > 0 ? Math.round((result.kb_potential_count / totalCases) * 100) : 0,
                article_linked_percentage: totalCases > 0 ? Math.round((result.article_linked_count / totalCases) * 100) : 0,
                article_improved_percentage: totalCases > 0 ? Math.round((result.article_improved_count / totalCases) * 100) : 0,
                improvement_opportunity_percentage: totalCases > 0 ? Math.round((result.improvement_opportunity_count / totalCases) * 100) : 0,
                article_created_percentage: totalCases > 0 ? Math.round((result.article_created_count / totalCases) * 100) : 0,
                create_opportunity_percentage: totalCases > 0 ? Math.round((result.create_opportunity_count / totalCases) * 100) : 0,
                relevant_link_percentage: articleLinkedCount > 0 ? Math.round((result.relevant_link_count / articleLinkedCount) * 100) : 0,
                link_rate: totalCases > 0 ? Math.round((result.article_linked_count / totalCases) * 100) : 0,
                average_score: totalCases > 0 ? Math.round((result.relevant_link_count / (result.article_linked_count || 1)) * 100) : 0
            };

            return stats;
        } catch (error) {
            logger.error('Error generating stats:', error);
            throw new Error('Failed to generate statistics');
        }
    }
}

export default new EvaluationService();