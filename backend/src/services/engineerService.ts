import Database from 'better-sqlite3';
import path from 'path';
import { Engineer, CreateEngineerRequest, UpdateEngineerRequest } from '../types';
import logger from '../utils/logger';

const dbPath = path.join(__dirname, '../..', process.env.DATABASE_PATH || '../database/kcs_portal.db');
const db = new Database(dbPath);

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
                LEFT JOIN users u ON e.lead_user_id = u.id
                LEFT JOIN engineer_coach_assignments eca ON e.id = eca.engineer_id AND eca.is_active = 1
                LEFT JOIN users coach_user ON eca.coach_user_id = coach_user.id
                WHERE 1=1
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
                LEFT JOIN users u ON e.lead_user_id = u.id
                LEFT JOIN engineer_coach_assignments eca ON e.id = eca.engineer_id AND eca.is_active = 1
                LEFT JOIN users coach_user ON eca.coach_user_id = coach_user.id
                WHERE e.id = ?
            `);
            return stmt.get(id) as Engineer | null;
        } catch (error) {
            logger.error('Error getting engineer by ID:', error);
            throw new Error('Failed to get engineer');
        }
    }

    // Create new engineer
    createEngineer(engineerData: CreateEngineerRequest): Engineer {
        try {
            const stmt = db.prepare(`
                INSERT INTO engineers (name, lead_user_id)
                VALUES (?, ?)
            `);

            const result = stmt.run(
                engineerData.name,
                engineerData.lead_user_id || null
            );

            const newEngineer = this.getEngineerById(result.lastInsertRowid as number);
            if (!newEngineer) {
                throw new Error('Failed to retrieve created engineer');
            }

            logger.info(`Engineer created: ${newEngineer.name} (ID: ${newEngineer.id})`);
            return newEngineer;
        } catch (error) {
            logger.error('Error creating engineer:', error);
            throw new Error('Failed to create engineer');
        }
    }

    // Update engineer
    updateEngineer(id: number, updateData: UpdateEngineerRequest): Engineer {
        try {
            const existingEngineer = this.getEngineerById(id);
            if (!existingEngineer) {
                throw new Error('Engineer not found');
            }

            const updates: string[] = [];
            const params: any[] = [];

            if (updateData.name !== undefined) {
                updates.push('name = ?');
                params.push(updateData.name);
            }

            if (updateData.lead_user_id !== undefined) {
                updates.push('lead_user_id = ?');
                params.push(updateData.lead_user_id);
            }

            if (updateData.is_active !== undefined) {
                updates.push('is_active = ?');
                params.push(updateData.is_active ? 1 : 0);
            }

            if (updates.length === 0) {
                return existingEngineer;
            }

            params.push(id);
            const stmt = db.prepare(`
                UPDATE engineers 
                SET ${updates.join(', ')}
                WHERE id = ?
            `);

            stmt.run(...params);

            const updatedEngineer = this.getEngineerById(id);
            if (!updatedEngineer) {
                throw new Error('Failed to retrieve updated engineer');
            }

            logger.info(`Engineer updated: ${updatedEngineer.name} (ID: ${id})`);
            return updatedEngineer;
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
                LEFT JOIN users u ON e.lead_user_id = u.id
                INNER JOIN engineer_coach_assignments eca ON e.id = eca.engineer_id
                LEFT JOIN users coach_user ON eca.coach_user_id = coach_user.id
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
                LEFT JOIN users u ON e.lead_user_id = u.id
                LEFT JOIN engineer_coach_assignments eca ON e.id = eca.engineer_id AND eca.is_active = 1
                LEFT JOIN users coach_user ON eca.coach_user_id = coach_user.id
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
                LEFT JOIN users u ON e.lead_user_id = u.id
                LEFT JOIN engineer_coach_assignments eca ON e.id = eca.engineer_id AND eca.is_active = 1
                LEFT JOIN users coach_user ON eca.coach_user_id = coach_user.id
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