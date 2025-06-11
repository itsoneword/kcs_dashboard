import databaseManager from '../database/database';
import { User } from '../types';
import logger from '../utils/logger';

export class ManagerService {
    /**
     * Assign a manager to a user
     * @param managerId - The ID of the user who is the manager
     * @param assignedToId - The ID of the user being assigned a manager
     */
    assignManagerToUser(managerId: number, assignedToId: number): any {
        try {
            // Verify the manager exists and has manager role
            const manager = databaseManager.getDatabase().prepare('SELECT id, is_manager FROM users WHERE id = ? AND deleted_at IS NULL').get(managerId) as { id: number, is_manager: number } | undefined;
            if (!manager) {
                throw new Error('Manager not found');
            }
            if (!manager.is_manager) {
                throw new Error('Assigned user does not have the manager role');
            }

            // Verify the assigned user exists
            const assignedUser = databaseManager.getDatabase().prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').get(assignedToId);
            if (!assignedUser) {
                throw new Error('User to assign manager to not found');
            }

            // Check if this assignment already exists and is not deleted
            const existingAssignment = databaseManager.getDatabase().prepare(
                'SELECT id FROM manager_assignments WHERE manager_id = ? AND assigned_to = ? AND deleted_at IS NULL'
            ).get(managerId, assignedToId);

            if (existingAssignment) {
                logger.warn(`Manager (ID: ${managerId}) is already assigned to user (ID: ${assignedToId})`);
                return { message: 'Assignment already exists' };
            }

            // Create the assignment
            const result = databaseManager.getDatabase().prepare(
                'INSERT INTO manager_assignments (manager_id, assigned_to) VALUES (?, ?)'
            ).run(managerId, assignedToId);

            // Get the newly created assignment
            const assignment = databaseManager.getDatabase().prepare('SELECT * FROM manager_assignments WHERE id = ?').get(result.lastInsertRowid);

            logger.info(`Manager (ID: ${managerId}) assigned to user (ID: ${assignedToId})`);

            return assignment;
        } catch (error) {
            logger.error('Failed to assign manager to user:', error);
            throw error;
        }
    }

    /**
     * Remove a manager from a user
     * @param managerId - The ID of the user who is the manager
     * @param assignedToId - The ID of the user being assigned a manager
     */
    removeManagerFromUser(managerId: number, assignedToId: number): any {
        try {
            // Check if this assignment exists and is not already deleted
            const existingAssignment = databaseManager.getDatabase().prepare(
                'SELECT id FROM manager_assignments WHERE manager_id = ? AND assigned_to = ? AND deleted_at IS NULL'
            ).get(managerId, assignedToId) as { id: number } | undefined;

            if (!existingAssignment) {
                throw new Error('Active assignment not found');
            }

            // Soft delete the assignment
            databaseManager.getDatabase().prepare(
                'UPDATE manager_assignments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).run(existingAssignment.id);

            logger.info(`Manager (ID: ${managerId}) assignment removed for user (ID: ${assignedToId})`);

            return { message: 'Assignment removed successfully' };
        } catch (error) {
            logger.error('Failed to remove manager from user:', error);
            throw error;
        }
    }

    /**
     * Get the manager for a specific user
     * @param userId - The ID of the user
     * @returns The manager user object, or null if not found
     */
    getManagerForUser(userId: number): User | null {
        try {
            // Join manager_assignments with users to get the manager details
            const manager = databaseManager.getDatabase().prepare(`
                SELECT u.* 
                FROM users u
                JOIN manager_assignments ma ON u.id = ma.manager_id
                WHERE ma.assigned_to = ? 
                AND ma.deleted_at IS NULL
                AND u.deleted_at IS NULL
                ORDER BY ma.created_at DESC
                LIMIT 1
            `).get(userId) as User | undefined;

            if (!manager) {
                return null;
            }

            // Remove password hash from response
            const { password_hash, ...managerWithoutPassword } = manager as any;
            return managerWithoutPassword;
        } catch (error) {
            logger.error('Failed to get manager for user:', error);
            throw error;
        }
    }

    /**
     * Get all users assigned to a specific manager
     * @param managerId - The ID of the manager
     * @returns Array of user objects assigned to the manager
     */
    getUsersForManager(managerId: number): User[] {
        try {
            // Join manager_assignments with users to get the assigned users
            const users = databaseManager.getDatabase().prepare(`
                SELECT u.* 
                FROM users u
                JOIN manager_assignments ma ON u.id = ma.assigned_to
                WHERE ma.manager_id = ? 
                AND ma.deleted_at IS NULL
                AND u.deleted_at IS NULL
                ORDER BY u.name
            `).all(managerId) as User[];

            // Remove password hashes from response
            return users.map(user => {
                const { password_hash, ...userWithoutPassword } = user as any;
                return userWithoutPassword;
            });
        } catch (error) {
            logger.error('Failed to get users for manager:', error);
            throw error;
        }
    }

    /**
     * Get all active manager assignments
     * @returns Array of all active manager assignments with user details
     */
    getAllManagerAssignments(): any[] {
        try {
            // Join manager_assignments with users to get both manager and assigned user details
            const assignments = databaseManager.getDatabase().prepare(`
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
        } catch (error) {
            logger.error('Failed to get all manager assignments:', error);
            throw error;
        }
    }
}

export default new ManagerService();
