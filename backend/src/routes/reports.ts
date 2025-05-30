import { Router, Response, NextFunction } from 'express';
import evaluationService from '../services/evaluationService';
import engineerService from '../services/engineerService';
import { AuthRequest, ReportFilters } from '../types';
import { authenticateToken } from '../middleware/auth';
import logger from '../utils/logger';
import Joi from 'joi';

const router = Router();

// Validation schema for report filters
const reportFiltersSchema = Joi.object({
    engineer_id: Joi.number().integer().positive().optional(),
    engineer_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
    coach_user_id: Joi.number().integer().positive().optional(),
    lead_user_id: Joi.number().integer().positive().optional(),
    start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    quarter: Joi.string().valid('Q1', 'Q2', 'Q3', 'Q4').optional(),
    year: Joi.number().integer().min(2020).max(2030).optional()
});

// GET /api/reports/stats - Generate evaluation statistics
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = req.user!;

        // Parse engineer_ids from query parameters safely
        let engineerIds: number[] = [];
        if (req.query.engineer_ids) {
            const engineerIdsParam = req.query.engineer_ids;
            if (Array.isArray(engineerIdsParam)) {
                engineerIds = engineerIdsParam
                    .map(id => parseInt(String(id)))
                    .filter(id => !isNaN(id));
            } else {
                const parsed = parseInt(String(engineerIdsParam));
                if (!isNaN(parsed)) {
                    engineerIds = [parsed];
                }
            }
        }

        // Build filters object
        const filters: ReportFilters = {};

        // Add basic filters
        if (req.query.engineer_id) {
            const engineerId = parseInt(String(req.query.engineer_id));
            if (!isNaN(engineerId)) {
                filters.engineer_id = engineerId;
            }
        }

        if (engineerIds.length > 0) {
            filters.engineer_ids = engineerIds;
        }

        if (req.query.coach_user_id) {
            const coachId = parseInt(String(req.query.coach_user_id));
            if (!isNaN(coachId)) {
                filters.coach_user_id = coachId;
            }
        }

        if (req.query.lead_user_id) {
            const leadId = parseInt(String(req.query.lead_user_id));
            if (!isNaN(leadId)) {
                filters.lead_user_id = leadId;
            }
        }

        if (req.query.start_date) {
            filters.start_date = String(req.query.start_date);
        }

        if (req.query.end_date) {
            filters.end_date = String(req.query.end_date);
        }

        if (req.query.quarter) {
            filters.quarter = String(req.query.quarter);
        }

        if (req.query.year) {
            const year = parseInt(String(req.query.year));
            if (!isNaN(year)) {
                filters.year = year;
            }
        }

        // Apply role-based filtering
        if (!user.is_admin) {
            if (user.is_lead) {
                // Lead can only see stats for their engineers
                filters.lead_user_id = user.id;
            } else if (user.is_coach) {
                // Coach can only see their own stats
                filters.coach_user_id = user.id;
            } else {
                res.status(403).json({ error: 'Insufficient permissions' });
                return;
            }
        }

        const stats = evaluationService.generateStats(filters);

        res.json({
            stats,
            filters: filters
        });
    } catch (error: any) {
        logger.error('Generate stats error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate statistics' });
    }
});

// GET /api/reports/my-team - Get stats for current user's team
router.get('/my-team', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;

        if (!user.is_lead && !user.is_admin) {
            res.status(403).json({ error: 'Lead access required' });
            return;
        }

        const filters: ReportFilters = {};

        if (!user.is_admin) {
            filters.lead_user_id = user.id;
        }

        // Add date filters from query if provided
        const { start_date, end_date, year, quarter } = req.query;
        if (start_date) filters.start_date = start_date as string;
        if (end_date) filters.end_date = end_date as string;
        if (year) filters.year = parseInt(year as string);
        if (quarter) filters.quarter = quarter as string;

        const stats = evaluationService.generateStats(filters);

        res.json({
            stats,
            filters
        });
    } catch (error: any) {
        logger.error('Get team stats error:', error);
        res.status(500).json({ error: error.message || 'Failed to get team statistics' });
    }
});

// GET /api/reports/engineer/:id - Get stats for specific engineer
router.get('/engineer/:id', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const engineerId = parseInt(req.params.id);

        if (isNaN(engineerId)) {
            res.status(400).json({ error: 'Invalid engineer ID' });
            return;
        }

        // Check permissions
        if (!user.is_admin && !user.is_lead && !user.is_coach) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }

        const filters: ReportFilters = {
            engineer_id: engineerId
        };

        // Add date filters from query if provided
        const { start_date, end_date, year, quarter } = req.query;
        if (start_date) filters.start_date = start_date as string;
        if (end_date) filters.end_date = end_date as string;
        if (year) filters.year = parseInt(year as string);
        if (quarter) filters.quarter = quarter as string;

        // Apply role-based filtering (same as main stats endpoint)
        if (!user.is_admin) {
            if (user.is_lead) {
                // Lead can see stats for their engineers
                filters.lead_user_id = user.id;
            } else if (user.is_coach) {
                // Coach can see stats for their assigned engineers  
                filters.coach_user_id = user.id;
            } else {
                res.status(403).json({ error: 'Insufficient permissions' });
                return;
            }
        }

        const stats = evaluationService.generateStats(filters);

        res.json({
            stats,
            filters,
            engineer_id: engineerId
        });
    } catch (error: any) {
        logger.error('Get engineer stats error:', error);
        res.status(500).json({ error: error.message || 'Failed to get engineer statistics' });
    }
});

