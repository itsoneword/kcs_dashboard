import express, { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { AuthRequest } from '../types';
import databaseManager from '../database/database';
import logger from '../utils/logger';

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
        res.status(500).json({ error: 'Failed to get database status' });
    }
});

// POST /api/admin/database/backup - Create database backup
router.post('/database/backup', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
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
        res.status(500).json({ error: 'Failed to create database backup' });
    }
});

// GET /api/admin/database/backups - List available backups
router.get('/database/backups', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    try {
        const backupDir = path.join(__dirname, '../../backups');

        if (!fs.existsSync(backupDir)) {
            return res.json({ backups: [] });
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
        res.status(500).json({ error: 'Failed to list database backups' });
    }
});

// GET /api/admin/database/schema - Get current schema information
router.get('/database/schema', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
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
        res.status(500).json({ error: 'Failed to get database schema' });
    }
});

// GET /api/admin/database/migrations - Get available migration files
router.get('/database/migrations', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
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
        res.status(500).json({ error: 'Failed to get migration files' });
    }
});

// POST /api/admin/database/execute-sql - Execute SQL command (dangerous - admin only)
router.post('/database/execute-sql', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    try {
        const { sql } = req.body;

        if (!sql || typeof sql !== 'string') {
            return res.status(400).json({ error: 'SQL query is required' });
        }

        // Basic safety checks
        const dangerousKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER'];
        const upperSQL = sql.toUpperCase().trim();

        const isDangerous = dangerousKeywords.some(keyword => upperSQL.includes(keyword));

        if (isDangerous && !req.body.confirmDangerous) {
            return res.status(400).json({
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: `SQL execution failed: ${errorMessage}` });
    }
});

// POST /api/admin/database/change-db - Change the active database file
router.post('/database/change-db', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
    try {
        const { newDbPath } = req.body;

        if (!newDbPath || typeof newDbPath !== 'string') {
            return res.status(400).json({ error: 'newDbPath is required and must be a string.' });
        }

        // Basic validation: check if path seems plausible (e.g., ends with .db)
        // More robust validation might be needed depending on security requirements
        if (!newDbPath.endsWith('.db') && !newDbPath.endsWith('.sqlite') && !newDbPath.endsWith('.sqlite3')) {
            return res.status(400).json({ error: 'Invalid database file extension. Must be .db, .sqlite, or .sqlite3.' });
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error while changing database path';
        res.status(500).json({ error: `Failed to change database: ${errorMessage}` });
    }
});

export default router; 