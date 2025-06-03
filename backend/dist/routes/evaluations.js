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
const multer_1 = __importDefault(require("multer"));
const evaluationService_1 = __importDefault(require("../services/evaluationService"));
const engineerService_1 = __importDefault(require("../services/engineerService"));
const excelImportService_1 = __importDefault(require("../services/excelImportService"));
const auth_1 = require("../middleware/auth");
const logger_1 = __importStar(require("../utils/logger"));
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// Configure multer for file uploads (2MB limit)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
        ];
        if (allowedMimes.includes(file.mimetype) ||
            file.originalname.match(/\.(xlsx|xlsm)$/i)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only .xlsx and .xlsm files are allowed'));
        }
    }
});
// Validation schemas
const createEvaluationSchema = joi_1.default.object({
    engineer_id: joi_1.default.number().integer().positive().required(),
    evaluation_date: joi_1.default.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
});
const updateEvaluationSchema = joi_1.default.object({
    evaluation_date: joi_1.default.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
}).min(1);
const createCaseSchema = joi_1.default.object({
    case_id: joi_1.default.string().optional(),
    kb_potential: joi_1.default.boolean().optional(),
    article_linked: joi_1.default.boolean().optional(),
    article_improved: joi_1.default.boolean().optional(),
    improvement_opportunity: joi_1.default.boolean().optional(),
    article_created: joi_1.default.boolean().optional(),
    create_opportunity: joi_1.default.boolean().optional(),
    relevant_link: joi_1.default.boolean().optional(),
    notes: joi_1.default.string().allow('').optional()
});
const updateCaseSchema = joi_1.default.object({
    case_id: joi_1.default.string().allow('').optional(),
    kb_potential: joi_1.default.boolean().optional(),
    article_linked: joi_1.default.boolean().optional(),
    article_improved: joi_1.default.boolean().optional(),
    improvement_opportunity: joi_1.default.boolean().optional(),
    article_created: joi_1.default.boolean().optional(),
    create_opportunity: joi_1.default.boolean().optional(),
    relevant_link: joi_1.default.boolean().optional(),
    notes: joi_1.default.string().allow('').optional()
}).min(1);
// Excel Import Routes
// Validation schema for import request
const importSchema = joi_1.default.object({
    year: joi_1.default.number().integer().min(2020).max(2030).required(),
    import_as_role: joi_1.default.string().valid('coach', 'admin', 'lead').optional(),
    coach_selections: joi_1.default.alternatives().try(joi_1.default.object().pattern(joi_1.default.string(), // engineer name
    joi_1.default.number().integer().min(-2) // allow -2 (reassign), -1 (skip), and positive coach IDs
    ), joi_1.default.string() // JSON string from FormData
    ).optional()
});
// POST /api/evaluations/import - Import evaluations from Excel file
router.post('/import', auth_1.authenticateToken, upload.single('excel_file'), async (req, res, next) => {
    try {
        const user = req.user;
        // Check permissions - allow admins, coaches, leads, managers
        if (!user.is_admin && !user.is_coach && !user.is_lead && !user.is_manager) {
            res.status(403).json({ error: 'Access denied - insufficient permissions to import evaluations' });
            return;
        }
        // Check if file was uploaded
        if (!req.file) {
            res.status(400).json({ error: 'No Excel file uploaded' });
            return;
        }
        // Validate request body
        const { error, value } = importSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        let { year, import_as_role, coach_selections } = value;
        // Parse coach_selections if it's a JSON string (comes from FormData)
        if (coach_selections && typeof coach_selections === 'string') {
            try {
                coach_selections = JSON.parse(coach_selections);
            }
            catch (parseError) {
                res.status(400).json({ error: 'Invalid coach_selections format' });
                return;
            }
        }
        // Determine import role (coach, lead, admin)
        let importRole = 'coach';
        if (user.is_admin || user.is_manager) {
            importRole = import_as_role || 'admin';
        }
        else if (user.is_lead) {
            importRole = 'lead';
        }
        try {
            // Step 1: Parse Excel file and get preview
            const preview = await excelImportService_1.default.parseExcelFile(req.file.buffer, req.file.originalname, user, importRole);
            // If this is just a preview request (no coach_selections), return preview
            if (!coach_selections) {
                res.json({
                    success: true,
                    preview: preview,
                    message: 'File parsed successfully. Review the data and submit with coach selections to complete import.'
                });
                return;
            }
            // Step 2: Import data with coach selections
            const importResult = await excelImportService_1.default.importData(preview, year, coach_selections || {}, user, importRole);
            // Log the import action
            logger_1.logUserAction.evaluationCreate(user.id, 0, // No specific engineer
            0, // No specific evaluation
            `Excel import: ${importResult.imported_evaluations} evaluations, ${importResult.imported_cases} cases`);
            res.json({
                success: importResult.success,
                result: importResult,
                message: importResult.success
                    ? `Import completed successfully. Imported ${importResult.imported_evaluations} evaluations with ${importResult.imported_cases} cases.`
                    : 'Import completed with errors. Check the error details.'
            });
        }
        catch (parseError) {
            logger_1.default.error('Excel import error:', parseError);
            res.status(400).json({
                error: 'Failed to process Excel file',
                details: parseError.message
            });
            return;
        }
    }
    catch (error) {
        logger_1.default.error('Import endpoint error:', error);
        res.status(500).json({ error: error.message || 'Import failed' });
    }
});
// GET /api/evaluations - Get evaluations (filtered by role)
router.get('/', auth_1.authenticateToken, (req, res, next) => {
    try {
        const user = req.user;
        const { engineer_id, engineer_ids, coach_user_id, coach_user_ids, lead_user_id, lead_user_ids, start_date, end_date, year, years, month, months } = req.query;
        let evaluations;
        const filters = {};
        // Add query filters
        if (engineer_ids) {
            const rawVals = Array.isArray(engineer_ids) ? engineer_ids : [engineer_ids];
            const ids = rawVals
                .map(val => String(val))
                .flatMap(str => str.replace(/[()]/g, '').split(','))
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n));
            if (ids.length)
                filters.engineerIds = ids;
        }
        else if (typeof engineer_id === 'string') {
            const idNum = parseInt(engineer_id, 10);
            if (!isNaN(idNum))
                filters.engineerId = idNum;
        }
        if (coach_user_ids) {
            const rawVals = Array.isArray(coach_user_ids) ? coach_user_ids : [coach_user_ids];
            const ids = rawVals
                .map(val => String(val))
                .flatMap(str => str.replace(/[()]/g, '').split(','))
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n));
            if (ids.length)
                filters.coachUserIds = ids;
        }
        else if (typeof coach_user_id === 'string') {
            const idNum = parseInt(coach_user_id, 10);
            if (!isNaN(idNum))
                filters.coachUserId = idNum;
        }
        if (lead_user_ids) {
            const rawVals = Array.isArray(lead_user_ids) ? lead_user_ids : [lead_user_ids];
            const ids = rawVals
                .map(val => String(val))
                .flatMap(str => str.replace(/[()]/g, '').split(','))
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n));
            if (ids.length)
                filters.leadUserIds = ids;
        }
        else if (typeof lead_user_id === 'string') {
            const idNum = parseInt(lead_user_id, 10);
            if (!isNaN(idNum))
                filters.leadUserId = idNum;
        }
        if (start_date)
            filters.startDate = start_date;
        if (end_date)
            filters.endDate = end_date;
        // parse single or multi-year
        if (years) {
            const rawVals = Array.isArray(years) ? years : [years];
            const ys = rawVals
                .map(val => String(val))
                .flatMap(str => str.replace(/[()]/g, '').split(','))
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n));
            if (ys.length)
                filters.years = ys;
        }
        else if (typeof year === 'string') {
            const yNum = parseInt(year, 10);
            if (!isNaN(yNum))
                filters.year = yNum;
        }
        // parse single or multi-month
        if (months) {
            const rawVals = Array.isArray(months) ? months : [months];
            const ms = rawVals
                .map(val => String(val))
                .flatMap(str => str.replace(/[()]/g, '').split(','))
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n));
            if (ms.length)
                filters.months = ms;
        }
        else if (typeof month === 'string') {
            const mNum = parseInt(month, 10);
            if (!isNaN(mNum))
                filters.month = mNum;
        }
        if (user.is_admin || user.is_coach || user.is_lead || user.is_manager) {
            // All authenticated users can see all evaluations with optional filtering
            evaluations = evaluationService_1.default.getAllEvaluations(filters);
        }
        else {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        res.json({ evaluations });
    }
    catch (error) {
        logger_1.default.error('Get evaluations error:', error);
        res.status(500).json({ error: error.message || 'Failed to get evaluations' });
    }
});
// GET /api/evaluations/:id - Get evaluation by ID with cases
router.get('/:id', auth_1.authenticateToken, (req, res, next) => {
    try {
        const evaluationId = parseInt(req.params.id);
        if (isNaN(evaluationId)) {
            res.status(400).json({ error: 'Invalid evaluation ID' });
            return;
        }
        const evaluation = evaluationService_1.default.getEvaluationById(evaluationId);
        if (!evaluation) {
            res.status(404).json({ error: 'Evaluation not found' });
            return;
        }
        const user = req.user;
        // Check permissions
        if (!user.is_admin && !user.is_lead && !user.is_coach && !user.is_manager) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        // Additional permission checks - allow all authenticated users to view evaluations
        // Admins, coaches, and leads can all view evaluation details
        // No additional restrictions needed since we already checked basic permissions above
        res.json({ evaluation });
    }
    catch (error) {
        logger_1.default.error('Get evaluation by ID error:', error);
        res.status(500).json({ error: error.message || 'Failed to get evaluation' });
    }
});
// POST /api/evaluations - Create new evaluation
router.post('/', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const user = req.user;
        // Check permissions
        if (!user.is_admin && !user.is_coach) {
            res.status(403).json({ error: 'Coach access required' });
            return;
        }
        const { error, value } = createEvaluationSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        const evaluationData = value;
        // Check if engineer exists and user has permission
        const engineer = engineerService_1.default.getEngineerById(evaluationData.engineer_id);
        if (!engineer) {
            res.status(404).json({ error: 'Engineer not found' });
            return;
        }
        // Coach can only create evaluations for assigned engineers
        if (user.is_coach && !user.is_admin) {
            const assignedEngineers = engineerService_1.default.getEngineersByCoach(user.id);
            const hasAccess = assignedEngineers.some(e => e.id === evaluationData.engineer_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied - engineer not assigned to you' });
                return;
            }
        }
        const newEvaluation = evaluationService_1.default.createEvaluation(evaluationData, user.id);
        logger_1.logUserAction.evaluationCreate(user.id, evaluationData.engineer_id, newEvaluation.id, evaluationData.evaluation_date);
        res.status(201).json({
            message: 'Evaluation created successfully',
            evaluation: newEvaluation
        });
    }
    catch (error) {
        logger_1.default.error('Create evaluation error:', error);
        res.status(400).json({ error: error.message || 'Failed to create evaluation' });
    }
});
// PUT /api/evaluations/:id - Update evaluation
router.put('/:id', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const user = req.user;
        const evaluationId = parseInt(req.params.id);
        if (isNaN(evaluationId)) {
            res.status(400).json({ error: 'Invalid evaluation ID' });
            return;
        }
        const { error, value } = updateEvaluationSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        const updateData = value;
        // Check if evaluation exists and user has permission
        const existingEvaluation = evaluationService_1.default.getEvaluationById(evaluationId);
        if (!existingEvaluation) {
            res.status(404).json({ error: 'Evaluation not found' });
            return;
        }
        // Permission checks - allow admins and coaches to edit evaluations
        if (!user.is_admin && !user.is_coach) {
            res.status(403).json({ error: 'Access denied - admin or coach access required' });
            return;
        }
        const updatedEvaluation = evaluationService_1.default.updateEvaluation(evaluationId, updateData, user.id);
        logger_1.logUserAction.evaluationUpdate(user.id, evaluationId, updateData);
        res.json({
            message: 'Evaluation updated successfully',
            evaluation: updatedEvaluation
        });
    }
    catch (error) {
        logger_1.default.error('Update evaluation error:', error);
        res.status(400).json({ error: error.message || 'Failed to update evaluation' });
    }
});
// Case Evaluation Routes
// POST /api/evaluations/:id/cases - Add new case to evaluation
router.post('/:id/cases', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const user = req.user;
        const evaluationId = parseInt(req.params.id);
        if (isNaN(evaluationId)) {
            res.status(400).json({ error: 'Invalid evaluation ID' });
            return;
        }
        const { error, value } = createCaseSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        const caseData = value;
        // Check if evaluation exists and user has permission
        const evaluation = evaluationService_1.default.getEvaluationById(evaluationId);
        if (!evaluation) {
            res.status(404).json({ error: 'Evaluation not found' });
            return;
        }
        // Permission checks - allow admins and coaches to add cases
        if (!user.is_admin && !user.is_coach) {
            res.status(403).json({ error: 'Access denied - admin or coach access required' });
            return;
        }
        const newCase = evaluationService_1.default.addCase(evaluationId, caseData);
        res.status(201).json({
            message: 'Case added successfully',
            case: newCase
        });
    }
    catch (error) {
        logger_1.default.error('Add case error:', error);
        res.status(400).json({ error: error.message || 'Failed to add case' });
    }
});
// PUT /api/evaluations/cases/:caseId - Update case evaluation
router.put('/cases/:caseId', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const user = req.user;
        const caseId = parseInt(req.params.caseId);
        if (isNaN(caseId)) {
            res.status(400).json({ error: 'Invalid case ID' });
            return;
        }
        const { error, value } = updateCaseSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        const updateData = value;
        // Check if case exists and get evaluation for permission check
        const existingCase = evaluationService_1.default.getCaseById(caseId);
        if (!existingCase) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        const evaluation = evaluationService_1.default.getEvaluationById(existingCase.evaluation_id);
        if (!evaluation) {
            res.status(404).json({ error: 'Evaluation not found' });
            return;
        }
        // Permission checks - allow admins and coaches to update cases
        if (!user.is_admin && !user.is_coach) {
            res.status(403).json({ error: 'Access denied - admin or coach access required' });
            return;
        }
        const updatedCase = evaluationService_1.default.updateCase(caseId, updateData);
        res.json({
            message: 'Case updated successfully',
            case: updatedCase
        });
    }
    catch (error) {
        logger_1.default.error('Update case error:', error);
        res.status(400).json({ error: error.message || 'Failed to update case' });
    }
});
// DELETE /api/evaluations/cases/:caseId - Soft delete case evaluation
router.delete('/cases/:caseId', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const user = req.user;
        const caseId = parseInt(req.params.caseId);
        if (isNaN(caseId)) {
            res.status(400).json({ error: 'Invalid case ID' });
            return;
        }
        // Check if case exists and get evaluation for permission check
        const existingCase = evaluationService_1.default.getCaseById(caseId);
        if (!existingCase) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        const evaluation = evaluationService_1.default.getEvaluationById(existingCase.evaluation_id);
        if (!evaluation) {
            res.status(404).json({ error: 'Evaluation not found' });
            return;
        }
        // Permission checks - allow admins and coaches to delete cases
        if (!user.is_admin && !user.is_coach) {
            res.status(403).json({ error: 'Access denied - admin or coach access required' });
            return;
        }
        evaluationService_1.default.deleteCase(caseId);
        res.json({
            message: 'Case deleted successfully'
        });
    }
    catch (error) {
        logger_1.default.error('Delete case error:', error);
        res.status(400).json({ error: error.message || 'Failed to delete case' });
    }
});
// GET /api/evaluations/cases/check/:caseId - Check if case ID exists
router.get('/cases/check/:caseId', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const user = req.user;
        // Check permissions - allow admins, coaches, and managers to check case IDs
        if (!user.is_admin && !user.is_coach && !user.is_manager) {
            res.status(403).json({ error: 'Access denied - admin or coach access required' });
            return;
        }
        const caseId = req.params.caseId;
        if (!caseId || caseId.trim() === '') {
            res.status(400).json({ error: 'Case ID is required' });
            return;
        }
        const result = evaluationService_1.default.checkCaseIdExists(caseId);
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Check case ID error:', error);
        res.status(500).json({ error: error.message || 'Failed to check case ID' });
    }
});
// DELETE /api/evaluations/:id - Soft delete evaluation
router.delete('/:id', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const user = req.user;
        const evaluationId = parseInt(req.params.id);
        if (isNaN(evaluationId)) {
            res.status(400).json({ error: 'Invalid evaluation ID' });
            return;
        }
        // Check if evaluation exists
        const existingEvaluation = evaluationService_1.default.getEvaluationById(evaluationId);
        if (!existingEvaluation) {
            res.status(404).json({ error: 'Evaluation not found' });
            return;
        }
        // Permission checks - allow admins and coaches to delete evaluations
        if (!user.is_admin && !user.is_coach) {
            res.status(403).json({ error: 'Access denied - admin or coach access required' });
            return;
        }
        // For coaches, only allow deleting their own evaluations
        if (user.is_coach && !user.is_admin && existingEvaluation.coach_user_id !== user.id) {
            res.status(403).json({ error: 'Access denied - coaches can only delete their own evaluations' });
            return;
        }
        evaluationService_1.default.deleteEvaluation(evaluationId, user.id);
        // Log the deletion action
        const logMessage = `Evaluation deleted: ${existingEvaluation.engineer_name} - ${existingEvaluation.evaluation_date}`;
        logger_1.logUserAction.evaluationUpdate(user.id, evaluationId, { deleted: true, reason: logMessage });
        res.json({
            message: 'Evaluation deleted successfully'
        });
    }
    catch (error) {
        logger_1.default.error('Delete evaluation error:', error);
        res.status(400).json({ error: error.message || 'Failed to delete evaluation' });
    }
});
exports.default = router;
//# sourceMappingURL=evaluations.js.map