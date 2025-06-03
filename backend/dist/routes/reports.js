"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const evaluationService_1 = __importDefault(require("../services/evaluationService"));
const engineerService_1 = __importDefault(require("../services/engineerService"));
const joi_1 = __importDefault(require("joi"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Type guard for AuthRequest
function isAuthRequest(req) {
    return 'user' in req;
}
// Helper function to create a typed request handler
function createHandler(handler) {
    return async (req, res, next) => {
        if (!isAuthRequest(req)) {
            next(new Error('Invalid request type'));
            return;
        }
        try {
            await handler(req, res, next);
        }
        catch (error) {
            next(error);
        }
    };
}
// Validation schemas
const reportFiltersSchema = joi_1.default.object({
    year: joi_1.default.number().integer().min(2020).max(2025),
    quarter: joi_1.default.string().valid('Q1', 'Q2', 'Q3', 'Q4'),
    engineer_id: joi_1.default.number().integer().positive(),
    engineer_ids: joi_1.default.array().items(joi_1.default.number().integer().positive()),
    start_date: joi_1.default.date().iso(),
    end_date: joi_1.default.date().iso(),
    lead_user_id: joi_1.default.number().integer().positive(),
    coach_user_id: joi_1.default.number().integer().positive(),
    manager_id: joi_1.default.number().integer().positive()
});
// GET /api/reports/stats - Get evaluation stats based on filters
router.get('/stats', auth_1.authenticateToken, createHandler(async (req, res, next) => {
    const user = req.user;
    // Parse and validate query parameters
    const filters = {
        year: req.query.year ? parseInt(String(req.query.year)) : undefined,
        quarter: req.query.quarter,
        engineer_id: req.query.engineer_id ? parseInt(String(req.query.engineer_id)) : undefined,
        engineer_ids: req.query.engineer_ids ? String(req.query.engineer_ids).split(',').map(id => parseInt(id.trim())) : undefined,
        start_date: req.query.start_date,
        end_date: req.query.end_date
    };
    // Validate filters
    const { error } = reportFiltersSchema.validate(filters);
    if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
    }
    // Apply role-based filtering
    if (!user.is_admin) {
        if (user.is_lead) {
            filters.lead_user_id = user.id;
        }
        else if (user.is_coach) {
            filters.coach_user_id = user.id;
        }
        else if (user.is_manager) {
            filters.manager_id = user.id;
        }
        else {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
    }
    const stats = await evaluationService_1.default.generateStats(filters);
    res.json({ stats });
}));
// GET /api/reports/quarterly - Get quarterly stats for the specified year
router.get('/quarterly', auth_1.authenticateToken, createHandler(async (req, res, next) => {
    const user = req.user;
    const year = req.query.year ? parseInt(String(req.query.year)) : new Date().getFullYear();
    // For now, we'll use generateStats with quarterly filters
    const quarterlyStats = {};
    for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
        const stats = await evaluationService_1.default.generateStats({
            year,
            quarter,
            ...(user.is_lead ? { lead_user_id: user.id } : {}),
            ...(user.is_coach ? { coach_user_id: user.id } : {}),
            ...(user.is_manager ? { manager_id: user.id } : {})
        });
        quarterlyStats[quarter] = stats;
    }
    res.json({ quarterly_stats: quarterlyStats });
}));
// GET /api/reports/monthly - Get monthly stats for the specified filters
router.get('/monthly', auth_1.authenticateToken, createHandler(async (req, res, next) => {
    const user = req.user;
    // Parse and validate query parameters
    const filters = {
        year: req.query.year ? parseInt(String(req.query.year)) : undefined,
        quarter: req.query.quarter,
        engineer_id: req.query.engineer_id ? parseInt(String(req.query.engineer_id)) : undefined
    };
    // Validate filters
    const { error } = reportFiltersSchema.validate(filters);
    if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
    }
    // Apply role-based filtering
    if (!user.is_admin) {
        if (user.is_lead) {
            filters.lead_user_id = user.id;
        }
        else if (user.is_coach) {
            filters.coach_user_id = user.id;
        }
        else if (user.is_manager) {
            filters.manager_id = user.id;
        }
        else {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
    }
    // Get monthly data by generating stats for each month
    const monthlyData = [];
    const year = filters.year || new Date().getFullYear();
    for (let month = 1; month <= 12; month++) {
        const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        const monthlyStats = await evaluationService_1.default.generateStats({
            ...filters,
            start_date: startDate,
            end_date: endDate
        });
        monthlyData.push({
            month: new Date(year, month - 1).toLocaleString('default', { month: 'short' }),
            month_number: month,
            stats: monthlyStats
        });
    }
    res.json({ monthly_data: monthlyData });
}));
// GET /api/reports/engineers - Get engineers for filtering based on user role
router.get('/engineers', auth_1.authenticateToken, createHandler(async (req, res, next) => {
    const user = req.user;
    let engineers;
    if (user.is_admin) {
        engineers = await engineerService_1.default.getAllEngineers();
    }
    else if (user.is_lead) {
        engineers = await engineerService_1.default.getEngineersByLead(user.id);
    }
    else if (user.is_coach) {
        engineers = await engineerService_1.default.getEngineersByCoach(user.id);
    }
    else if (user.is_manager) {
        // Allow managers to view engineers; returning all engineers similar to admin for now
        engineers = await engineerService_1.default.getAllEngineers();
    }
    else {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
    }
    res.json({ engineers });
}));
// POST /api/reports/batch - Get all report data in a single call
router.post('/batch', auth_1.authenticateToken, createHandler(async (req, res, next) => {
    const user = req.user;
    // Validate request body
    const { error, value } = joi_1.default.object({
        filters: reportFiltersSchema.required(),
        include_monthly: joi_1.default.boolean().default(true),
        include_quarterly: joi_1.default.boolean().default(true),
        include_individual: joi_1.default.boolean().default(true),
        engineer_ids: joi_1.default.array().items(joi_1.default.number().integer().positive()).optional()
    }).validate(req.body);
    if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
    }
    const { filters, include_monthly, include_quarterly, include_individual, engineer_ids } = value;
    // Apply role-based filtering
    if (!user.is_admin) {
        if (user.is_lead) {
            filters.lead_user_id = user.id;
        }
        else if (user.is_coach) {
            filters.coach_user_id = user.id;
        }
        else if (user.is_manager) {
            filters.manager_id = user.id;
        }
        else {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
    }
    // Get overall stats
    const overallStats = await evaluationService_1.default.generateStats(filters);
    // Get quarterly stats if requested
    let quarterlyStats = null;
    if (include_quarterly) {
        quarterlyStats = {};
        for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
            quarterlyStats[quarter] = await evaluationService_1.default.generateStats({
                ...filters,
                quarter
            });
        }
    }
    // Get individual stats if requested
    let individualStats = {};
    if (include_individual && engineer_ids?.length) {
        for (const engineerId of engineer_ids) {
            const engineerFilters = { ...filters, engineer_id: engineerId };
            const stats = await evaluationService_1.default.generateStats(engineerFilters);
            individualStats[engineerId] = stats;
        }
    }
    // Get monthly data if requested
    let monthlyData = {};
    if (include_monthly && engineer_ids?.length) {
        for (const engineerId of engineer_ids) {
            const monthlyStats = [];
            const year = filters.year || new Date().getFullYear();
            for (let month = 1; month <= 12; month++) {
                const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
                const endDate = new Date(year, month, 0).toISOString().split('T')[0];
                const stats = await evaluationService_1.default.generateStats({
                    ...filters,
                    engineer_id: engineerId,
                    start_date: startDate,
                    end_date: endDate
                });
                monthlyStats.push({
                    month: new Date(year, month - 1).toLocaleString('default', { month: 'short' }),
                    month_number: month,
                    stats
                });
            }
            monthlyData[engineerId] = monthlyStats;
        }
    }
    res.json({
        overall_stats: overallStats,
        quarterly_stats: quarterlyStats,
        individual_stats: individualStats,
        monthly_data: monthlyData
    });
}));
// Helper to parse engineer IDs from query param
function parseEngineerIds(ids) {
    if (Array.isArray(ids)) {
        return ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    }
    return ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
}
// Batch stats endpoint
router.get('/batch-stats', auth_1.authenticateToken, createHandler(async (req, res, next) => {
    const user = req.user;
    // Parse filters
    const filters = {};
    const year = parseInt(req.query.year);
    if (!isNaN(year))
        filters.year = year;
    if (req.query.quarter)
        filters.quarter = req.query.quarter;
    if (req.query.start_date)
        filters.start_date = req.query.start_date;
    if (req.query.end_date)
        filters.end_date = req.query.end_date;
    // Parse engineer IDs
    const engineerIds = req.query.engineer_ids ? parseEngineerIds(req.query.engineer_ids) : [];
    // Get overall stats for all selected engineers
    const overallStats = await evaluationService_1.default.generateStats({
        ...filters,
        engineer_ids: engineerIds
    });
    // Get quarterly stats for the year
    const quarterlyStats = {};
    for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
        quarterlyStats[quarter] = await evaluationService_1.default.generateStats({
            ...filters,
            year,
            quarter
        });
    }
    // Get individual stats for each engineer
    const individualStats = {};
    const monthlyData = {};
    if (engineerIds.length > 0) {
        // Get all monthly data in one query per engineer
        for (const engineerId of engineerIds) {
            // Get individual stats
            individualStats[engineerId.toString()] = await evaluationService_1.default.generateStats({
                ...filters,
                engineer_id: engineerId
            });
            // Get monthly data
            const monthlyStats = [];
            for (let month = 1; month <= 12; month++) {
                const startDate = new Date(year, month - 1, 1);
                const endDate = new Date(year, month, 0);
                const stats = await evaluationService_1.default.generateStats({
                    year,
                    engineer_id: engineerId,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                });
                monthlyStats.push({
                    month: new Date(0, month - 1).toLocaleString('default', { month: 'short' }),
                    month_number: month,
                    stats
                });
            }
            monthlyData[engineerId.toString()] = monthlyStats;
        }
    }
    res.json({
        overall_stats: overallStats,
        quarterly_stats: quarterlyStats,
        individual_stats: individualStats,
        monthly_data: monthlyData
    });
}));
exports.default = router;
//# sourceMappingURL=reports.js.map