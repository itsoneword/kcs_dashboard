"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("../utils/logger"));
const dbPath = path_1.default.join(__dirname, '../..', process.env.DATABASE_PATH || '../database/kcs_portal.db');
const db = new better_sqlite3_1.default(dbPath);
class CoachAssignmentService {
    // Get all assignments with optional filtering
    getAllAssignments(engineerId, coachUserId, isActive) {
        try {
            let query = `
                SELECT 
                    eca.*,
                    e.name as engineer_name,
                    u.name as coach_name
                FROM engineer_coach_assignments eca
                INNER JOIN engineers e ON eca.engineer_id = e.id
                INNER JOIN users u ON eca.coach_user_id = u.id
                WHERE 1=1
            `;
            const params = [];
            if (engineerId !== undefined) {
                query += ' AND eca.engineer_id = ?';
                params.push(engineerId);
            }
            if (coachUserId !== undefined) {
                query += ' AND eca.coach_user_id = ?';
                params.push(coachUserId);
            }
            if (isActive !== undefined) {
                query += ' AND eca.is_active = ?';
                params.push(isActive ? 1 : 0);
            }
            query += ' ORDER BY eca.start_date DESC';
            const stmt = db.prepare(query);
            return stmt.all(...params);
        }
        catch (error) {
            logger_1.default.error('Error getting coach assignments:', error);
            throw new Error('Failed to get coach assignments');
        }
    }
    // Get assignment by ID
    getAssignmentById(id) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    eca.*,
                    e.name as engineer_name,
                    u.name as coach_name
                FROM engineer_coach_assignments eca
                INNER JOIN engineers e ON eca.engineer_id = e.id
                INNER JOIN users u ON eca.coach_user_id = u.id
                WHERE eca.id = ?
            `);
            return stmt.get(id);
        }
        catch (error) {
            logger_1.default.error('Error getting assignment by ID:', error);
            throw new Error('Failed to get assignment');
        }
    }
    // Create new coach assignment or reactivate existing one
    createAssignment(assignmentData) {
        try {
            // Check if there's already an active assignment for this engineer-coach pair
            const activeStmt = db.prepare(`
                SELECT id FROM engineer_coach_assignments 
                WHERE engineer_id = ? AND coach_user_id = ? AND is_active = 1
            `);
            const activeAssignment = activeStmt.get(assignmentData.engineer_id, assignmentData.coach_user_id);
            if (activeAssignment) {
                throw new Error('Active assignment already exists for this engineer-coach pair');
            }
            // Check if there's an existing inactive assignment with the same date that we can reactivate
            const inactiveStmt = db.prepare(`
                SELECT id FROM engineer_coach_assignments 
                WHERE engineer_id = ? AND coach_user_id = ? AND start_date = ? AND is_active = 0
            `);
            const inactiveAssignment = inactiveStmt.get(assignmentData.engineer_id, assignmentData.coach_user_id, assignmentData.start_date);
            let assignmentId;
            if (inactiveAssignment) {
                // Reactivate existing assignment
                const reactivateStmt = db.prepare(`
                    UPDATE engineer_coach_assignments 
                    SET is_active = 1, end_date = NULL
                    WHERE id = ?
                `);
                reactivateStmt.run(inactiveAssignment.id);
                assignmentId = inactiveAssignment.id;
                logger_1.default.info(`Coach assignment reactivated: Engineer-Coach assignment ID ${assignmentId}`);
            }
            else {
                // Create new assignment
                const insertStmt = db.prepare(`
                    INSERT INTO engineer_coach_assignments (engineer_id, coach_user_id, start_date)
                    VALUES (?, ?, ?)
                `);
                const result = insertStmt.run(assignmentData.engineer_id, assignmentData.coach_user_id, assignmentData.start_date);
                assignmentId = result.lastInsertRowid;
                logger_1.default.info(`Coach assignment created: New assignment ID ${assignmentId}`);
            }
            const finalAssignment = this.getAssignmentById(assignmentId);
            if (!finalAssignment) {
                throw new Error('Failed to retrieve assignment');
            }
            logger_1.default.info(`Coach assignment completed: Engineer ${finalAssignment.engineer_name} assigned to Coach ${finalAssignment.coach_name}`);
            return finalAssignment;
        }
        catch (error) {
            logger_1.default.error('Error creating coach assignment:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to create coach assignment');
        }
    }
    // End assignment (set end_date and is_active = false)
    endAssignment(id, endDate) {
        try {
            const existingAssignment = this.getAssignmentById(id);
            if (!existingAssignment) {
                throw new Error('Assignment not found');
            }
            const stmt = db.prepare(`
                UPDATE engineer_coach_assignments 
                SET end_date = ?, is_active = 0
                WHERE id = ?
            `);
            stmt.run(endDate, id);
            const updatedAssignment = this.getAssignmentById(id);
            if (!updatedAssignment) {
                throw new Error('Failed to retrieve updated assignment');
            }
            logger_1.default.info(`Coach assignment ended: Engineer ${updatedAssignment.engineer_name} - Coach ${updatedAssignment.coach_name}`);
            return updatedAssignment;
        }
        catch (error) {
            logger_1.default.error('Error ending coach assignment:', error);
            throw new Error('Failed to end coach assignment');
        }
    }
    // Get active assignments for a coach
    getActiveAssignmentsByCoach(coachUserId) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    eca.*,
                    e.name as engineer_name,
                    u.name as coach_name
                FROM engineer_coach_assignments eca
                INNER JOIN engineers e ON eca.engineer_id = e.id
                INNER JOIN users u ON eca.coach_user_id = u.id
                WHERE eca.coach_user_id = ? AND eca.is_active = 1 AND e.is_active = 1
                ORDER BY e.name ASC
            `);
            return stmt.all(coachUserId);
        }
        catch (error) {
            logger_1.default.error('Error getting active assignments by coach:', error);
            throw new Error('Failed to get active assignments by coach');
        }
    }
    // Get assignments for engineers under a specific lead
    getAssignmentsByLead(leadUserId) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    eca.*,
                    e.name as engineer_name,
                    u.name as coach_name
                FROM engineer_coach_assignments eca
                INNER JOIN engineers e ON eca.engineer_id = e.id
                INNER JOIN users u ON eca.coach_user_id = u.id
                WHERE e.lead_user_id = ? AND eca.is_active = 1 AND e.is_active = 1
                ORDER BY e.name ASC, eca.start_date DESC
            `);
            return stmt.all(leadUserId);
        }
        catch (error) {
            logger_1.default.error('Error getting assignments by lead:', error);
            throw new Error('Failed to get assignments by lead');
        }
    }
    // Check if engineer has active coach assignment
    hasActiveCoach(engineerId) {
        try {
            const stmt = db.prepare(`
                SELECT COUNT(*) as count 
                FROM engineer_coach_assignments 
                WHERE engineer_id = ? AND is_active = 1
            `);
            const result = stmt.get(engineerId);
            return result.count > 0;
        }
        catch (error) {
            logger_1.default.error('Error checking active coach:', error);
            return false;
        }
    }
}
exports.default = new CoachAssignmentService();
//# sourceMappingURL=coachAssignmentService.js.map