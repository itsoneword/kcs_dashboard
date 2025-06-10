import { Router, Response, NextFunction, Request, RequestHandler } from 'express';
import { User, EvaluationStats } from '../types';
import evaluationService from '../services/evaluationService';
import engineerService from '../services/engineerService';
import Joi from 'joi';
import logger from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import type { AuthRequest } from '../types';

const router = Router();

interface ReportFilters {
    year?: number;
    quarter?: string;
    engineer_id?: number;
    engineer_ids?: number[];
    start_date?: string;
    end_date?: string;
    lead_user_id?: number;
    coach_user_id?: number;
    manager_id?: number;
}

interface MonthlyData {
    month: string;
    month_number: number;
    stats: EvaluationStats;
}

interface QuarterlyStats {
    [quarter: string]: EvaluationStats;
}

interface IndividualStats {
    [engineerId: number]: EvaluationStats;
}

interface MonthlyDataMap {
    [engineerId: number]: MonthlyData[];
}

// Type guard for AuthRequest
function isAuthRequest(req: Request): req is AuthRequest {
    return 'user' in req;
}

// Helper function to create a typed request handler
function createHandler(handler: (req: AuthRequest, res: Response, next: NextFunction) => any): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!isAuthRequest(req)) {
            next(new Error('Invalid request type'));
            return;
        }
        try {
            await handler(req, res, next);
        } catch (error) {
            next(error);
        }
    };
}

// Validation schemas
const reportFiltersSchema = Joi.object({
    year: Joi.number().integer().min(2020).max(2025),
    quarter: Joi.string().valid('Q1', 'Q2', 'Q3', 'Q4'),
    engineer_id: Joi.number().integer().positive(),
    engineer_ids: Joi.array().items(Joi.number().integer().positive()),
    start_date: Joi.date().iso(),
    end_date: Joi.date().iso(),
    lead_user_id: Joi.number().integer().positive(),
    coach_user_id: Joi.number().integer().positive(),
    manager_id: Joi.number().integer().positive()
});

// GET /api/reports/stats - Get evaluation stats based on filters
router.get('/stats', authenticateToken, createHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user!;

    // Parse and validate query parameters
    const filters: ReportFilters = {
        year: req.query.year ? parseInt(String(req.query.year)) : undefined,
        quarter: req.query.quarter as string | undefined,
        engineer_id: req.query.engineer_id ? parseInt(String(req.query.engineer_id)) : undefined,
        engineer_ids: req.query.engineer_ids ? String(req.query.engineer_ids).split(',').map(id => parseInt(id.trim())) : undefined,
        start_date: req.query.start_date as string | undefined,
        end_date: req.query.end_date as string | undefined
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
        } else if (user.is_coach) {
            filters.coach_user_id = user.id;
        } else if (user.is_manager) {
            filters.manager_id = user.id;
        } else {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
    }

    const stats = await evaluationService.generateStats(filters);
    res.json({ stats });
}));

