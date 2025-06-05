"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const engineerService_1 = __importDefault(require("../services/engineerService"));
const coachAssignmentService_1 = __importDefault(require("../services/coachAssignmentService"));
const auth_1 = require("../middleware/auth");
const logger_1 = __importStar(require("../utils/logger"));
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// Validation schemas
const createEngineerSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(100).required(),
    lead_user_id: joi_1.default.number().integer().positive().optional()
});
const updateEngineerSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(100).optional(),
    lead_user_id: joi_1.default.number().integer().positive().allow(null).optional(),
    is_active: joi_1.default.boolean().optional()
}).min(1);
const createAssignmentSchema = joi_1.default.object({
    engineer_id: joi_1.default.number().integer().positive().required(),
    coach_user_id: joi_1.default.number().integer().positive().required(),
    start_date: joi_1.default.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
});
// GET /api/engineers - Get all engineers (filtered by role)
router.get('/', auth_1.authenticateToken, (req, res, next) => {
    try {
        const user = req.user;
        let engineers;
        // Hierarchical permissions: Admin > Lead > Coach
        if (user.is_admin) {
            // Admin can see all engineers
            engineers = engineerService_1.default.getAllEngineers();
        }
        else if (user.is_lead) {
            // Lead can see all engineers (for filtering and management)
            engineers = engineerService_1.default.getAllEngineers();
        }
        else if (user.is_coach) {
            // Coach can see all engineers (for evaluations)
            engineers = engineerService_1.default.getAllEngineers();
        }
        else if (user.is_manager) {
            // Manager can see all engineers (for filtering and management)
            engineers = engineerService_1.default.getAllEngineers();
        }
        else {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        res.json({ engineers });
    }
    catch (error) {
        logger_1.default.error('Get engineers error:', error);
        res.status(500).json({ error: error.message || 'Failed to get engineers' });
    }
});
// GET /api/engineers/for-evaluation - Get engineers available for evaluation creation
router.get('/for-evaluation', auth_1.authenticateToken, (req, res, next) => {
    try {
        const user = req.user;
        let engineers;
        if (user.is_admin || user.is_coach || user.is_lead || user.is_manager) {
            // All authenticated users can see all active engineers
            engineers = engineerService_1.default.getAllEngineers(undefined, true);
        }
        else {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        res.json({ engineers });
    }
    catch (error) {
        logger_1.default.error('Get engineers for evaluation error:', error);
        res.status(500).json({ error: error.message || 'Failed to get engineers for evaluation' });
    }
});
// GET /api/engineers/by-coach/:coachId - Get engineers assigned to a specific coach
router.get('/by-coach/:coachId', auth_1.authenticateToken, (req, res, next) => {
    try {
        const user = req.user;
        const coachId = parseInt(req.params.coachId);
        if (isNaN(coachId)) {
            res.status(400).json({ error: 'Invalid coach ID' });
            return;
        }
        // Check permissions - coaches can only see their own assignments, admins can see all
        if (!user.is_admin && user.id !== coachId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const engineers = engineerService_1.default.getEngineersByCoach(coachId);
        res.json({ engineers });
    }
    catch (error) {
        logger_1.default.error('Get engineers by coach error:', error);
        res.status(500).json({ error: error.message || 'Failed to get engineers by coach' });
    }
});
// GET /api/engineers/by-lead/:leadId - Get engineers assigned to a specific lead
router.get('/by-lead/:leadId', auth_1.authenticateToken, (req, res, next) => {
    try {
        const user = req.user;
        const leadId = parseInt(req.params.leadId);
        if (isNaN(leadId)) {
            res.status(400).json({ error: 'Invalid lead ID' });
            return;
        }
        // Check permissions - leads can only see their own team, admins can see all
        if (!user.is_admin && user.id !== leadId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const engineers = engineerService_1.default.getEngineersByLead(leadId);
        res.json({ engineers });
    }
    catch (error) {
        logger_1.default.error('Get engineers by lead error:', error);
        res.status(500).json({ error: error.message || 'Failed to get engineers by lead' });
    }
});
// GET /api/engineers/search - Search engineers by name
router.get('/search', auth_1.authenticateToken, (req, res, next) => {
    try {
        const user = req.user;
        const { q: searchTerm } = req.query;
        if (!searchTerm || typeof searchTerm !== 'string') {
            res.status(400).json({ error: 'Search term is required' });
            return;
        }
        let engineers;
        if (user.is_admin) {
            engineers = engineerService_1.default.searchEngineers(searchTerm);
        }
        else if (user.is_lead) {
            engineers = engineerService_1.default.searchEngineers(searchTerm, user.id);
        }
        else if (user.is_manager) {
            engineers = engineerService_1.default.searchEngineers(searchTerm);
        }
        else if (user.is_coach) {
            engineers = engineerService_1.default.searchEngineers(searchTerm);
        }
        else {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        res.json({ engineers });
    }
    catch (error) {
        logger_1.default.error('Search engineers error:', error);
        res.status(500).json({ error: error.message || 'Failed to search engineers' });
    }
});
// GET /api/engineers/:id - Get engineer by ID
router.get('/:id', auth_1.authenticateToken, (req, res, next) => {
    try {
        const engineerId = parseInt(req.params.id);
        if (isNaN(engineerId)) {
            res.status(400).json({ error: 'Invalid engineer ID' });
            return;
        }
        const engineer = engineerService_1.default.getEngineerById(engineerId);
        if (!engineer) {
            res.status(404).json({ error: 'Engineer not found' });
            return;
        }
        const user = req.user;
        // Check permissions
        if (!user.is_admin && !user.is_lead && !user.is_coach && !user.is_manager) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        // Additional checks for non-admin users
        if (!user.is_admin) {
            if (user.is_lead && engineer.lead_user_id !== user.id) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
            if (user.is_coach) {
                const assignments = coachAssignmentService_1.default.getActiveAssignmentsByCoach(user.id);
                const hasAccess = assignments.some(a => a.engineer_id === engineerId);
                if (!hasAccess) {
                    res.status(403).json({ error: 'Access denied' });
                    return;
                }
            }
        }
        res.json({ engineer });
    }
    catch (error) {
        logger_1.default.error('Get engineer by ID error:', error);
        res.status(500).json({ error: error.message || 'Failed to get engineer' });
    }
});
// POST /api/engineers - Create new engineer (admin , leads, managers only)
router.post('/', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const user = req.user;
        // Check permissions
        if (!user.is_admin && !user.is_lead && !user.is_manager) {
            res.status(403).json({ error: 'Admin or Lead access required' });
            return;
        }
        const { error, value } = createEngineerSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        const engineerData = value;
        // If lead_user_id is not provided and user is a lead (not admin), assign to themselves
        if (!engineerData.lead_user_id && user.is_lead && !user.is_admin) {
            engineerData.lead_user_id = user.id;
        }
        const newEngineer = engineerService_1.default.createEngineer(engineerData);
        logger_1.logUserAction.engineerCreate(user.id, newEngineer.id, engineerData.name);
        res.status(201).json({
            message: 'Engineer created successfully',
            engineer: newEngineer
        });
    }
    catch (error) {
        logger_1.default.error('Create engineer error:', error);
        res.status(400).json({ error: error.message || 'Failed to create engineer' });
    }
});
// PUT /api/engineers/:id - Update engineer (admin , leads, managers only)
router.put('/:id', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const user = req.user;
        const engineerId = parseInt(req.params.id);
        if (isNaN(engineerId)) {
            res.status(400).json({ error: 'Invalid engineer ID' });
            return;
        }
        const { error, value } = updateEngineerSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        const updateData = value;
        // Check if engineer exists and user has permission
        const existingEngineer = engineerService_1.default.getEngineerById(engineerId);
        if (!existingEngineer) {
            res.status(404).json({ error: 'Engineer not found' });
            return;
        }
        // Permission checks
        if (!user.is_admin && !user.is_lead && !user.is_manager) {
            res.status(403).json({ error: 'Admin or Lead access required' });
            return;
        }
        // Lead can only update their own engineers
        if (user.is_lead && !user.is_admin && existingEngineer.lead_user_id !== user.id) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const updatedEngineer = engineerService_1.default.updateEngineer(engineerId, updateData);
        logger_1.logUserAction.engineerUpdate(user.id, engineerId, updateData);
        res.json({
            message: 'Engineer updated successfully',
            engineer: updatedEngineer
        });
    }
    catch (error) {
        logger_1.default.error('Update engineer error:', error);
        res.status(400).json({ error: error.message || 'Failed to update engineer' });
    }
});
// Coach Assignment Routes
// GET /api/engineers/assignments - Get all coach assignments (filtered by role)
router.get('/assignments', auth_1.authenticateToken, (req, res, next) => {
    try {
        const user = req.user;
        let assignments;
        if (user.is_admin || user.is_manager) {
            assignments = coachAssignmentService_1.default.getAllAssignments();
        }
        else if (user.is_lead) {
            assignments = coachAssignmentService_1.default.getAssignmentsByLead(user.id);
        }
        else if (user.is_coach) {
            assignments = coachAssignmentService_1.default.getActiveAssignmentsByCoach(user.id);
        }
        else {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        res.json({ assignments });
    }
    catch (error) {
        logger_1.default.error('Get all assignments error:', error);
        res.status(500).json({ error: error.message || 'Failed to get assignments' });
    }
});
// GET /api/engineers/:id/assignments - Get assignments for engineer
router.get('/:id/assignments', auth_1.authenticateToken, (req, res, next) => {
    try {
        const engineerId = parseInt(req.params.id);
        if (isNaN(engineerId)) {
            res.status(400).json({ error: 'Invalid engineer ID' });
            return;
        }
        const assignments = coachAssignmentService_1.default.getAllAssignments(engineerId);
        res.json({ assignments });
    }
    catch (error) {
        logger_1.default.error('Get engineer assignments error:', error);
        res.status(500).json({ error: error.message || 'Failed to get assignments' });
    }
});
// POST /api/engineers/assignments - Create coach assignment (admin and leads only)
router.post('/assignments', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const user = req.user;
        // Check permissions
        if (!user.is_admin && !user.is_lead && !user.is_manager) {
            res.status(403).json({ error: 'Admin or Lead access required' });
            return;
        }
        const { error, value } = createAssignmentSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        const assignmentData = value;
        // Check if engineer exists and user has permission
        const engineer = engineerService_1.default.getEngineerById(assignmentData.engineer_id);
        if (!engineer) {
            res.status(404).json({ error: 'Engineer not found' });
            return;
        }
        // Lead can only assign their own engineers
        if (user.is_lead && !user.is_admin && engineer.lead_user_id !== user.id) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const newAssignment = coachAssignmentService_1.default.createAssignment(assignmentData);
        logger_1.logUserAction.assignmentCreate(user.id, assignmentData.engineer_id, assignmentData.coach_user_id);
        res.status(201).json({
            message: 'Coach assignment created successfully',
            assignment: newAssignment
        });
    }
    catch (error) {
        logger_1.default.error('Create coach assignment error:', error);
        res.status(400).json({ error: error.message || 'Failed to create assignment' });
    }
});
// PUT /api/engineers/assignments/:id/end - End coach assignment
router.put('/assignments/:id/end', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const user = req.user;
        // Check permissions
        if (!user.is_admin && !user.is_lead && !user.is_manager) {
            res.status(403).json({ error: 'Admin or Lead access required' });
            return;
        }
        const assignmentId = parseInt(req.params.id);
        if (isNaN(assignmentId)) {
            res.status(400).json({ error: 'Invalid assignment ID' });
            return;
        }
        const { end_date } = req.body;
        if (!end_date || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
            res.status(400).json({ error: 'Valid end_date (YYYY-MM-DD) is required' });
            return;
        }
        const assignment = coachAssignmentService_1.default.getAssignmentById(assignmentId);
        if (!assignment) {
            res.status(404).json({ error: 'Assignment not found' });
            return;
        }
        // Check permissions for leads
        if (user.is_lead && !user.is_admin) {
            const engineer = engineerService_1.default.getEngineerById(assignment.engineer_id);
            if (!engineer || engineer.lead_user_id !== user.id) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
        }
        const updatedAssignment = coachAssignmentService_1.default.endAssignment(assignmentId, end_date);
        logger_1.logUserAction.assignmentEnd(user.id, assignmentId, assignment.engineer_id, assignment.coach_user_id);
        res.json({
            message: 'Coach assignment ended successfully',
            assignment: updatedAssignment
        });
    }
    catch (error) {
        logger_1.default.error('End coach assignment error:', error);
        res.status(400).json({ error: error.message || 'Failed to end assignment' });
    }
});
exports.default = router;
//# sourceMappingURL=engineers.js.map