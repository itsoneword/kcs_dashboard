import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from '../swagger.json';

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
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

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

// CORS configuration: dynamically reflect request origin to support changing server IPs/DNS
app.use(cors({
    origin: (origin, callback) => {
        // allow non-browser tools or missing origin
        if (!origin) return callback(null, true);

        // echo back request origin to allow dynamic hosts/IPs
        return callback(null, true);
    },
    credentials: true
}));

// General rate limiting - more lenient
const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '30000'), // 30 seconds
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5000'), // Increased drastically for debugging
    standardHeaders: true,
    legacyHeaders: false,
    // For development, use a simpler key generator that's more reliable
    keyGenerator: (req) => {
        return 'global_limit'; // Use a single bucket for all requests in development
    },
    skip: (req, res) => process.env.NODE_ENV === 'development', // Skip rate limiting in development
});

// Reports rate limiting - even more lenient
const reportsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10000, // Allow many more requests for reports during development
    standardHeaders: true,
    legacyHeaders: false,
    // For development, use a simpler key generator that's more reliable
    keyGenerator: (req) => {
        return 'reports_limit'; // Use a single bucket for all reports requests in development
    },
    skip: (req, res) => process.env.NODE_ENV === 'development', // Skip rate limiting in development
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
    windowMs: 1.5 * 60 * 1000, // 1.5 minutes (fixed calculation)
    max: 1000, // Allow 1000 dashboard requests per 1.5 minutes
    message: { error: 'Too many requests. Please wait a moment and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
    // For development, use a simpler key generator that's more reliable
    keyGenerator: (req) => {
        return 'dashboard_limit'; // Use a single bucket for all dashboard requests in development
    },
    skip: (req, res) => process.env.NODE_ENV === 'development', // Skip rate limiting in development
});

// Apply rate limiting - general limiter first, then more specific ones
app.use('/api', generalLimiter);
app.use('/api/reports', reportsLimiter);

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

// Serve Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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
app.listen(PORT, HOST, () => {
    logger.info(`KCS Portal Backend server running at http://${HOST}:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Database health: ${databaseManager.isHealthy() ? 'OK' : 'ERROR'}`);
});

export default app; 