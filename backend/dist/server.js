"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_json_1 = __importDefault(require("../swagger.json"));
const logger_1 = __importDefault(require("./utils/logger"));
const database_1 = __importDefault(require("./database/database"));
const auth_1 = __importDefault(require("./routes/auth"));
const engineers_1 = __importDefault(require("./routes/engineers"));
const evaluations_1 = __importDefault(require("./routes/evaluations"));
const reports_1 = __importDefault(require("./routes/reports"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const admin_1 = __importDefault(require("./routes/admin"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Parse allowed origins from environment variable
const getAllowedOrigins = () => {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
        return ['http://localhost:5173']; // Default fallback
    }
    // Split by comma and trim whitespace
    return frontendUrl.split(',').map(url => url.trim());
};
// Security middleware
app.use((0, helmet_1.default)());
// CORS configuration
app.use((0, cors_1.default)({
    origin: getAllowedOrigins(),
    credentials: true
}));
// General rate limiting - more lenient
const generalLimiter = (0, express_rate_limit_1.default)({
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
const reportsLimiter = (0, express_rate_limit_1.default)({
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
const authLimiter = (0, express_rate_limit_1.default)({
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
const dashboardLimiter = (0, express_rate_limit_1.default)({
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
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Health check endpoint
app.get('/health', (req, res) => {
    const dbHealthy = database_1.default.isHealthy();
    const status = dbHealthy ? 'healthy' : 'unhealthy';
    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        database: dbHealthy ? 'connected' : 'disconnected'
    });
});
// API routes
app.use('/api/auth', authLimiter, auth_1.default);
app.use('/api/engineers', engineers_1.default);
app.use('/api/evaluations', evaluations_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/dashboard', dashboardLimiter, dashboard_1.default);
app.use('/api/admin', admin_1.default);
// Serve Swagger UI
app.use('/api/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_json_1.default));
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Global error handler
app.use((err, req, res, next) => {
    logger_1.default.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.default.info('SIGTERM received, shutting down gracefully');
    database_1.default.close();
    process.exit(0);
});
process.on('SIGINT', () => {
    logger_1.default.info('SIGINT received, shutting down gracefully');
    database_1.default.close();
    process.exit(0);
});
// Start server
app.listen(PORT, () => {
    logger_1.default.info(`KCS Portal Backend server running on port ${PORT}`);
    logger_1.default.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger_1.default.info(`Database health: ${database_1.default.isHealthy() ? 'OK' : 'ERROR'}`);
});
exports.default = app;
//# sourceMappingURL=server.js.map