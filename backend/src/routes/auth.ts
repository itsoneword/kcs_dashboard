import { Router, Response, NextFunction } from 'express';
import authService from '../services/authService';
import { AuthRequest, LoginRequest, CreateUserRequest, UpdateUserRolesRequest } from '../types';
import { authenticateToken, requireAdmin, requireAnyRole } from '../middleware/auth';
import logger, { logUserAction } from '../utils/logger';
import Joi from 'joi';

const router = Router();

// Validation schemas
const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().min(2).max(100).required()
});

const updateRolesSchema = Joi.object({
    is_coach: Joi.boolean().optional(),
    is_lead: Joi.boolean().optional(),
    is_admin: Joi.boolean().optional()
}).min(1);

// POST /api/auth/login - Mock authentication
router.post('/login', async (req, res: Response) => {
    try {
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const credentials: LoginRequest = value;
        const result = await authService.login(credentials);

        res.json({
            message: 'Login successful',
            user: result.user,
            token: result.token
        });

    } catch (error: any) {
        logger.error('Login error:', error);
        res.status(401).json({ error: error.message || 'Login failed' });
    }
});

// POST /api/auth/register - Register new user
router.post('/register', async (req, res: Response) => {
    try {
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const userData: CreateUserRequest = value;
        const result = await authService.register(userData);

        res.status(201).json({
            message: 'Registration successful',
            user: result.user,
            token: result.token
        });

    } catch (error: any) {
        logger.error('Registration error:', error);
        res.status(400).json({ error: error.message || 'Registration failed' });
    }
});

// POST /api/auth/logout - Logout (client-side token removal)
router.post('/logout', authenticateToken, (req: AuthRequest, res: Response) => {
    try {
        if (req.user) {
            logUserAction.logout(req.user.id);
        }

        res.json({ message: 'Logout successful' });
    } catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// GET /api/auth/me - Get current user info
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
    try {
        res.json({ user: req.user });
    } catch (error) {
        logger.error('Get user info error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// GET /api/auth/users - Get all users (admin, lead, and coach access)
router.get('/users', authenticateToken, requireAnyRole(['admin', 'lead', 'coach']), (req: AuthRequest, res: Response) => {
    try {
        const users = authService.getAllUsers();
        res.json({ users });
    } catch (error) {
        logger.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// PUT /api/auth/users/:id/roles - Update user roles (admin only)
router.put('/users/:id/roles', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { error, value } = updateRolesSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const targetUserId = parseInt(req.params.id);
        if (isNaN(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const roles: UpdateUserRolesRequest = value;
        const updatedUser = await authService.updateUserRoles(req.user!.id, targetUserId, roles);

        res.json({
            message: 'User roles updated successfully',
            user: updatedUser
        });

    } catch (error: any) {
        logger.error('Update user roles error:', error);
        res.status(400).json({ error: error.message || 'Failed to update user roles' });
    }
});

// DELETE /api/auth/users/:id - Soft delete user (admin only)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const targetUserId = parseInt(req.params.id);
        if (isNaN(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        await authService.deleteUser(req.user!.id, targetUserId);

        res.json({
            message: 'User deleted successfully'
        });

    } catch (error: any) {
        logger.error('Delete user error:', error);
        res.status(400).json({ error: error.message || 'Failed to delete user' });
    }
});

export default router; 