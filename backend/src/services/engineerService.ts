import { db } from '../database/database';
import { Engineer, CreateEngineerRequest, UpdateEngineerRequest } from '../types';
import logger from '../utils/logger';

class EngineerService {
    // Get all engineers with optional filtering
    getAllEngineers(leadUserId?: number, isActive?: boolean): Engineer[] {
        try {
            let query = `
                SELECT 
                    e.*,
                    u.name as lead_name,
                    coach_user.name as coach_name
                FROM engineers e
                LEFT JOIN users u ON e.lead_user_id = u.id AND u.deleted_at IS NULL
                LEFT JOIN engineer_coach_assignments eca ON e.id = eca.engineer_id AND eca.is_active = 1
                LEFT JOIN users coach_user ON eca.coach_user_id = coach_user.id AND coach_user.deleted_at IS NULL
                WHERE 1=1 and e.is_active =1
            `;
            const params: any[] = [];

            if (leadUserId !== undefined) {
                query += ' AND e.lead_user_id = ?';
                params.push(leadUserId);
            }

            if (isActive !== undefined) {
                query += ' AND e.is_active = ?';
                params.push(isActive ? 1 : 0);
            }

            query += ' ORDER BY e.name ASC';

            const stmt = db.prepare(query);
            return stmt.all(...params) as Engineer[];
        } catch (error) {
            logger.error('Error getting engineers:', error);
            throw new Error('Failed to get engineers');
        }
    }

    // Get engineer by ID
    getEngineerById(id: number): Engineer | null {
        try {
            const stmt = db.prepare(`
                SELECT 
                    e.*,
                    u.name as lead_name,
                    coach_user.name as coach_name
                FROM engineers e
                LEFT JOIN users u ON e.lead_user_id = u.id AND u.deleted_at IS NULL
                LEFT JOIN engineer_coach_assignments eca ON e.id = eca.engineer_id AND eca.is_active = 1
                LEFT JOIN users coach_user ON eca.coach_user_id = coach_user.id AND coach_user.deleted_at IS NULL
                WHERE e.id = ?
            `);
            return stmt.get(id) as Engineer | null;
        } catch (error) {
            logger.error('Error getting engineer by ID:', error);
            throw new Error('Failed to get engineer');
        }
    }

    // Create new engineer
    createEngineer(data: CreateEngineerRequest): Engineer {
        try {
            const stmt = db.prepare(`
                INSERT INTO engineers (name, lead_user_id)
                VALUES (?, ?)
            `);
            const result = stmt.run(data.name, data.lead_user_id);

            return this.getEngineerById(result.lastInsertRowid as number)!;
        } catch (error) {
            logger.error('Error creating engineer:', error);
            throw new Error('Failed to create engineer');
        }
    }

    // Update engineer
    updateEngineer(id: number, data: UpdateEngineerRequest): Engineer {
        try {
            const updates: string[] = [];
            const params: any[] = [];

            if (data.name !== undefined) {
                updates.push('name = ?');
                params.push(data.name);
            }
            if (data.lead_user_id !== undefined) {
                updates.push('lead_user_id = ?');
                params.push(data.lead_user_id);
            }
            if (data.is_active !== undefined) {
                updates.push('is_active = ?');
                params.push(data.is_active ? 1 : 0);
            }

            if (updates.length === 0) {
                throw new Error('No updates provided');
            }

            params.push(id);

            const stmt = db.prepare(`
                UPDATE engineers
                SET ${updates.join(', ')}
                WHERE id = ?
            `);
            stmt.run(...params);

            return this.getEngineerById(id)!;
        } catch (error) {
            logger.error('Error updating engineer:', error);
            throw new Error('Failed to update engineer');
        }
    }

    // Get engineers assigned to a specific coach
    getEngineersByCoach(coachUserId: number): Engineer[] {
        try {
            const stmt = db.prepare(`
                SELECT DISTINCT
                    e.*,
                    u.name as lead_name,
                    coach_user.name as coach_name
                FROM engineers e
                LEFT JOIN users u ON e.lead_user_id = u.id AND u.deleted_at IS NULL
                INNER JOIN engineer_coach_assignments eca ON e.id = eca.engineer_id
                LEFT JOIN users coach_user ON eca.coach_user_id = coach_user.id AND coach_user.deleted_at IS NULL
                WHERE eca.coach_user_id = ? AND eca.is_active = 1 AND e.is_active = 1
                ORDER BY e.name ASC
            `);
            return stmt.all(coachUserId) as Engineer[];
        } catch (error) {
            logger.error('Error getting engineers by coach:', error);
            throw new Error('Failed to get engineers by coach');
        }
    }

    // Get engineers by lead (for team management)
    getEngineersByLead(leadUserId: number): Engineer[] {
        try {
            const stmt = db.prepare(`
                SELECT 
                    e.*,
                    u.name as lead_name,
                    coach_user.name as coach_name
                FROM engineers e
                LEFT JOIN users u ON e.lead_user_id = u.id AND u.deleted_at IS NULL
                LEFT JOIN engineer_coach_assignments eca ON e.id = eca.engineer_id AND eca.is_active = 1
                LEFT JOIN users coach_user ON eca.coach_user_id = coach_user.id AND coach_user.deleted_at IS NULL
                WHERE e.lead_user_id = ? AND e.is_active = 1
                ORDER BY e.name ASC
            `);
            return stmt.all(leadUserId) as Engineer[];
        } catch (error) {
            logger.error('Error getting engineers by lead:', error);
            throw new Error('Failed to get engineers by lead');
        }
    }

    // Search engineers by name
    searchEngineers(searchTerm: string, leadUserId?: number): Engineer[] {
        try {
            let query = `
                SELECT 
                    e.*,
                    u.name as lead_name,
                    coach_user.name as coach_name
                FROM engineers e
                LEFT JOIN users u ON e.lead_user_id = u.id AND u.deleted_at IS NULL
                LEFT JOIN engineer_coach_assignments eca ON e.id = eca.engineer_id AND eca.is_active = 1
                LEFT JOIN users coach_user ON eca.coach_user_id = coach_user.id AND coach_user.deleted_at IS NULL
                WHERE e.name LIKE ? AND e.is_active = 1
            `;
            const params: any[] = [`%${searchTerm}%`];

            if (leadUserId !== undefined) {
                query += ' AND e.lead_user_id = ?';
                params.push(leadUserId);
            }

            query += ' ORDER BY e.name ASC LIMIT 20';

            const stmt = db.prepare(query);
            return stmt.all(...params) as Engineer[];
        } catch (error) {
            logger.error('Error searching engineers:', error);
            throw new Error('Failed to search engineers');
        }
    }
}

export default new EngineerService(); 