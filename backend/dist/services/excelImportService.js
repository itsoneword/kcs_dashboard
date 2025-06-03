"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore - xlsx-populate doesn't have official types
const xlsx_populate_1 = __importDefault(require("xlsx-populate"));
const engineerService_1 = __importDefault(require("./engineerService"));
const evaluationService_1 = __importDefault(require("./evaluationService"));
const coachAssignmentService_1 = __importDefault(require("./coachAssignmentService"));
const authService_1 = __importDefault(require("./authService"));
const logger_1 = __importDefault(require("../utils/logger"));
class ExcelImportService {
    /**
     * Parse Excel file and return preview data
     */
    async parseExcelFile(fileBuffer, fileName, importingUser, importRole = 'coach') {
        try {
            logger_1.default.info(`Parsing Excel file: ${fileName} by user ${importingUser.id} (role: ${importRole})`);
            // Load workbook from buffer
            const workbook = await xlsx_populate_1.default.fromDataAsync(fileBuffer);
            const preview = {
                engineers: [],
                conflicts: [],
                metadata: {
                    coach_name: null,
                    total_cases: 0,
                    quarters_found: [],
                    file_name: fileName
                },
                errors: [],
                missing_coaches: [],
                coach_ownership_warning: null
            };
            // Process sheets
            const allSheets = workbook.sheets();
            const validSheets = allSheets.filter((sheet, index) => {
                if (index === 0)
                    return false; // Skip summary
                if (/Engineer\s+\d+/i.test(sheet.name()))
                    return false; // Skip empty
                return true;
            });
            logger_1.default.info(`Processing ${validSheets.length} engineer sheets`);
            // Parse each sheet
            for (const sheet of validSheets) {
                try {
                    const parsedEngineer = this.parseEngineerSheet(sheet);
                    if (parsedEngineer.evaluations.length > 0) {
                        preview.engineers.push(parsedEngineer);
                        // Set global coach if not set
                        if (!preview.metadata.coach_name && parsedEngineer.coach_name) {
                            preview.metadata.coach_name = parsedEngineer.coach_name;
                        }
                    }
                }
                catch (error) {
                    preview.errors.push(`Sheet ${sheet.name()}: ${error.message}`);
                }
            }
            // Calculate totals
            preview.metadata.total_cases = preview.engineers.reduce((sum, eng) => sum + eng.evaluations.reduce((sum2, evaluation) => sum2 + evaluation.cases.length, 0), 0);
            // Get unique quarters
            const quartersSet = new Set();
            preview.engineers.forEach(eng => eng.evaluations.forEach(evaluation => quartersSet.add(evaluation.quarter)));
            preview.metadata.quarters_found = Array.from(quartersSet).sort();
            // Check for conflicts
            await this.detectConflicts(preview, importingUser, importRole);
            return preview;
        }
        catch (error) {
            logger_1.default.error('Excel parsing error:', error);
            throw new Error(`Failed to parse Excel file: ${error.message}`);
        }
    }
    /**
     * Parse individual engineer sheet
     */
    parseEngineerSheet(sheet) {
        const data = this.convertSheetToArray(sheet);
        if (data.length === 0) {
            throw new Error('Empty sheet');
        }
        // Extract metadata
        const metadata = this.extractMetadata(data);
        const paramHeaders = this.extractParameterHeaders(data);
        const quarters = this.findQuarters(data);
        const engineer = {
            name: metadata.engineer_name || sheet.name(),
            coach_name: metadata.coach_name,
            evaluations: []
        };
        // Parse cases for each quarter
        quarters.forEach(quarter => {
            const cases = this.parseCasesInQuarter(data, quarter, paramHeaders);
            if (cases.length > 0) {
                engineer.evaluations.push({
                    quarter: quarter.name,
                    cases: cases
                });
            }
        });
        return engineer;
    }
    /**
     * Convert sheet to 2D array
     */
    convertSheetToArray(sheet) {
        const data = [];
        const usedRange = sheet.usedRange();
        if (!usedRange)
            return data;
        const startRow = usedRange.startCell().rowNumber();
        const endRow = usedRange.endCell().rowNumber();
        const endCol = Math.max(usedRange.endCell().columnNumber(), 15);
        for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
            const row = [];
            for (let colNum = 1; colNum <= endCol; colNum++) {
                try {
                    const cell = sheet.cell(rowNum, colNum);
                    let value = cell.value();
                    if (value && typeof value === 'object') {
                        if (value.text) {
                            value = value.text;
                        }
                        else if (Array.isArray(value)) {
                            value = value.map((item) => item.text || item).join('');
                        }
                    }
                    row[colNum - 1] = value;
                }
                catch {
                    row[colNum - 1] = null;
                }
            }
            data[rowNum - 1] = row;
        }
        return data;
    }
    /**
     * Extract metadata (coach, engineer names)
     */
    extractMetadata(data) {
        const metadata = {
            coach_name: null,
            engineer_name: null
        };
        if (data.length > 0) {
            const firstRow = data[0] || [];
            // Check columns G, H, I (indices 6, 7, 8) for coach name
            for (const colIndex of [6, 7, 8]) {
                if (firstRow[colIndex] && String(firstRow[colIndex]).trim().match(/\w+\s+\w+/)) {
                    metadata.coach_name = String(firstRow[colIndex]).trim();
                    break;
                }
            }
            // Check columns C, D, E (indices 2, 3, 4) for engineer name
            for (const colIndex of [2, 3, 4]) {
                if (firstRow[colIndex] && String(firstRow[colIndex]).trim().match(/\w+\s+\w+/)) {
                    metadata.engineer_name = String(firstRow[colIndex]).trim();
                    break;
                }
            }
        }
        return metadata;
    }
    /**
     * Extract parameter headers from C2-I2
     */
    extractParameterHeaders(data) {
        const headers = [];
        if (data.length > 1) {
            const headerRow = data[1] || [];
            for (let col = 2; col <= 8; col++) {
                if (headerRow[col]) {
                    headers.push({
                        name: String(headerRow[col]).trim(),
                        column: col
                    });
                }
            }
        }
        return headers;
    }
    /**
     * Find quarter boundaries
     */
    findQuarters(data) {
        const quarters = [];
        const quarterPattern = /Q[1-4]/i;
        const quarterPositions = [];
        data.forEach((row, index) => {
            if (row[0] && quarterPattern.test(String(row[0]))) {
                quarterPositions.push({
                    name: String(row[0]).trim().toUpperCase(),
                    row: index
                });
            }
        });
        quarterPositions.forEach((quarter, index) => {
            const nextQuarter = quarterPositions[index + 1];
            quarters.push({
                name: quarter.name,
                startRow: quarter.row,
                endRow: nextQuarter ? nextQuarter.row - 1 : data.length - 1
            });
        });
        return quarters;
    }
    /**
     * Parse cases within quarter
     */
    parseCasesInQuarter(data, quarter, paramHeaders) {
        const cases = [];
        for (let rowIndex = quarter.startRow; rowIndex <= quarter.endRow; rowIndex++) {
            const row = data[rowIndex] || [];
            const caseNumber = row[1]; // Column B
            if (caseNumber && !isNaN(Number(caseNumber))) {
                const caseData = {
                    case_number: Number(caseNumber),
                    quarter: quarter.name,
                    month: row[9] ? String(row[9]).trim() : null, // Column J
                    notes: row[10] ? String(row[10]).trim() : null, // Column K
                    parameters: {}
                };
                paramHeaders.forEach(param => {
                    const value = row[param.column];
                    caseData.parameters[param.name] = this.parseBooleanValue(value);
                });
                cases.push(caseData);
            }
        }
        return cases;
    }
    /**
     * Parse boolean values
     */
    parseBooleanValue(value) {
        if (value === null || value === undefined || value === '')
            return null;
        const str = String(value).toLowerCase().trim();
        if (str === 'true' || str === '1' || str === 'yes' || str === 'y')
            return true;
        if (str === 'false' || str === '0' || str === 'no' || str === 'n')
            return false;
        if (typeof value === 'boolean')
            return value;
        return null;
    }
    /**
     * Detect conflicts with existing data
     */
    async detectConflicts(preview, importingUser, importRole = 'coach') {
        try {
            const allEngineers = engineerService_1.default.getAllEngineers();
            const allUsers = authService_1.default.getAllUsers();
            logger_1.default.info(`Import conflict detection: User ${importingUser.name} (Role: ${importRole}), Excel coach: "${preview.metadata.coach_name}"`);
            // Step 1: Check for coach ownership warnings (only for coach role, not admin)
            if (importRole === 'coach' && preview.metadata.coach_name) {
                const importingUserNameLower = importingUser.name.toLowerCase().trim();
                const excelCoachNameLower = preview.metadata.coach_name.toLowerCase().trim();
                if (importingUserNameLower !== excelCoachNameLower) {
                    logger_1.default.warn(`🚫 COACH OWNERSHIP CONFLICT: ${importingUser.name} trying to import file for ${preview.metadata.coach_name} - IMPORT BLOCKED`);
                    preview.coach_ownership_warning = {
                        detected_coach: preview.metadata.coach_name,
                        importing_user: importingUser.name,
                        should_block_import: true
                    };
                    return; // Early return - don't process further if ownership conflict
                }
                else {
                    logger_1.default.info(`✅ Coach ownership verified: ${importingUser.name} matches Excel coach`);
                }
            }
            // Step 1b: For leads, filter out engineers not under their lead
            if (importRole === 'lead') {
                const unauthorized = preview.engineers.filter(pe => {
                    const existing = allEngineers.find(e => e.name.toLowerCase() === pe.name.toLowerCase());
                    return existing && existing.lead_user_id !== importingUser.id;
                });
                if (unauthorized.length) {
                    const names = unauthorized.map(pe => pe.name);
                    preview.errors.push(`Skipping engineers not under your lead: ${names.join(', ')}`);
                    preview.engineers = preview.engineers.filter(pe => {
                        const existing = allEngineers.find(e => e.name.toLowerCase() === pe.name.toLowerCase());
                        return !existing || existing.lead_user_id === importingUser.id;
                    });
                }
            }
            // Step 2: Process each engineer for conflicts and missing coaches
            for (const parsedEngineer of preview.engineers) {
                // Find existing engineer by name
                const existingEngineer = allEngineers.find(e => e.name.toLowerCase() === parsedEngineer.name.toLowerCase());
                if (parsedEngineer.coach_name) {
                    // Find Excel coach by name
                    const excelCoach = allUsers.find(u => u.is_coach && u.name.toLowerCase() === parsedEngineer.coach_name.toLowerCase());
                    if (!excelCoach) {
                        // Coach from Excel not found in database
                        preview.missing_coaches.push({
                            engineer_name: parsedEngineer.name,
                            excel_coach_name: parsedEngineer.coach_name,
                            suggested_action: importRole !== 'coach' ? 'manual_select' : 'assign_to_importer'
                        });
                        logger_1.default.info(`Missing coach: ${parsedEngineer.coach_name} for ${parsedEngineer.name} -> ${importRole !== 'coach' ? 'manual_select' : 'assign_to_importer'}`);
                    }
                    else if (existingEngineer) {
                        // Coach exists - check for reassignment conflicts
                        const activeAssignments = coachAssignmentService_1.default.getAllAssignments(existingEngineer.id, undefined, true);
                        const currentAssignment = activeAssignments[0]; // Most recent active assignment
                        if (currentAssignment && currentAssignment.coach_user_id !== excelCoach.id) {
                            const currentCoach = allUsers.find(u => u.id === currentAssignment.coach_user_id);
                            const conflict = {
                                engineer_name: parsedEngineer.name,
                                current_coach: currentCoach?.name || 'Unknown',
                                excel_coach: parsedEngineer.coach_name,
                                action: importRole !== 'coach' ? 'manual' : 'skip'
                            };
                            preview.conflicts.push(conflict);
                            logger_1.default.info(`Conflict: ${parsedEngineer.name} - Current: ${conflict.current_coach}, Excel: ${conflict.excel_coach}, Action: ${conflict.action}`);
                        }
                    }
                }
                else {
                    // No coach name in Excel
                    if (importRole !== 'coach') {
                        // Admin or Lead with no coach name - manual selection required
                        preview.missing_coaches.push({
                            engineer_name: parsedEngineer.name,
                            excel_coach_name: null,
                            suggested_action: 'manual_select'
                        });
                    }
                    else {
                        // Regular user with no coach name - will assign to importing user
                        preview.missing_coaches.push({
                            engineer_name: parsedEngineer.name,
                            excel_coach_name: null,
                            suggested_action: 'assign_to_importer'
                        });
                    }
                }
            }
            logger_1.default.info(`Conflict detection complete: ${preview.coach_ownership_warning ? 'BLOCKED' : 'Allowed'}, Missing coaches: ${preview.missing_coaches.length}, Conflicts: ${preview.conflicts.length}`);
        }
        catch (error) {
            logger_1.default.error('Conflict detection error:', error);
            preview.errors.push(`Conflict detection failed: ${error.message}`);
        }
    }
    /**
     * Import data after preview confirmation
     */
    async importData(preview, selectedYear, coachSelections, // engineer_name -> coach_user_id
    importingUser, importRole = 'coach') {
        const result = {
            success: false,
            imported_engineers: 0,
            imported_evaluations: 0,
            imported_cases: 0,
            skipped_engineers: [],
            errors: []
        };
        try {
            logger_1.default.info(`Starting import for user ${importingUser.id}, year ${selectedYear}, role ${importRole}`);
            for (const parsedEngineer of preview.engineers) {
                try {
                    // Check if this engineer should be skipped due to conflicts
                    const conflict = preview.conflicts.find(c => c.engineer_name === parsedEngineer.name);
                    if (conflict && conflict.action === 'skip') {
                        result.skipped_engineers.push(parsedEngineer.name);
                        continue;
                    }
                    // Process engineer
                    await this.processEngineerImport(parsedEngineer, selectedYear, coachSelections, importingUser, importRole, result);
                }
                catch (error) {
                    result.errors.push(`Engineer ${parsedEngineer.name}: ${error.message}`);
                }
            }
            result.success = result.errors.length === 0;
            return result;
        }
        catch (error) {
            logger_1.default.error('Import error:', error);
            result.errors.push(`Import failed: ${error.message}`);
            return result;
        }
    }
    /**
     * Process individual engineer import
     */
    async processEngineerImport(parsedEngineer, selectedYear, coachSelections, importingUser, importRole = 'coach', result) {
        logger_1.default.info(`Processing engineer: ${parsedEngineer.name}`);
        try {
            // 1. Find or create engineer
            let engineer = null;
            const allEngineers = engineerService_1.default.getAllEngineers();
            engineer = allEngineers.find(e => e.name.toLowerCase() === parsedEngineer.name.toLowerCase()) || null;
            if (!engineer) {
                // Create new engineer
                // Only assign lead if importing as lead role and user is lead
                const leadUserId = (importRole === 'lead' && importingUser.is_lead) ? importingUser.id : undefined;
                engineer = engineerService_1.default.createEngineer({
                    name: parsedEngineer.name,
                    lead_user_id: leadUserId
                });
                result.imported_engineers++;
                logger_1.default.info(`Created new engineer: ${engineer.name} (ID: ${engineer.id}, Lead: ${leadUserId || 'none'})`);
            }
            else {
                logger_1.default.info(`Found existing engineer: ${engineer.name} (ID: ${engineer.id})`);
            }
            // 2. Handle coach assignment if needed
            await this.processCoachAssignment(parsedEngineer, engineer, coachSelections, importingUser, importRole);
            // 3. Process evaluations and cases
            for (const evaluation of parsedEngineer.evaluations) {
                await this.processEvaluationImport(engineer, evaluation, selectedYear, importingUser, result);
            }
        }
        catch (error) {
            logger_1.default.error(`Error processing engineer ${parsedEngineer.name}:`, error);
            throw error;
        }
    }
    /**
     * Process coach assignment for engineer
     */
    async processCoachAssignment(parsedEngineer, engineer, coachSelections, importingUser, importRole = 'coach') {
        // Check if there's a coach selection for this engineer
        const coachSelection = coachSelections[parsedEngineer.name];
        if (coachSelection === -1) {
            // Skip - keep current coach
            logger_1.default.info(`Skipping coach assignment for ${parsedEngineer.name}`);
            return;
        }
        let targetCoachId = null;
        if (coachSelection && coachSelection > 0) {
            // Specific coach selected (admin selection or conflict resolution)
            targetCoachId = coachSelection;
            logger_1.default.info(`Admin/manual selection: Assigning ${parsedEngineer.name} to coach ID ${targetCoachId}`);
        }
        else if (coachSelection === -2 && parsedEngineer.coach_name) {
            // Reassign to Excel coach - find coach by name
            const allUsers = authService_1.default.getAllUsers();
            const excelCoach = allUsers.find(u => u.is_coach && u.name.toLowerCase() === parsedEngineer.coach_name.toLowerCase());
            if (excelCoach) {
                targetCoachId = excelCoach.id;
                logger_1.default.info(`Reassigning ${parsedEngineer.name} to Excel coach: ${excelCoach.name}`);
            }
            else {
                logger_1.default.warn(`Excel coach not found: ${parsedEngineer.coach_name}`);
                // Fallback for missing Excel coach (only for coach imports)
                if (importRole === 'coach') {
                    targetCoachId = this.getFallbackCoach(importingUser);
                }
            }
        }
        else if (parsedEngineer.coach_name && !coachAssignmentService_1.default.hasActiveCoach(engineer.id)) {
            // Auto-assign if no active coach and Excel has coach name
            const allUsers = authService_1.default.getAllUsers();
            const excelCoach = allUsers.find(u => u.is_coach && u.name.toLowerCase() === parsedEngineer.coach_name.toLowerCase());
            if (excelCoach) {
                targetCoachId = excelCoach.id;
                logger_1.default.info(`Auto-assigning ${parsedEngineer.name} to Excel coach: ${excelCoach.name}`);
            }
            else {
                // Fallback: Excel coach not found in DB (only for coach imports, not admin)
                if (importRole === 'coach') {
                    targetCoachId = this.getFallbackCoach(importingUser);
                    logger_1.default.info(`Fallback assignment: Coach ${parsedEngineer.coach_name} not found in DB, using fallback for ${parsedEngineer.name}`);
                }
                else {
                    logger_1.default.info(`Admin import: No coach assignment for ${parsedEngineer.name} - coach not found and no manual selection`);
                }
            }
        }
        else if (!parsedEngineer.coach_name && !coachAssignmentService_1.default.hasActiveCoach(engineer.id)) {
            // No coach in Excel - assign based on importing role (only for coach imports)
            if (importRole === 'coach') {
                targetCoachId = this.getFallbackCoach(importingUser);
                logger_1.default.info(`Auto-assignment: No coach in Excel, using fallback for ${parsedEngineer.name}`);
            }
            else {
                logger_1.default.info(`Admin import: No coach assignment for ${parsedEngineer.name} - no coach in Excel and no manual selection`);
            }
        }
        // Create coach assignment if we have a target coach
        if (targetCoachId && !coachAssignmentService_1.default.hasActiveCoach(engineer.id)) {
            try {
                coachAssignmentService_1.default.createAssignment({
                    engineer_id: engineer.id,
                    coach_user_id: targetCoachId,
                    start_date: new Date().toISOString().split('T')[0] // Today's date
                });
                logger_1.default.info(`Created coach assignment: Engineer ${engineer.name} -> Coach ID ${targetCoachId}`);
            }
            catch (error) {
                logger_1.default.warn(`Failed to create coach assignment for ${engineer.name}: ${error.message}`);
            }
        }
        else if (!targetCoachId) {
            logger_1.default.info(`No coach assignment created for ${engineer.name} - no target coach determined`);
        }
        else {
            logger_1.default.info(`Skipping coach assignment for ${engineer.name} - already has active coach`);
        }
    }
    /**
     * Get fallback coach for assignment
     */
    getFallbackCoach(importingUser) {
        if (importingUser.is_coach) {
            // Importing user is a coach - assign to them
            return importingUser.id;
        }
        else if (importingUser.is_admin || importingUser.is_lead) {
            // Admin or Lead but not coach - find any available coach
            // This should not happen with proper UI flow, but as a safety net
            const allUsers = authService_1.default.getAllUsers();
            const availableCoach = allUsers.find(u => u.is_coach);
            if (availableCoach) {
                logger_1.default.warn(`Assigning to first available coach ${availableCoach.name} for non-coach import by ${importingUser.name}`);
                return availableCoach.id;
            }
        }
        return null;
    }
    /**
     * Process evaluation import for engineer
     */
    async processEvaluationImport(engineer, evaluationData, selectedYear, importingUser, result) {
        // Safety check: ensure engineer has active coach before creating evaluations
        if (!coachAssignmentService_1.default.hasActiveCoach(engineer.id)) {
            logger_1.default.warn(`Skipping evaluation import for ${engineer.name}: No active coach assignment`);
            result.errors.push(`${engineer.name}: No active coach assignment - please assign a coach`);
            return;
        }
        // Group cases by month to create separate evaluations
        const casesByMonth = new Map();
        evaluationData.cases.forEach(case_ => {
            const month = case_.month || 'Unknown';
            if (!casesByMonth.has(month)) {
                casesByMonth.set(month, []);
            }
            casesByMonth.get(month).push(case_);
        });
        // Create evaluation for each month that has cases
        for (const [month, cases] of casesByMonth) {
            try {
                // Calculate evaluation date (first day of month)
                let evaluationDate;
                if (month === 'Unknown') {
                    // Default to first day of year
                    evaluationDate = `${selectedYear}-01-01`;
                }
                else {
                    const monthMap = {
                        'jan': 1, 'january': 1,
                        'feb': 2, 'february': 2,
                        'mar': 3, 'march': 3,
                        'apr': 4, 'april': 4,
                        'may': 5,
                        'jun': 6, 'june': 6,
                        'jul': 7, 'july': 7,
                        'aug': 8, 'august': 8,
                        'sep': 9, 'september': 9,
                        'oct': 10, 'october': 10,
                        'nov': 11, 'november': 11,
                        'dec': 12, 'december': 12
                    };
                    const monthNum = monthMap[month.toLowerCase()] || 1;
                    evaluationDate = `${selectedYear}-${monthNum.toString().padStart(2, '0')}-01`;
                }
                // Create evaluation
                const evaluation = evaluationService_1.default.createEvaluation({
                    engineer_id: engineer.id,
                    evaluation_date: evaluationDate
                }, importingUser.id);
                result.imported_evaluations++;
                logger_1.default.info(`Created evaluation for ${engineer.name}, month ${month} (ID: ${evaluation.id})`);
                // Get empty cases that can be populated from this evaluation
                const emptyCases = evaluationService_1.default.getEmptyCases(evaluation.id);
                let emptyCaseIndex = 0;
                // Add cases to evaluation
                for (const case_ of cases) {
                    try {
                        const caseData = {
                            case_id: case_.case_number.toString(),
                            notes: case_.notes || undefined
                        };
                        // Map parameters to case fields
                        Object.entries(case_.parameters).forEach(([paramName, value]) => {
                            const normalizedParam = paramName.toLowerCase().replace(/[^a-z]/g, '');
                            if (normalizedParam.includes('kbpotential') || normalizedParam.includes('potential')) {
                                caseData.kb_potential = value || undefined;
                            }
                            else if (normalizedParam.includes('articlelinked') || normalizedParam.includes('linked')) {
                                caseData.article_linked = value || undefined;
                            }
                            else if (normalizedParam.includes('articleimproved') || normalizedParam.includes('improved')) {
                                caseData.article_improved = value || undefined;
                            }
                            else if (normalizedParam.includes('createopportunity')) {
                                caseData.create_opportunity = value || undefined;
                            }
                            else if (normalizedParam.includes('improvementopportunity')) {
                                caseData.improvement_opportunity = value || undefined;
                            }
                            else if (normalizedParam.includes('articlecreated') || normalizedParam.includes('created')) {
                                caseData.article_created = value || undefined;
                            }
                            else if (normalizedParam.includes('relevantlink') || normalizedParam.includes('relevant')) {
                                caseData.relevant_link = value || undefined;
                            }
                        });
                        // Decide whether to use an empty case or create a new one
                        if (emptyCaseIndex < emptyCases.length) {
                            // Use an empty case slot first (regardless of case number)
                            const emptyCase = emptyCases[emptyCaseIndex];
                            emptyCaseIndex++;
                            // Update the empty case with data from Excel (including case_id if present)
                            const updateData = {
                                case_id: case_.case_number ? case_.case_number.toString() : undefined,
                                notes: caseData.notes
                            };
                            // Add parameter values if they are defined
                            if (caseData.kb_potential !== undefined)
                                updateData.kb_potential = caseData.kb_potential;
                            if (caseData.article_linked !== undefined)
                                updateData.article_linked = caseData.article_linked;
                            if (caseData.article_improved !== undefined)
                                updateData.article_improved = caseData.article_improved;
                            if (caseData.improvement_opportunity !== undefined)
                                updateData.improvement_opportunity = caseData.improvement_opportunity;
                            if (caseData.article_created !== undefined)
                                updateData.article_created = caseData.article_created;
                            if (caseData.create_opportunity !== undefined)
                                updateData.create_opportunity = caseData.create_opportunity;
                            if (caseData.relevant_link !== undefined)
                                updateData.relevant_link = caseData.relevant_link;
                            evaluationService_1.default.updateCase(emptyCase.id, updateData);
                            result.imported_cases++;
                        }
                        else {
                            // No empty cases left - create new case (case 8+)
                            evaluationService_1.default.addCase(evaluation.id, caseData);
                            result.imported_cases++;
                        }
                    }
                    catch (caseError) {
                        logger_1.default.warn(`Failed to process case ${case_.case_number} for evaluation ${evaluation.id}: ${caseError.message}`);
                    }
                }
            }
            catch (evalError) {
                if (evalError.message.includes('already exists')) {
                    logger_1.default.warn(`Evaluation already exists for ${engineer.name}, month ${month}, skipping`);
                    continue;
                }
                logger_1.default.error(`Failed to create evaluation for ${engineer.name}, month ${month}: ${evalError.message}`);
                throw evalError;
            }
        }
    }
}
exports.default = new ExcelImportService();
//# sourceMappingURL=excelImportService.js.map