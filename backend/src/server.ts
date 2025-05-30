import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

import logger from './utils/logger';
import databaseManager from './database/database';
import authRoutes from './routes/auth';
import engineerRoutes from './routes/engineers';
import evaluationRoutes from './routes/evaluations';
import reportRoutes from './routes/reports';
import dashboardRoutes from './routes/dashboard';
import adminRoutes from './routes/admin';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Parse allowed origins from environment variable
const getAllowedOrigins = (): string[] => {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
        return ['http://localhost:5173']; // Default fallback
    }
    // Split by comma and trim whitespace
    return frontendUrl.split(',').map(url => url.trim());
};

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: getAllowedOrigins(),
    credentials: true
}));

// General rate limiting - more lenient
const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '30000'), // 30 seconds
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'), // Increased drastically for debugging
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for auth routes - they have their own limiter
        return req.path.startsWith('/api/auth');
    }
});

// Specific rate limiter for authentication routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Allow much more auth requests per 15 minutes per IP
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use IP + user agent for more specific rate limiting
        return (req.ip || 'unknown') + (req.get('User-Agent') || 'unknown');
    }
});

// Lenient rate limiter for dashboard routes
const dashboardLimiter = rateLimit({
    windowMs: 15 * 60 * 100, // 1.5 minutes
    max: 1000, // Allow 10000 dashboard requests per 15 minutes per IP (very high for debugging)
    message: { error: 'Too many requests. Please wait a moment and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    const dbHealthy = databaseManager.isHealthy();
    const status = dbHealthy ? 'healthy' : 'unhealthy';
    const statusCode = dbHealthy ? 200 : 503;

    res.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        database: dbHealthy ? 'connected' : 'disconnected'
    });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/engineers', engineerRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardLimiter, dashboardRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    databaseManager.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    databaseManager.close();
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    logger.info(`KCS Portal Backend server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Database health: ${databaseManager.isHealthy() ? 'OK' : 'ERROR'}`);
});

export default app; 