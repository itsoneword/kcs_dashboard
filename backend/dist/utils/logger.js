"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUserAction = exports.auditLog = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const logDir = process.env.LOG_DIR || '../logs';
// Create logger configuration
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: { service: 'kcs-portal-backend' },
    transports: [
        // Console transport for development
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        }),
        // Daily rotate file for general logs
        new winston_daily_rotate_file_1.default({
            filename: path_1.default.join(logDir, 'backend-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: 'info'
        }),
        // Daily rotate file for error logs
        new winston_daily_rotate_file_1.default({
            filename: path_1.default.join(logDir, 'backend-error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            level: 'error'
        }),
        // Daily rotate file for audit logs (user actions)
        new winston_daily_rotate_file_1.default({
            filename: path_1.default.join(logDir, 'backend-audit-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '90d',
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json())
        })
    ]
});
// Audit logging function for user actions
const auditLog = (action, userId, targetType, targetId, details) => {
    logger.info('AUDIT', {
        action,
        userId,
        targetType,
        targetId,
        details,
        timestamp: new Date().toISOString()
    });
};
exports.auditLog = auditLog;
// User action logging helpers
exports.logUserAction = {
    login: (userId, email) => (0, exports.auditLog)('USER_LOGIN', userId, 'user', userId, { email }),
    logout: (userId) => (0, exports.auditLog)('USER_LOGOUT', userId, 'user', userId),
    roleChange: (adminId, targetUserId, oldRoles, newRoles) => (0, exports.auditLog)('ROLE_CHANGE', adminId, 'user', targetUserId, { oldRoles, newRoles }),
    evaluationCreate: (coachId, engineerId, evaluationId, evaluationDate) => (0, exports.auditLog)('EVALUATION_CREATE', coachId, 'evaluation', evaluationId, { engineerId, evaluationDate }),
    evaluationUpdate: (userId, evaluationId, changes) => (0, exports.auditLog)('EVALUATION_UPDATE', userId, 'evaluation', evaluationId, { changes }),
    engineerCreate: (leadId, engineerId, engineerName) => (0, exports.auditLog)('ENGINEER_CREATE', leadId, 'engineer', engineerId, { engineerName }),
    engineerUpdate: (userId, engineerId, updateData) => (0, exports.auditLog)('ENGINEER_UPDATE', userId, 'engineer', engineerId, { updateData }),
    assignmentCreate: (leadId, engineerId, coachId) => (0, exports.auditLog)('ASSIGNMENT_CREATE', leadId, 'assignment', engineerId, { coachId }),
    assignmentEnd: (leadId, assignmentId, engineerId, coachId) => (0, exports.auditLog)('ASSIGNMENT_END', leadId, 'assignment', assignmentId, { engineerId, coachId }),
    passwordChange: (userId, targetUserId) => (0, exports.auditLog)('PASSWORD_CHANGE', userId, 'user', targetUserId),
};
exports.default = logger;
//# sourceMappingURL=logger.js.map