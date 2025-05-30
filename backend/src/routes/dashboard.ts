import { Router, Response } from 'express';
import evaluationService from '../services/evaluationService';
import engineerService from '../services/engineerService';
import authService from '../services/authService';
import { AuthRequest } from '../types';
import { authenticateToken } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// GET /api/dashboard/overview - Get dashboard overview statistics
router.get('/overview', authenticateToken, (req: AuthRequest, res: Response) => {
    try {
        const user = req.user!;

        // Get current month for filtering
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const startOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
        const endOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

        // System-wide overview data (same for all users)
        const allEvaluations = evaluationService.getAllEvaluations();
        const thisMonthEvals = evaluationService.getAllEvaluations({
            startDate: startOfMonth,
            endDate: endOfMonth
        });
        const allEngineers = engineerService.getAllEngineers();
        const allUsers = authService.getAllUsers();

        const totalEvaluations = allEvaluations.length;
        const thisMonthEvaluations = thisMonthEvals.length;
        const totalEngineers = allEngineers.filter(e => e.is_active).length;
        const totalCoaches = allUsers.filter((u: any) => u.is_coach && !u.deleted_at).length;

        const overview = {
            total_evaluations: totalEvaluations,
            this_month_evaluations: thisMonthEvaluations,
            total_engineers: totalEngineers,
            total_coaches: totalCoaches,
            current_month: now.toLocaleString('default', { month: 'long', year: 'numeric' })
        };

        res.json({ overview });
    } catch (error: any) {
        logger.error('Dashboard overview error:', error);
        res.status(500).json({ error: error.message || 'Failed to get dashboard overview' });
    }
});

export default router; 