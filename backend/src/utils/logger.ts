import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const logDir = process.env.LOG_DIR || '../logs';

// Create logger configuration
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'kcs-portal-backend' },
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),

        // Daily rotate file for general logs
        new DailyRotateFile({
            filename: path.join(logDir, 'backend-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: 'info'
        }),

        // Daily rotate file for error logs
        new DailyRotateFile({
            filename: path.join(logDir, 'backend-error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            level: 'error'
        }),

        // Daily rotate file for audit logs (user actions)
        new DailyRotateFile({
            filename: path.join(logDir, 'backend-audit-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '90d',
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ]
});

// Audit logging function for user actions
export const auditLog = (action: string, userId: number, targetType?: string, targetId?: number, details?: any) => {
    logger.info('AUDIT', {
        action,
        userId,
        targetType,
        targetId,
        details,
        timestamp: new Date().toISOString()
    });
};

// User action logging helpers
export const logUserAction = {
    login: (userId: number, email: string) =>
        auditLog('USER_LOGIN', userId, 'user', userId, { email }),

    logout: (userId: number) =>
        auditLog('USER_LOGOUT', userId, 'user', userId),

    roleChange: (adminId: number, targetUserId: number, oldRoles: any, newRoles: any) =>
        auditLog('ROLE_CHANGE', adminId, 'user', targetUserId, { oldRoles, newRoles }),

    evaluationCreate: (coachId: number, engineerId: number, evaluationId: number, evaluationDate: string) =>
        auditLog('EVALUATION_CREATE', coachId, 'evaluation', evaluationId, { engineerId, evaluationDate }),

    evaluationUpdate: (userId: number, evaluationId: number, changes: any) =>
        auditLog('EVALUATION_UPDATE', userId, 'evaluation', evaluationId, { changes }),

    engineerCreate: (leadId: number, engineerId: number, engineerName: string) =>
        auditLog('ENGINEER_CREATE', leadId, 'engineer', engineerId, { engineerName }),

    engineerUpdate: (userId: number, engineerId: number, updateData: any) =>
        auditLog('ENGINEER_UPDATE', userId, 'engineer', engineerId, { updateData }),

    assignmentCreate: (leadId: number, engineerId: number, coachId: number) =>
        auditLog('ASSIGNMENT_CREATE', leadId, 'assignment', engineerId, { coachId }),

    assignmentEnd: (leadId: number, assignmentId: number, engineerId: number, coachId: number) =>
        auditLog('ASSIGNMENT_END', leadId, 'assignment', assignmentId, { engineerId, coachId }),

    passwordChange: (userId: number, targetUserId: number) =>
        auditLog('PASSWORD_CHANGE', userId, 'user', targetUserId),
};

export default logger; 