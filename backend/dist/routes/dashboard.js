"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const evaluationService_1 = __importDefault(require("../services/evaluationService"));
const engineerService_1 = __importDefault(require("../services/engineerService"));
const authService_1 = __importDefault(require("../services/authService"));
const auth_1 = require("../middleware/auth");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// GET /api/dashboard/overview - Get dashboard overview statistics
router.get('/overview', auth_1.authenticateToken, (req, res) => {
    try {
        const user = req.user;
        // Get current month for filtering
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const startOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
        const endOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
        // System-wide overview data (same for all users)
        const allEvaluations = evaluationService_1.default.getAllEvaluations();
        const thisMonthEvals = evaluationService_1.default.getAllEvaluations({
            startDate: startOfMonth,
            endDate: endOfMonth
        });
        const allEngineers = engineerService_1.default.getAllEngineers();
        const allUsers = authService_1.default.getAllUsers();
        const totalEvaluations = allEvaluations.length;
        const thisMonthEvaluations = thisMonthEvals.length;
        const totalEngineers = allEngineers.filter(e => e.is_active).length;
        const totalCoaches = allUsers.filter((u) => u.is_coach && !u.deleted_at).length;
        const overview = {
            total_evaluations: totalEvaluations,
            this_month_evaluations: thisMonthEvaluations,
            total_engineers: totalEngineers,
            total_coaches: totalCoaches,
            current_month: now.toLocaleString('default', { month: 'long', year: 'numeric' })
        };
        res.json({ overview });
    }
    catch (error) {
        logger_1.default.error('Dashboard overview error:', error);
        res.status(500).json({ error: error.message || 'Failed to get dashboard overview' });
    }
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map