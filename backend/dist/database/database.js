"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("../utils/logger"));
class DatabaseManager {
    // private baseDir: string; // Reverted: No longer using complex baseDir calculation for default path
    constructor() {
        this.isInitialized = false;
        // Reverted: Simpler default path. Assumes database file is in a 'database' folder relative to project root,
        // and this constructor is called from a file within the backend structure.
        // process.env.DATABASE_PATH will take precedence if set.
        const projectRoot = path_1.default.resolve(__dirname, '..', '..', '..'); // From /backend/dist/database -> project root
        const defaultRelativeDbPath = 'database/kcs_portal.db';
        const defaultFullDbPath = path_1.default.join(projectRoot, defaultRelativeDbPath);
        this.dbPath = process.env.DATABASE_PATH || defaultFullDbPath;
        logger_1.default.info(`[DatabaseManager Constructor] Using DB Path: ${this.dbPath} (Default was: ${defaultFullDbPath})`);
        this.initializeDatabase();
    }
    initializeDatabase() {
        try {
            logger_1.default.info(`[initializeDatabase] Attempting to connect to: ${this.dbPath}`);
            const dbDir = path_1.default.dirname(this.dbPath);
            if (!fs_1.default.existsSync(dbDir)) {
                fs_1.default.mkdirSync(dbDir, { recursive: true });
                logger_1.default.info(`[initializeDatabase] Created database directory: ${dbDir}`);
            }
            this.db = new better_sqlite3_1.default(this.dbPath);
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('foreign_keys = ON');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 1000');
            this.db.pragma('temp_store = memory');
            this.db.pragma('mmap_size = 268435456');
            logger_1.default.info(`[initializeDatabase] Database connected: ${this.dbPath}`);
            this.runMigrations();
            this.isInitialized = true;
        }
        catch (error) {
            logger_1.default.error('[initializeDatabase] Failed to initialize database:', error);
            this.isInitialized = false;
            throw error;
        }
    }
    runMigrations() {
        try {
            // schema.sql is expected to be in the same directory as this database.ts file (or its compiled counterpart in dist)
            const schemaSqlPath = path_1.default.join(__dirname, 'schema.sql');
            logger_1.default.info(`[runMigrations] Looking for schema.sql at: ${schemaSqlPath}`);
            if (!fs_1.default.existsSync(schemaSqlPath)) {
                logger_1.default.error(`[runMigrations] schema.sql not found at: ${schemaSqlPath}`);
                throw new Error(`schema.sql not found at: ${schemaSqlPath}. Ensure it's in the same directory as database.ts (and copied to dist/database on build).`);
            }
            const schema = fs_1.default.readFileSync(schemaSqlPath, 'utf8');
            this.db.exec(schema);
            logger_1.default.info('[runMigrations] Database schema migration completed.');
        }
        catch (error) {
            logger_1.default.error('[runMigrations] Failed to run database migrations:', error);
            throw error;
        }
    }
    getDatabase() {
        if (!this.isInitialized || !this.db) {
            logger_1.default.warn('Database not initialized, attempting to reinitialize...');
            this.initializeDatabase();
        }
        return this.db;
    }
    close() {
        if (this.db) {
            this.db.close();
            this.isInitialized = false;
            logger_1.default.info('Database connection closed');
        }
    }
    // Health check method with retry logic
    isHealthy() {
        try {
            if (!this.isInitialized || !this.db) {
                return false;
            }
            const result = this.db.prepare('SELECT 1 as health').get();
            return result ? result.health === 1 : false;
        }
        catch (error) {
            logger_1.default.error('Database health check failed:', error);
            // Try to reinitialize if health check fails
            try {
                this.initializeDatabase();
                const result = this.db.prepare('SELECT 1 as health').get();
                return result ? result.health === 1 : false;
            }
            catch (retryError) {
                logger_1.default.error('Database reinitialize failed:', retryError);
                return false;
            }
        }
    }
    // Execute query with retry logic
    executeWithRetry(operation, maxRetries = 3) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (!this.isInitialized) {
                    this.initializeDatabase();
                }
                return operation();
            }
            catch (error) {
                lastError = error;
                logger_1.default.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error);
                if (attempt < maxRetries) {
                    // Wait before retry
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    setTimeout(() => { }, delay);
                    // Try to reinitialize connection
                    try {
                        this.initializeDatabase();
                    }
                    catch (initError) {
                        logger_1.default.error('Failed to reinitialize database:', initError);
                    }
                }
            }
        }
        throw lastError;
    }
    // Backup method
    async backup(backupPath) {
        try {
            // The .backup() method in better-sqlite3 returns a Promise
            await this.db.backup(backupPath);
            logger_1.default.info(`Database backed up to: ${backupPath}`);
        }
        catch (error) {
            logger_1.default.error('Database backup failed:', error);
            throw error; // Re-throw the error to be caught by the route handler
        }
    }
    updateDatabasePath(newDbPath) {
        let resolvedNewDbPath = newDbPath;
        // For paths provided by admin, if not absolute, resolve them from a sensible project root or designated data directory.
        // For now, assuming projectRoot as calculated in constructor might be one level too deep if called from `dist` vs `src`
        const projectRootForUserPaths = path_1.default.resolve(__dirname, '..', '..', '..');
        if (!path_1.default.isAbsolute(newDbPath)) {
            resolvedNewDbPath = path_1.default.resolve(projectRootForUserPaths, newDbPath);
        }
        logger_1.default.info(`Attempting to switch database path to: ${resolvedNewDbPath}`);
        if (this.dbPath === resolvedNewDbPath && this.isInitialized) {
            logger_1.default.info('New database path is the same as the current one. No change needed.');
            return;
        }
        this.close();
        this.dbPath = resolvedNewDbPath;
        // process.env.DATABASE_PATH = resolvedNewDbPath; // Still keeping this commented for stability during login debug
        this.initializeDatabase();
        logger_1.default.info(`Successfully switched database to: ${this.dbPath}`);
    }
}
// Create singleton instance
const databaseManager = new DatabaseManager();
exports.default = databaseManager;
exports.db = databaseManager.getDatabase();
//# sourceMappingURL=database.js.map