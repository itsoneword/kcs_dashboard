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
            return res.status(401).json({ error: 'Access token required' });
        }

        const user = authService.verifyToken(token);
        req.user = user;
        next();
    } catch (error) {
        logger.error('Token verification failed:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Middleware to check if user is admin
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
};

// Middleware to check if user is lead
export const requireLead = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.is_lead && !req.user.is_admin) {
        return res.status(403).json({ error: 'Lead access required' });
    }

    next();
};

// Middleware to check if user is coach
export const requireCoach = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.is_coach && !req.user.is_admin) {
        return res.status(403).json({ error: 'Coach access required' });
    }

    next();
};

// Middleware to check if user has any of the specified roles
export const requireAnyRole = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const hasRole = roles.some(role => {
            switch (role) {
                case 'admin':
                    return req.user!.is_admin;
                case 'lead':
                    return req.user!.is_lead;
                case 'coach':
                    return req.user!.is_coach;
                default:
                    return false;
            }
        });

        if (!hasRole) {
            return res.status(403).json({ error: `Access denied. Required roles: ${roles.join(', ')}` });
        }

        next();
    };
}; 