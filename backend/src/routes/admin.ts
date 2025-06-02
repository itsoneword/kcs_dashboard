import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import Joi from 'joi';
import { authenticateToken, requireAdmin, requireAnyRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import databaseManager from '../database/database';
import logger from '../utils/logger';
import managerService from '../services/managerService';

const router = express.Router();

// GET /api/admin/database/status - Get database status
router.get('/database/status', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    try {
        const isHealthy = databaseManager.isHealthy();
        const dbPath = process.env.DATABASE_PATH || '../database/kcs_portal.db';

        let dbSize = 0;
        let lastModified = null;

        try {
            const stats = fs.statSync(dbPath);
            dbSize = stats.size;
            lastModified = stats.mtime;
        } catch (error) {
            logger.warn('Could not get database file stats:', error);
        }

        res.json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            path: dbPath,
            size: dbSize,
            lastModified,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error getting database status:', error);
        next(error);
    }
});

// POST /api/admin/database/backup - Create database backup
router.post('/database/backup', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, '../../backups');
        const backupPath = path.join(backupDir, `kcs_portal_backup_${timestamp}.db`);

        // Ensure backup directory exists
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Create backup
        await databaseManager.backup(backupPath);

        // Get backup file stats
        const stats = fs.statSync(backupPath);

        logger.info(`Database backup created by admin ${req.user?.id}: ${backupPath}`);

        res.json({
            message: 'Database backup created successfully',
            backupPath,
            size: stats.size,
            timestamp: stats.mtime
        });
    } catch (error) {
        logger.error('Error creating database backup:', error);
        next(error);
    }
});

// GET /api/admin/database/backups - List available backups
router.get('/database/backups', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const backupDir = path.join(__dirname, '../../backups');

        if (!fs.existsSync(backupDir)) {
            res.json({ backups: [] });
        }

        const files = fs.readdirSync(backupDir)
            .filter(file => file.endsWith('.db'))
            .map(file => {
                const filePath = path.join(backupDir, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    path: filePath,
                    size: stats.size,
                    created: stats.mtime
                };
            })
            .sort((a, b) => b.created.getTime() - a.created.getTime()); // Sort by newest first

        res.json({ backups: files });
    } catch (error) {
        logger.error('Error listing database backups:', error);
        next(error);
    }
});

// GET /api/admin/database/schema - Get current schema information
router.get('/database/schema', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = databaseManager.getDatabase();

        // Get table information
        const tables = db.prepare(`
            SELECT name, sql 
            FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `).all();

        // Get index information
        const indexes = db.prepare(`
            SELECT name, sql, tbl_name
            FROM sqlite_master 
            WHERE type='index' AND name NOT LIKE 'sqlite_%'
            ORDER BY tbl_name, name
        `).all();

        // Get trigger information
        const triggers = db.prepare(`
            SELECT name, sql, tbl_name
            FROM sqlite_master 
            WHERE type='trigger'
            ORDER BY tbl_name, name
        `).all();

        res.json({
            tables,
            indexes,
            triggers,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error getting database schema:', error);
        next(error);
    }
});

// GET /api/admin/database/migrations - Get available migration files
router.get('/database/migrations', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const migrationsDir = path.join(__dirname, '../database/migrations');
        const schemaPath = path.join(__dirname, '../database/schema.sql');

        const migrations = [];

        // Add main schema file
        if (fs.existsSync(schemaPath)) {
            const stats = fs.statSync(schemaPath);
            const content = fs.readFileSync(schemaPath, 'utf8');
            migrations.push({
                filename: 'schema.sql',
                path: schemaPath,
                size: stats.size,
                modified: stats.mtime,
                content: content.substring(0, 500) + (content.length > 500 ? '...' : ''), // Preview
                type: 'schema'
            });
        }

        // Add migration files
        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir)
                .filter(file => file.endsWith('.sql'))
                .map(file => {
                    const filePath = path.join(migrationsDir, file);
                    const stats = fs.statSync(filePath);
                    const content = fs.readFileSync(filePath, 'utf8');
                    return {
                        filename: file,
                        path: filePath,
                        size: stats.size,
                        modified: stats.mtime,
                        content: content.substring(0, 500) + (content.length > 500 ? '...' : ''), // Preview
                        type: 'migration'
                    };
                })
                .sort((a, b) => a.filename.localeCompare(b.filename));

            migrations.push(...files);
        }

        res.json({ migrations });
    } catch (error) {
        logger.error('Error getting migration files:', error);
        next(error);
    }
});

// POST /api/admin/database/execute-sql - Execute SQL command (dangerous - admin only)
router.post('/database/execute-sql', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { sql } = req.body;

        if (!sql || typeof sql !== 'string') {
            res.status(400).json({ error: 'SQL query is required' });
        }

        // Basic safety checks
        const dangerousKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER'];
        const upperSQL = sql.toUpperCase().trim();

        const isDangerous = dangerousKeywords.some(keyword => upperSQL.includes(keyword));

        if (isDangerous && !req.body.confirmDangerous) {
            res.status(400).json({
                error: 'This SQL contains potentially dangerous operations. Please confirm.',
                requiresConfirmation: true
            });
        }

        const db = databaseManager.getDatabase();

        // Execute the SQL
        let result;
        if (upperSQL.startsWith('SELECT')) {
            // For SELECT queries, return the results
            result = db.prepare(sql).all();
        } else {
            // For other queries, return execution info
            const info = db.prepare(sql).run();
            result = {
                changes: info.changes,
                lastInsertRowid: info.lastInsertRowid
            };
        }

        logger.warn(`SQL executed by admin ${req.user?.id}: ${sql.substring(0, 100)}...`);

        res.json({
            message: 'SQL executed successfully',
            result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error executing SQL:', error);
        next(error);
    }
});

