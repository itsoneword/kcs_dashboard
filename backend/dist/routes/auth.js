"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authService_1 = __importDefault(require("../services/authService"));
const auth_1 = require("../middleware/auth");
const logger_1 = __importStar(require("../utils/logger"));
const joi_1 = __importDefault(require("joi"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../database/database");
const router = (0, express_1.Router)();
// Validation schemas
const loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(6).required()
});
const registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(6).required(),
    name: joi_1.default.string().min(2).max(100).required(),
    role: joi_1.default.string().valid('coach', 'lead', 'manager').default('coach')
});
const updateRolesSchema = joi_1.default.object({
    is_coach: joi_1.default.boolean().optional(),
    is_lead: joi_1.default.boolean().optional(),
    is_admin: joi_1.default.boolean().optional(),
    is_manager: joi_1.default.boolean().optional()
}).min(1);
// POST /api/auth/login - Mock authentication
router.post('/login', async (req, res) => {
    try {
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        const credentials = value;
        const result = await authService_1.default.login(credentials);
        res.json({
            message: 'Login successful',
            user: result.user,
            token: result.token
        });
    }
    catch (error) {
        logger_1.default.error('Login error:', error);
        res.status(401).json({ error: error.message || 'Login failed' });
    }
});
// POST /api/auth/register - Register new user
router.post('/register', async (req, res) => {
    try {
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        const userData = value;
        const result = await authService_1.default.register(userData);
        res.status(201).json({
            message: 'Registration successful',
            user: result.user,
            token: result.token
        });
    }
    catch (error) {
        logger_1.default.error('Registration error:', error);
        res.status(400).json({ error: error.message || 'Registration failed' });
    }
});
// POST /api/auth/logout - Logout (client-side token removal)
router.post('/logout', auth_1.authenticateToken, (req, res) => {
    try {
        if (req.user) {
            logger_1.logUserAction.logout(req.user.id);
        }
        res.json({ message: 'Logout successful' });
    }
    catch (error) {
        logger_1.default.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});
// GET /api/auth/me - Get current user info
router.get('/me', auth_1.authenticateToken, (req, res) => {
    try {
        res.json({ user: req.user });
    }
    catch (error) {
        logger_1.default.error('Get user info error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});
// GET /api/auth/users - Get all users (admin, lead, and coach access)
router.get('/users', auth_1.authenticateToken, (0, auth_1.requireAnyRole)(['admin', 'lead', 'coach', 'manager']), (req, res) => {
    try {
        const users = authService_1.default.getAllUsers();
        res.json({ users });
    }
    catch (error) {
        logger_1.default.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});
// PUT /api/auth/users/:id/roles - Update user roles (admin only)
router.put('/users/:id/roles', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { error, value } = updateRolesSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        const targetUserId = parseInt(req.params.id);
        if (isNaN(targetUserId)) {
            res.status(400).json({ error: 'Invalid user ID' });
            return;
        }
        const roles = value;
        const updatedUser = await authService_1.default.updateUserRoles(req.user.id, targetUserId, roles);
        res.json({
            message: 'User roles updated successfully',
            user: updatedUser
        });
    }
    catch (error) {
        logger_1.default.error('Update user roles error:', error);
        res.status(400).json({ error: error.message || 'Failed to update user roles' });
    }
});
// DELETE /api/auth/users/:id - Soft delete user (admin only)
router.delete('/users/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id);
        if (isNaN(targetUserId)) {
            res.status(400).json({ error: 'Invalid user ID' });
            return;
        }
        await authService_1.default.deleteUser(req.user.id, targetUserId);
        res.json({
            message: 'User deleted successfully'
        });
    }
    catch (error) {
        logger_1.default.error('Delete user error:', error);
        res.status(400).json({ error: error.message || 'Failed to delete user' });
    }
});
// POST /api/auth/users/:id/password - Change user password
router.post('/users/:id/password', auth_1.authenticateToken, async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id);
        if (isNaN(targetUserId)) {
            res.status(400).json({ error: 'Invalid user ID' });
            return;
        }
        // Allow only admin or the user themselves
        if (req.user.id !== targetUserId && !req.user.is_admin) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const { newPassword } = req.body;
        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters long' });
            return;
        }
        // Update password
        const passwordHash = bcryptjs_1.default.hashSync(newPassword, 12);
        database_1.db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(passwordHash, targetUserId);
        // Log password change
        logger_1.logUserAction.passwordChange(req.user.id, targetUserId);
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        logger_1.default.error('Change password error:', error);
        res.status(500).json({ error: error.message || 'Failed to change password' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map