// GET /api/reports/quarterly - Get quarterly stats for the specified year
router.get('/quarterly', authenticateToken, createHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user!;
    const year = req.query.year ? parseInt(String(req.query.year)) : new Date().getFullYear();

    // For now, we'll use generateStats with quarterly filters
    const quarterlyStats: Record<string, any> = {};
    for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
        const stats = await evaluationService.generateStats({
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
router.get('/monthly', authenticateToken, createHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user!;

    // Parse and validate query parameters
    const filters: ReportFilters = {
        year: req.query.year ? parseInt(String(req.query.year)) : undefined,
        quarter: req.query.quarter as string | undefined,
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
        } else if (user.is_coach) {
            filters.coach_user_id = user.id;
        } else if (user.is_manager) {
            filters.manager_id = user.id;
        } else {
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

        const monthlyStats = await evaluationService.generateStats({
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
router.get('/engineers', authenticateToken, createHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user!;
    let engineers;

    if (user.is_admin || user.is_manager) {
        engineers = await engineerService.getAllEngineers();
    } else if (user.is_lead) {
        engineers = await engineerService.getEngineersByLead(user.id);
    } else if (user.is_coach) {
        engineers = await engineerService.getEngineersByCoach(user.id);
    }  else {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
    }

    res.json({ engineers });
}));

// POST /api/reports/batch - Get all report data in a single call
router.post('/batch', authenticateToken, createHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user!;

    // Validate request body
    const { error, value } = Joi.object({
        filters: reportFiltersSchema.required(),
        include_monthly: Joi.boolean().default(true),
        include_quarterly: Joi.boolean().default(true),
        include_individual: Joi.boolean().default(true),
        engineer_ids: Joi.array().items(Joi.number().integer().positive()).optional()
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
        } else if (user.is_coach) {
            filters.coach_user_id = user.id;
        } else if (user.is_manager) {
            filters.manager_id = user.id;
        } else {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
    }

    // Get overall stats
    const overallStats = await evaluationService.generateStats(filters);

    // Get quarterly stats if requested
    let quarterlyStats: QuarterlyStats | null = null;
    if (include_quarterly) {
        quarterlyStats = {};
        for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
            quarterlyStats[quarter] = await evaluationService.generateStats({
                ...filters,
                quarter
            });
        }
    }

    // Get individual stats if requested
    let individualStats: IndividualStats = {};
    if (include_individual && engineer_ids?.length) {
        for (const engineerId of engineer_ids) {
            const engineerFilters = { ...filters, engineer_id: engineerId };
            const stats = await evaluationService.generateStats(engineerFilters);
            individualStats[engineerId] = stats;
        }
    }

    // Get monthly data if requested
    let monthlyData: MonthlyDataMap = {};
    if (include_monthly && engineer_ids?.length) {
        for (const engineerId of engineer_ids) {
            const monthlyStats = [];
            const year = filters.year || new Date().getFullYear();

            for (let month = 1; month <= 12; month++) {
                const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
                const endDate = new Date(year, month, 0).toISOString().split('T')[0];

                const stats = await evaluationService.generateStats({
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
function parseEngineerIds(ids: string | string[]): number[] {
    if (Array.isArray(ids)) {
        return ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    }
    return ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
}

// Batch stats endpoint
router.get('/batch-stats', authenticateToken, createHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user!;

    // Parse filters
    const filters: ReportFilters = {};
    const year = parseInt(req.query.year as string);
    if (!isNaN(year)) filters.year = year;

    if (req.query.quarter) filters.quarter = req.query.quarter as string;
    if (req.query.start_date) filters.start_date = req.query.start_date as string;
    if (req.query.end_date) filters.end_date = req.query.end_date as string;

    // Parse engineer IDs
    const engineerIds = req.query.engineer_ids ? parseEngineerIds(req.query.engineer_ids as string) : [];

    // Get overall stats for all selected engineers
    const overallStats = await evaluationService.generateStats({
        ...filters,
        engineer_ids: engineerIds
    });

    // Get quarterly stats for the year
    const quarterlyStats: Record<string, EvaluationStats> = {};
    for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
        quarterlyStats[quarter] = await evaluationService.generateStats({
            ...filters,
            year,
            quarter
        });
    }

    // Get individual stats for each engineer
    const individualStats: Record<string, EvaluationStats> = {};
    const monthlyData: Record<string, any[]> = {};

    if (engineerIds.length > 0) {
        // Get all monthly data in one query per engineer
        for (const engineerId of engineerIds) {
            // Get individual stats
            individualStats[engineerId.toString()] = await evaluationService.generateStats({
                ...filters,
                engineer_id: engineerId
            });

            // Get monthly data
            const monthlyStats = [];
            for (let month = 1; month <= 12; month++) {
                const startDate = new Date(year, month - 1, 1);
                const endDate = new Date(year, month, 0);

                const stats = await evaluationService.generateStats({
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

export default router; 