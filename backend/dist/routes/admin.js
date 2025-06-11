"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const joi_1 = __importDefault(require("joi"));
const auth_1 = require("../middleware/auth");
const database_1 = __importDefault(require("../database/database"));
const logger_1 = __importDefault(require("../utils/logger"));
const managerService_1 = __importDefault(require("../services/managerService"));
const router = express_1.default.Router();
// GET /api/admin/database/status - Get database status
router.get('/database/status', auth_1.authenticateToken, auth_1.requireAdmin, (req, res, next) => {
    try {
        const isHealthy = database_1.default.isHealthy();
        const dbPath = process.env.DATABASE_PATH || '../database/kcs_portal.db';
        let dbSize = 0;
        let lastModified = null;
        try {
            auth_1.authenticateToken;
            const stats = fs_1.default.statSync(dbPath);
            dbSize = stats.size;
            lastModified = stats.mtime;
        }
        catch (error) {
            logger_1.default.warn('Could not get database file stats:', error);
        }
        res.json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            path: dbPath,
            size: dbSize,
            lastModified,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.default.error('Error getting database status:', error);
        next(error);
    }
});
// POST /api/admin/database/backup - Create database backup
router.post('/database/backup', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path_1.default.join(__dirname, '../../backups');
        const backupPath = path_1.default.join(backupDir, `kcs_portal_backup_${timestamp}.db`);
        // Ensure backup directory exists
        if (!fs_1.default.existsSync(backupDir)) {
            fs_1.default.mkdirSync(backupDir, { recursive: true });
        }
        // Create backup
        await database_1.default.backup(backupPath);
        // Get backup file stats
        const stats = fs_1.default.statSync(backupPath);
        logger_1.default.info(`Database backup created by admin ${req.user?.id}: ${backupPath}`);
        res.json({
            message: 'Database backup created successfully',
            backupPath,
            size: stats.size,
            timestamp: stats.mtime
        });
    }
    catch (error) {
        logger_1.default.error('Error creating database backup:', error);
        next(error);
    }
});
// GET /api/admin/database/backups - List available backups
router.get('/database/backups', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const backupDir = path_1.default.join(__dirname, '../../backups');
        if (!fs_1.default.existsSync(backupDir)) {
            res.json({ backups: [] });
        }
        const files = fs_1.default.readdirSync(backupDir)
            .filter(file => file.endsWith('.db'))
            .map(file => {
                const filePath = path_1.default.join(backupDir, file);
                const stats = fs_1.default.statSync(filePath);
                return {
                    filename: file,
                    path: filePath,
                    size: stats.size,
                    created: stats.mtime
                };
            })
            .sort((a, b) => b.created.getTime() - a.created.getTime()); // Sort by newest first
        res.json({ backups: files });
    }
    catch (error) {
        logger_1.default.error('Error listing database backups:', error);
        next(error);
    }
});
// GET /api/admin/database/schema - Get current schema information
router.get('/database/schema', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const db = database_1.default.getDatabase();
        // Get table information
        const tables = databaseManager.getDatabase().prepare(`
            SELECT name, sql 
            FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `).all();
        // Get index information
        const indexes = databaseManager.getDatabase().prepare(`
            SELECT name, sql, tbl_name
            FROM sqlite_master 
            WHERE type='index' AND name NOT LIKE 'sqlite_%'
            ORDER BY tbl_name, name
        `).all();
        // Get trigger information
        const triggers = databaseManager.getDatabase().prepare(`
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
    }
    catch (error) {
        logger_1.default.error('Error getting database schema:', error);
        next(error);
    }
});
// GET /api/admin/database/migrations - Get available migration files
router.get('/database/migrations', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const migrationsDir = path_1.default.join(__dirname, '../database/migrations');
        const schemaPath = path_1.default.join(__dirname, '../database/schema.sql');
        const migrations = [];
        // Add main schema file
        if (fs_1.default.existsSync(schemaPath)) {
            const stats = fs_1.default.statSync(schemaPath);
            const content = fs_1.default.readFileSync(schemaPath, 'utf8');
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
        if (fs_1.default.existsSync(migrationsDir)) {
            const files = fs_1.default.readdirSync(migrationsDir)
                .filter(file => file.endsWith('.sql'))
                .map(file => {
                    const filePath = path_1.default.join(migrationsDir, file);
                    const stats = fs_1.default.statSync(filePath);
                    const content = fs_1.default.readFileSync(filePath, 'utf8');
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
    }
    catch (error) {
        logger_1.default.error('Error getting migration files:', error);
        next(error);
    }
});
// POST /api/admin/database/execute-sql - Execute SQL command (dangerous - admin only)
router.post('/database/execute-sql', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res, next) => {
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
        const db = database_1.default.getDatabase();
        // Execute the SQL
        let result;
        if (upperSQL.startsWith('SELECT')) {
            // For SELECT queries, return the results
            result = databaseManager.getDatabase().prepare(sql).all();
        }
        else {
            // For other queries, return execution info
            const info = databaseManager.getDatabase().prepare(sql).run();
            result = {
                changes: info.changes,
                lastInsertRowid: info.lastInsertRowid
            };
        }
        logger_1.default.warn(`SQL executed by admin ${req.user?.id}: ${sql.substring(0, 100)}...`);
        res.json({
            message: 'SQL executed successfully',
            result,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.default.error('Error executing SQL:', error);
        next(error);
    }
});
// POST /api/admin/database/change-db - Change the active database file
router.post('/database/change-db', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res, next) => {
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
        database_1.default.updateDatabasePath(newDbPath);
        // After attempting to change, get the new status to confirm
        const isHealthy = database_1.default.isHealthy();
        const currentDbPath = process.env.DATABASE_PATH;
        let dbSize = 0;
        let lastModified = null;
        try {
            if (currentDbPath) {
                const stats = fs_1.default.statSync(currentDbPath);
                dbSize = stats.size;
                lastModified = stats.mtime;
            }
        }
        catch (error) {
            logger_1.default.warn('Could not get new database file stats after change:', error);
        }
        logger_1.default.info(`Admin ${req.user?.id} changed database path to: ${newDbPath}`);
        res.json({
            message: `Database path changed to ${newDbPath}. Please verify status.`,
            newPath: currentDbPath,
            status: isHealthy ? 'healthy' : 'unhealthy',
            size: dbSize,
            lastModified,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.default.error('Error changing database path:', error);
        next(error);
    }
});
// Validation schema for manager assignment
const managerAssignmentSchema = joi_1.default.object({
    manager_id: joi_1.default.number().integer().required(),
    assigned_to: joi_1.default.number().integer().required()
});
// GET /api/admin/managers/assignments - Get all manager assignments (admin only)
router.get('/managers/assignments', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const assignments = managerService_1.default.getAllManagerAssignments();
        res.json({ assignments });
    }
    catch (error) {
        logger_1.default.error('Error getting manager assignments:', error);
        next(error);
    }
});
// GET /api/admin/managers/:id/users - Get all users assigned to a manager (admin and manager access)
router.get('/managers/:id/users', auth_1.authenticateToken, (0, auth_1.requireAnyRole)(['admin', 'manager']), async (req, res, next) => {
    try {
        const managerId = parseInt(req.params.id);
        if (isNaN(managerId)) {
            res.status(400).json({ error: 'Invalid manager ID' });
            return;
        }
        // If not admin, only allow managers to see their own assigned users
        if (!req.user.is_admin && req.user.id !== managerId) {
            res.status(403).json({ error: 'Access denied: You can only view your own assigned users' });
            return;
        }
        const users = managerService_1.default.getUsersForManager(managerId);
        res.json({ users });
    }
    catch (error) {
        logger_1.default.error('Error getting users for manager:', error);
        next(error);
    }
});
// GET /api/admin/users/:id/manager - Get the manager for a user (admin and manager access)
router.get('/users/:id/manager', auth_1.authenticateToken, (0, auth_1.requireAnyRole)(['admin', 'manager']), async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            res.status(400).json({ error: 'Invalid user ID' });
            return;
        }
        const manager = managerService_1.default.getManagerForUser(userId);
        res.json({ manager });
    }
    catch (error) {
        logger_1.default.error('Error getting manager for user:', error);
        next(error);
    }
});
// POST /api/admin/managers/assign - Assign a manager to a user (admin and manager access)
router.post('/managers/assign', auth_1.authenticateToken, (0, auth_1.requireAnyRole)(['admin', 'manager']), async (req, res, next) => {
    try {
        const { error, value } = managerAssignmentSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        // If not admin, managers can only assign themselves
        if (!req.user.is_admin && req.user.id !== value.manager_id) {
            res.status(403).json({ error: 'Access denied: You can only assign yourself as a manager' });
            return;
        }
        const assignment = await managerService_1.default.assignManager(value.manager_id, value.assigned_to);
        res.status(201).json({
            message: 'Manager assigned successfully',
            assignment
        });
    }
    catch (error) {
        logger_1.default.error('Error assigning manager:', error);
        next(error);
    }
});
// POST /api/admin/managers/remove - Remove a manager assignment (admin and manager access)
router.post('/managers/remove', auth_1.authenticateToken, (0, auth_1.requireAnyRole)(['admin', 'manager']), async (req, res, next) => {
    try {
        const { error, value } = managerAssignmentSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        // If not admin, managers can only remove themselves
        if (!req.user.is_admin && req.user.id !== value.manager_id) {
            res.status(403).json({ error: 'Access denied: You can only remove yourself as a manager' });
            return;
        }
        await managerService_1.default.removeManager(value.manager_id, value.assigned_to);
        res.json({ message: 'Manager assignment removed successfully' });
    }
    catch (error) {
        logger_1.default.error('Error removing manager assignment:', error);
        next(error);
    }
});
// Error handler middleware for this router
router.use((err, req, res, next) => {
    logger_1.default.error('Admin route error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(500).json({ error: errorMessage });
});
exports.default = router;
//# sourceMappingURL=admin.js.map