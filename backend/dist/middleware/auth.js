"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAnyRole = exports.requireCoach = exports.requireLead = exports.requireAdmin = exports.authenticateToken = void 0;
const authService_1 = __importDefault(require("../services/authService"));
const logger_1 = __importDefault(require("../utils/logger"));
// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            res.status(401).json({ error: 'Access token required' });
            return;
        }
        const user = authService_1.default.verifyToken(token);
        req.user = user;
        next();
    }
    catch (error) {
        logger_1.default.error('Token verification failed:', error);
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
    }
};
exports.authenticateToken = authenticateToken;
// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    if (!req.user.is_admin && !req.user.is_manager) {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
// Middleware to check if user is lead
const requireLead = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    if (!req.user.is_lead && !req.user.is_admin) {
        res.status(403).json({ error: 'Lead access required' });
        return;
    }
    next();
};
exports.requireLead = requireLead;
// Middleware to check if user is coach
const requireCoach = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    if (!req.user.is_coach && !req.user.is_admin) {
        res.status(403).json({ error: 'Coach access required' });
        return;
    }
    next();
};
exports.requireCoach = requireCoach;
// Middleware to check if user has any of the specified roles
const requireAnyRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const hasRole = roles.some(role => {
            switch (role) {
                case 'admin':
                    return req.user.is_admin;
                case 'lead':
                    return req.user.is_lead;
                case 'coach':
                    return req.user.is_coach;
                case 'manager':
                    return req.user.is_manager;
                default:
                    return false;
            }
        });
        if (!hasRole) {
            res.status(403).json({ error: `Access denied. Required roles: ${roles.join(', ')}` });
            return;
        }
        next();
    };
};
exports.requireAnyRole = requireAnyRole;
//# sourceMappingURL=auth.js.map