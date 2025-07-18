import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';
import { AuthRequest } from '../types';
import logger from '../utils/logger';

// Middleware to verify JWT token
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            res.status(401).json({ error: 'Access token required' });
            return;
        }

        const user = authService.verifyToken(token);
        req.user = user;
        next();
    } catch (error) {
        logger.error('Token verification failed:', error);
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
    }
};

// Middleware to check if user is admin
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
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

// Middleware to check if user is lead
export const requireLead = (req: AuthRequest, res: Response, next: NextFunction) => {
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

// Middleware to check if user is coach
export const requireCoach = (req: AuthRequest, res: Response, next: NextFunction) => {
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

// Middleware to check if user has any of the specified roles
export const requireAnyRole = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const hasRole = roles.some(role => {
            switch (role) {
                case 'admin':
                    return req.user!.is_admin;
                case 'lead':
                    return req.user!.is_lead;
                case 'coach':
                    return req.user!.is_coach;
                case 'manager':
                    return req.user!.is_manager;
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