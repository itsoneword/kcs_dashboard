import Database from 'better-sqlite3';
declare class DatabaseManager {
    private db;
    private dbPath;
    private isInitialized;
    constructor();
    private initializeDatabase;
    private runMigrations;
    getDatabase(): Database.Database;
    close(): void;
    isHealthy(): boolean;
    executeWithRetry<T>(operation: () => T, maxRetries?: number): T;
    backup(backupPath: string): Promise<void>;
    updateDatabasePath(newDbPath: string): void;
}
declare const databaseManager: DatabaseManager;
export default databaseManager;
export declare const db: Database.Database;
//# sourceMappingURL=database.d.ts.map