// GET /api/reports/quarterly - Get quarterly comparison report
router.get('/quarterly', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const { year } = req.query;

        if (!year) {
            res.status(400).json({ error: 'Year parameter is required' });
            return;
        }

        const reportYear = parseInt(year as string);
        if (isNaN(reportYear)) {
            res.status(400).json({ error: 'Invalid year' });
            return;
        }

        const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
        const quarterlyStats: any = {};

        for (const quarter of quarters) {
            const filters: ReportFilters = {
                year: reportYear,
                quarter: quarter
            };

            // Apply role-based filtering
            if (!user.is_admin) {
                if (user.is_lead) {
                    filters.lead_user_id = user.id;
                } else if (user.is_coach) {
                    filters.coach_user_id = user.id;
                } else {
                    res.status(403).json({ error: 'Insufficient permissions' });
                    return;
                }
            }

            quarterlyStats[quarter] = evaluationService.generateStats(filters);
        }

        res.json({
            year: reportYear,
            quarterly_stats: quarterlyStats
        });
    } catch (error: any) {
        logger.error('Get quarterly stats error:', error);
        res.status(500).json({ error: error.message || 'Failed to get quarterly statistics' });
    }
});

// GET /api/reports/evaluations - Get evaluations for specific filters (for quarter drill-down)
router.get('/evaluations', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;

        // Parse engineer_ids from query parameters (they come as strings)
        const queryParams = { ...req.query };
        if (queryParams.engineer_ids) {
            if (Array.isArray(queryParams.engineer_ids)) {
                queryParams.engineer_ids = queryParams.engineer_ids.map((id: string) => parseInt(id)).filter(id => !isNaN(id));
            } else {
                queryParams.engineer_ids = [parseInt(queryParams.engineer_ids as string)].filter(id => !isNaN(id));
            }
        }

        // Validate query parameters
        const { error, value } = reportFiltersSchema.validate(queryParams);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }

        const filters: ReportFilters = value;

        // Handle engineer_ids from query parameters manually
        if (req.query.engineer_ids) {
            const engineerIds = Array.isArray(req.query.engineer_ids)
                ? req.query.engineer_ids.map(id => parseInt(id as string)).filter(id => !isNaN(id))
                : [parseInt(req.query.engineer_ids as string)].filter(id => !isNaN(id));

            if (engineerIds.length > 0) {
                filters.engineer_ids = engineerIds;
            }
        }

        // Apply role-based filtering
        if (!user.is_admin) {
            if (user.is_lead) {
                // Lead can only see evaluations for their engineers
                filters.lead_user_id = user.id;
            } else if (user.is_coach) {
                // Coach can only see their own evaluations
                filters.coach_user_id = user.id;
            } else {
                res.status(403).json({ error: 'Insufficient permissions' });
                return;
            }
        }

        const evaluations = evaluationService.getAllEvaluations({
            engineerId: filters.engineer_id,
            coachUserId: filters.coach_user_id,
            leadUserId: filters.lead_user_id,
            startDate: filters.start_date,
            endDate: filters.end_date,
            year: filters.year
        });

        // Apply quarter filtering if specified
        let filteredEvaluations = evaluations;
        if (filters.quarter) {
            const quarterMonths: Record<string, [number, number]> = {
                'Q1': [1, 3],
                'Q2': [4, 6],
                'Q3': [7, 9],
                'Q4': [10, 12]
            };

            if (quarterMonths[filters.quarter]) {
                const [startMonth, endMonth] = quarterMonths[filters.quarter];
                filteredEvaluations = evaluations.filter(evaluation => {
                    const evalDate = new Date(evaluation.evaluation_date);
                    const month = evalDate.getMonth() + 1; // getMonth() returns 0-11
                    return month >= startMonth && month <= endMonth;
                });
            }
        }

        res.json({
            evaluations: filteredEvaluations,
            filters: filters
        });
    } catch (error: any) {
        logger.error('Get evaluations for reports error:', error);
        res.status(500).json({ error: error.message || 'Failed to get evaluations' });
    }
});

// GET /api/reports/engineers - Get engineers for filtering based on user role
router.get('/engineers', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        let engineers;

        if (user.is_admin) {
            // Admin can see all engineers
            engineers = engineerService.getAllEngineers(undefined, true);
        } else if (user.is_lead) {
            // Lead can see all engineers for reporting
            engineers = engineerService.getAllEngineers(undefined, true);
        } else if (user.is_coach) {
            // Coach can see all engineers for reporting
            engineers = engineerService.getAllEngineers(undefined, true);
        } else {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }

        res.json({ engineers });
    } catch (error: any) {
        logger.error('Get engineers for reports error:', error);
        res.status(500).json({ error: error.message || 'Failed to get engineers' });
    }
});

export default router; 