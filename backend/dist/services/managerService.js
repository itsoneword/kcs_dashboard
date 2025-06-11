"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagerService = void 0;
const database_1 = require("../database/database");
const logger_1 = __importDefault(require("../utils/logger"));
class ManagerService {
    /**
     * Assign a manager to a user
     * @param managerId - ID of the manager
     * @param assignedToId - ID of the user to assign the manager to
     * @returns The manager assignment details
     */
    async assignManager(managerId, assignedToId) {
        try {
            // Verify the manager exists and has manager role
            const manager = database_1.databaseManager.getDatabase().prepare('SELECT id, is_manager FROM users WHERE id = ? AND deleted_at IS NULL').get(managerId);
            if (!manager) {
                throw new Error('Manager not found');
            }
            if (!manager.is_manager) {
                throw new Error('User does not have manager role');
            }
            // Verify the assigned user exists
            const assignedUser = database_1.databaseManager.getDatabase().prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').get(assignedToId);
            if (!assignedUser) {
                throw new Error('User to assign manager to not found');
            }
            // Check if this assignment already exists and is not deleted
            const existingAssignment = database_1.databaseManager.getDatabase().prepare('SELECT id FROM manager_assignments WHERE manager_id = ? AND assigned_to = ? AND deleted_at IS NULL').get(managerId, assignedToId);
            if (existingAssignment) {
                throw new Error('This manager assignment already exists');
            }
            // Create the assignment
            const result = database_1.databaseManager.getDatabase().prepare('INSERT INTO manager_assignments (manager_id, assigned_to) VALUES (?, ?)').run(managerId, assignedToId);
            // Get the newly created assignment
            const assignment = database_1.databaseManager.getDatabase().prepare('SELECT * FROM manager_assignments WHERE id = ?').get(result.lastInsertRowid);
            logger_1.default.info(`Manager (ID: ${managerId}) assigned to user (ID: ${assignedToId})`);
            return assignment;
        }
        catch (error) {
            logger_1.default.error('Failed to assign manager:', error);
            throw error;
        }
    }
    /**
     * Remove a manager assignment
     * @param managerId - ID of the manager
     * @param assignedToId - ID of the user the manager is assigned to
     */
    async removeManager(managerId, assignedToId) {
        try {
            // Check if this assignment exists and is not already deleted
            const existingAssignment = database_1.databaseManager.getDatabase().prepare('SELECT id FROM manager_assignments WHERE manager_id = ? AND assigned_to = ? AND deleted_at IS NULL').get(managerId, assignedToId);
            if (!existingAssignment) {
                throw new Error('Manager assignment not found or already removed');
            }
            // Soft delete the assignment
            database_1.databaseManager.getDatabase().prepare('UPDATE manager_assignments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(existingAssignment.id);
            logger_1.default.info(`Manager (ID: ${managerId}) removed from user (ID: ${assignedToId})`);
        }
        catch (error) {
            logger_1.default.error('Failed to remove manager:', error);
            throw error;
        }
    }
    /**
     * Get the manager for a specific user
     * @param userId - ID of the user to get the manager for
     * @returns The manager user object or null if no manager is assigned
     */
    getManagerForUser(userId) {
        try {
            // Join manager_assignments with users to get the manager details
            const manager = database_1.databaseManager.getDatabase().prepare(`
                SELECT u.* 
                FROM users u
                JOIN manager_assignments ma ON u.id = ma.manager_id
                WHERE ma.assigned_to = ? 
                AND ma.deleted_at IS NULL
                AND u.deleted_at IS NULL
                ORDER BY ma.created_at DESC
                LIMIT 1
            `).get(userId);
            if (!manager) {
                return null;
            }
            // Remove password hash from response
            const { password_hash, ...managerWithoutPassword } = manager;
            return managerWithoutPassword;
        }
        catch (error) {
            logger_1.default.error('Failed to get manager for user:', error);
            throw error;
        }
    }
    /**
     * Get all users assigned to a specific manager
     * @param managerId - ID of the manager
     * @returns Array of user objects assigned to the manager
     */
    getUsersForManager(managerId) {
        try {
            // Join manager_assignments with users to get the assigned users
            const users = database_1.databaseManager.getDatabase().prepare(`
                SELECT u.* 
                FROM users u
                JOIN manager_assignments ma ON u.id = ma.assigned_to
                WHERE ma.manager_id = ? 
                AND ma.deleted_at IS NULL
                AND u.deleted_at IS NULL
                ORDER BY u.name
            `).all(managerId);
            // Remove password hashes from response
            return users.map(user => {
                const { password_hash, ...userWithoutPassword } = user;
                return userWithoutPassword;
            });
        }
        catch (error) {
            logger_1.default.error('Failed to get users for manager:', error);
            throw error;
        }
    }
    /**
     * Get all manager assignments
     * @returns Array of all active manager assignments with user details
     */
    getAllManagerAssignments() {
        try {
            // Join manager_assignments with users to get both manager and assigned user details
            const assignments = database_1.databaseManager.getDatabase().prepare(`
                SELECT 
                    ma.id as assignment_id,
                    ma.created_at as assignment_date,
                    m.id as manager_id,
                    m.name as manager_name,
                    m.email as manager_email,
                    u.id as user_id,
                    u.name as user_name,
                    u.email as user_email
                FROM manager_assignments ma
                JOIN users m ON ma.manager_id = m.id
                JOIN users u ON ma.assigned_to = u.id
                WHERE ma.deleted_at IS NULL
                AND m.deleted_at IS NULL
                AND u.deleted_at IS NULL
                ORDER BY m.name, u.name
            `).all();
            return assignments;
        }
        catch (error) {
            logger_1.default.error('Failed to get all manager assignments:', error);
            throw error;
        }
    }
}
exports.ManagerService = ManagerService;
exports.default = new ManagerService();
//# sourceMappingURL=managerService.js.map