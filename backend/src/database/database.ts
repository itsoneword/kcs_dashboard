import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

class DatabaseManager {
    private db!: Database.Database;
    private dbPath: string;
    private isInitialized = false;
    // private baseDir: string; // Reverted: No longer using complex baseDir calculation for default path

    constructor() {
        // Reverted: Simpler default path. Assumes database file is in a 'database' folder relative to project root,
        // and this constructor is called from a file within the backend structure.
        // process.env.DATABASE_PATH will take precedence if set.
        const projectRoot = path.resolve(__dirname, '..', '..', '..'); // From /backend/dist/database -> project root
        const defaultRelativeDbPath = 'database/kcs_portal.db';
        const defaultFullDbPath = path.join(projectRoot, defaultRelativeDbPath);

        this.dbPath = process.env.DATABASE_PATH || defaultFullDbPath;
        logger.info(`[DatabaseManager Constructor] Using DB Path: ${this.dbPath} (Default was: ${defaultFullDbPath})`);
        this.initializeDatabase();
    }

    private initializeDatabase() {
        try {
            logger.info(`[initializeDatabase] Attempting to connect to: ${this.dbPath}`);
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
                logger.info(`[initializeDatabase] Created database directory: ${dbDir}`);
            }

            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('foreign_keys = ON');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 1000');
            this.db.pragma('temp_store = memory');
            this.db.pragma('mmap_size = 268435456');
            logger.info(`[initializeDatabase] Database connected: ${this.dbPath}`);

            this.runMigrations();
            this.isInitialized = true;

        } catch (error) {
            logger.error('[initializeDatabase] Failed to initialize database:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    private runMigrations() {
        try {
            // schema.sql is expected to be in the same directory as this database.ts file (or its compiled counterpart in dist)
            const schemaSqlPath = path.join(__dirname, 'schema.sql');
            logger.info(`[runMigrations] Looking for schema.sql at: ${schemaSqlPath}`);

            if (!fs.existsSync(schemaSqlPath)) {
                logger.error(`[runMigrations] schema.sql not found at: ${schemaSqlPath}`);
                throw new Error(`schema.sql not found at: ${schemaSqlPath}. Ensure it's in the same directory as database.ts (and copied to dist/database on build).`);
            }

            const schema = fs.readFileSync(schemaSqlPath, 'utf8');
            this.db.exec(schema);
            logger.info('[runMigrations] Database schema migration completed.');
        } catch (error) {
            logger.error('[runMigrations] Failed to run database migrations:', error);
            throw error;
        }
    }

    public getDatabase(): Database.Database {
        if (!this.isInitialized || !this.db) {
            logger.warn('Database not initialized, attempting to reinitialize...');
            this.initializeDatabase();
        }
        return this.db;
    }

    public close() {
        if (this.db) {
            this.db.close();
            this.isInitialized = false;
            logger.info('Database connection closed');
        }
    }

    // Health check method with retry logic
    public isHealthy(): boolean {
        try {
            if (!this.isInitialized || !this.db) {
                return false;
            }

            const result = this.db.prepare('SELECT 1 as health').get() as { health: number } | undefined;
            return result ? result.health === 1 : false;
        } catch (error) {
            logger.error('Database health check failed:', error);

            // Try to reinitialize if health check fails
            try {
                this.initializeDatabase();
                const result = this.db.prepare('SELECT 1 as health').get() as { health: number } | undefined;
                return result ? result.health === 1 : false;
            } catch (retryError) {
                logger.error('Database reinitialize failed:', retryError);
                return false;
            }
        }
    }

    // Execute query with retry logic
    public executeWithRetry<T>(operation: () => T, maxRetries = 3): T {
        let lastError: Error;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (!this.isInitialized) {
                    this.initializeDatabase();
                }
                return operation();
            } catch (error) {
                lastError = error as Error;
                logger.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error);

                if (attempt < maxRetries) {
                    // Wait before retry
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    setTimeout(() => { }, delay);

                    // Try to reinitialize connection
                    try {
                        this.initializeDatabase();
                    } catch (initError) {
                        logger.error('Failed to reinitialize database:', initError);
                    }
                }
            }
        }

        throw lastError!;
    }

    // Backup method
    public async backup(backupPath: string): Promise<void> {
        try {
            // The .backup() method in better-sqlite3 returns a Promise
            await this.db.backup(backupPath);
            logger.info(`Database backed up to: ${backupPath}`);
        } catch (error) {
            logger.error('Database backup failed:', error);
            throw error; // Re-throw the error to be caught by the route handler
        }
    }

    public updateDatabasePath(newDbPath: string): void {
        let resolvedNewDbPath = newDbPath;
        // For paths provided by admin, if not absolute, resolve them from a sensible project root or designated data directory.
        // For now, assuming projectRoot as calculated in constructor might be one level too deep if called from `dist` vs `src`
        const projectRootForUserPaths = path.resolve(__dirname, '..', '..', '..');
        if (!path.isAbsolute(newDbPath)) {
            resolvedNewDbPath = path.resolve(projectRootForUserPaths, newDbPath);
        }

        logger.info(`Attempting to switch database path to: ${resolvedNewDbPath}`);

        if (this.dbPath === resolvedNewDbPath && this.isInitialized) {
            logger.info('New database path is the same as the current one. No change needed.');
            return;
        }

        this.close();
        this.dbPath = resolvedNewDbPath;
        // process.env.DATABASE_PATH = resolvedNewDbPath; // Still keeping this commented for stability during login debug
        this.initializeDatabase();
        logger.info(`Successfully switched database to: ${this.dbPath}`);
    }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

export default databaseManager;
export const db: Database.Database = databaseManager.getDatabase(); 