// POST /api/admin/database/change-db - Change the active database file
router.post('/database/change-db', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { newDbPath } = req.body;

        if (!newDbPath || typeof newDbPath !== 'string') {
            res.status(400).json({ error: 'newDbPath is required and must be a string.' });
        }

        // Basic validation: check if path seems plausible (e.g., ends with .db)
        // More robust validation might be needed depending on security requirements
        if (!newDbPath.endsWith('.db') && !newDbPath.endsWith('.sqlite') && !newDbPath.endsWith('.sqlite3')) {
            res.status(400).json({ error: 'Invalid database file extension. Must be .db, .sqlite, or .sqlite3.' });
        }

        databaseManager.updateDatabasePath(newDbPath);

        // After attempting to change, get the new status to confirm
        const isHealthy = databaseManager.isHealthy();
        const currentDbPath = process.env.DATABASE_PATH;
        let dbSize = 0;
        let lastModified = null;
        try {
            if (currentDbPath) {
                const stats = fs.statSync(currentDbPath);
                dbSize = stats.size;
                lastModified = stats.mtime;
            }
        } catch (error) {
            logger.warn('Could not get new database file stats after change:', error);
        }

        logger.info(`Admin ${req.user?.id} changed database path to: ${newDbPath}`);
        res.json({
            message: `Database path changed to ${newDbPath}. Please verify status.`,
            newPath: currentDbPath,
            status: isHealthy ? 'healthy' : 'unhealthy',
            size: dbSize,
            lastModified,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error changing database path:', error);
        next(error);
    }
});

// Validation schema for manager assignment
const managerAssignmentSchema = Joi.object({
    manager_id: Joi.number().integer().required(),
    assigned_to: Joi.number().integer().required()
});

// GET /api/admin/managers/assignments - Get all manager assignments (admin only)
router.get('/managers/assignments', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const assignments = managerService.getAllManagerAssignments();
        res.json({ assignments });
    } catch (error: any) {
        logger.error('Error getting manager assignments:', error);
        next(error);
    }
});

// GET /api/admin/managers/:id/users - Get all users assigned to a manager (admin and manager access)
router.get('/managers/:id/users', authenticateToken, requireAnyRole(['admin', 'manager']), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const managerId = parseInt(req.params.id);
        if (isNaN(managerId)) {
            return res.status(400).json({ error: 'Invalid manager ID' });
        }

        // If not admin, only allow managers to see their own assigned users
        if (!req.user!.is_admin && req.user!.id !== managerId) {
            return res.status(403).json({ error: 'Access denied: You can only view your own assigned users' });
        }

        const users = managerService.getUsersForManager(managerId);
        res.json({ users });
    } catch (error: any) {
        logger.error('Error getting users for manager:', error);
        next(error);
    }
});

// GET /api/admin/users/:id/manager - Get the manager for a user (admin and manager access)
router.get('/users/:id/manager', authenticateToken, requireAnyRole(['admin', 'manager']), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const manager = managerService.getManagerForUser(userId);
        res.json({ manager });
    } catch (error: any) {
        logger.error('Error getting manager for user:', error);
        next(error);
    }
});

// POST /api/admin/managers/assign - Assign a manager to a user (admin and manager access)
router.post('/managers/assign', authenticateToken, requireAnyRole(['admin', 'manager']), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { error, value } = managerAssignmentSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }

        // If not admin, managers can only assign themselves
        if (!req.user!.is_admin && req.user!.id !== value.manager_id) {
            res.status(403).json({ error: 'Access denied: You can only assign yourself as a manager' });
            return;
        }

        const assignment = await managerService.assignManager(value.manager_id, value.assigned_to);
        res.status(201).json({ 
            message: 'Manager assigned successfully',
            assignment 
        });
    } catch (error: any) {
        logger.error('Error assigning manager:', error);
        next(error);
    }
});

// POST /api/admin/managers/remove - Remove a manager assignment (admin and manager access)
router.post('/managers/remove', authenticateToken, requireAnyRole(['admin', 'manager']), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { error, value } = managerAssignmentSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }

        // If not admin, managers can only remove themselves
        if (!req.user!.is_admin && req.user!.id !== value.manager_id) {
            res.status(403).json({ error: 'Access denied: You can only remove yourself as a manager' });
            return;
        }

        await managerService.removeManager(value.manager_id, value.assigned_to);
        res.json({ message: 'Manager assignment removed successfully' });
    } catch (error: any) {
        logger.error('Error removing manager assignment:', error);
        next(error);
    }
});

// Error handler middleware for this router
router.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('Admin route error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(500).json({ error: errorMessage });
});

export default router;