const XlsxPopulate = require('xlsx-populate');
const fs = require('fs');
const path = require('path');

/**
 * Test Excel Parser for KCS Evaluation Data
 * Run this script independently to test Excel parsing logic
 * Usage: node test-excel-parser.js path/to/excel/file.xlsx
 */

class ExcelParser {
    constructor() {
        this.supportedFormats = ['.xlsx', '.xlsm'];
        this.results = {
            engineers: [],
            evaluations: [],
            conflicts: [],
            errors: [],
            metadata: {
                coach_name: null,
                total_cases: 0,
                quarters_found: []
            }
        };
    }

    /**
     * Parse Excel file and extract evaluation data
     * @param {string} filePath - Path to Excel file
     * @returns {Object} Parsed results
     */
    async parseFile(filePath) {
        try {
            console.log(`📊 Parsing Excel file: ${filePath}`);

            // Check file extension
            const ext = path.extname(filePath).toLowerCase();
            if (!this.supportedFormats.includes(ext)) {
                throw new Error(`Unsupported file format: ${ext}. Supported: ${this.supportedFormats.join(', ')}`);
            }

            // Read Excel file with xlsx-populate
            const workbook = await XlsxPopulate.fromFileAsync(filePath);

            const worksheetNames = workbook.sheets().map(sheet => sheet.name());
            console.log(`📋 Found ${worksheetNames.length} sheets: ${worksheetNames.join(', ')}`);

            // Filter sheets: skip first (summary) and ignore "Engineer X" sheets
            const allSheets = workbook.sheets();
            const validSheets = allSheets.filter((sheet, index) => {
                if (index === 0) {
                    console.log(`   ⏭️  Skipping first sheet (summary): ${sheet.name()}`);
                    return false;
                }
                if (/Engineer\s+\d+/i.test(sheet.name())) {
                    console.log(`   ⏭️  Skipping empty engineer sheet: ${sheet.name()}`);
                    return false;
                }
                return true;
            });

            console.log(`👤 Processing ${validSheets.length} engineer sheets`);

            // Process each valid sheet
            validSheets.forEach(sheet => {
                console.log(`\n👤 Processing engineer sheet: ${sheet.name()}`);
                this.parseEngineerSheet(sheet, sheet.name());
            });

            return this.results;
        } catch (error) {
            console.error('❌ Error parsing Excel file:', error.message);
            this.results.errors.push(error.message);
            return this.results;
        }
    }

    /**
     * Parse individual engineer sheet
     * @param {Object} sheet - xlsx-populate sheet object
     * @param {string} sheetName - Name from sheet tab
     */
    parseEngineerSheet(sheet, sheetName) {
        try {
            // Convert xlsx-populate sheet to 2D array
            const data = this.convertSheetToArray(sheet);

            console.log(`   📊 Sheet dimensions: ${data.length} rows`);
            if (data.length === 0) {
                console.log('   ⚠️  Empty sheet, skipping');
                return;
            }

            // Extract metadata from first row
            const metadata = this.extractMetadata(data);
            console.log(`   📋 Metadata:`, metadata);

            // Find parameter headers (C2-I2)
            const paramHeaders = this.extractParameterHeaders(data);
            console.log(`   📊 Parameters:`, paramHeaders);

            // Find quarter boundaries
            const quarters = this.findQuarters(data);
            console.log(`   🗓️  Quarters found:`, quarters.map(q => `${q.name} (rows ${q.startRow}-${q.endRow})`));

            const engineer = {
                name: metadata.engineer_name || sheetName,
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
                    console.log(`   📋 Found ${cases.length} cases in ${quarter.name}`);
                }
            });

            this.results.engineers.push(engineer);
            this.results.metadata.total_cases += engineer.evaluations.reduce((sum, evaluation) => sum + evaluation.cases.length, 0);

        } catch (error) {
            console.error(`   ❌ Error parsing sheet ${sheetName}:`, error.message);
            this.results.errors.push(`Sheet ${sheetName}: ${error.message}`);
        }
    }

    /**
     * Convert xlsx-populate sheet to 2D array for easier processing
     * @param {Object} sheet - xlsx-populate sheet
     * @returns {Array} 2D array of cell values
     */
    convertSheetToArray(sheet) {
        const data = [];

        // Get the used range of the sheet
        const usedRange = sheet.usedRange();
        if (!usedRange) {
            return data; // Empty sheet
        }

        const startRow = usedRange.startCell().rowNumber();
        const endRow = usedRange.endCell().rowNumber();
        const startCol = usedRange.startCell().columnNumber();
        const endCol = Math.max(usedRange.endCell().columnNumber(), 15); // Ensure we get at least 15 columns

        // Convert each row to array (xlsx-populate uses 1-based indexing)
        for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
            const row = [];

            for (let colNum = 1; colNum <= endCol; colNum++) {
                try {
                    const cell = sheet.cell(rowNum, colNum);
                    let value = cell.value();

                    // Handle different value types
                    if (value && typeof value === 'object') {
                        // Handle rich text or other complex objects
                        if (value.text) {
                            value = value.text;
                        } else if (Array.isArray(value)) {
                            value = value.map(item => item.text || item).join('');
                        }
                    }

                    // Convert to 0-based index for compatibility
                    row[colNum - 1] = value;
                } catch (cellError) {
                    // Handle cells that don't exist or have errors
                    row[colNum - 1] = null;
                }
            }

            // Convert to 0-based index for row
            data[rowNum - 1] = row;
        }

        return data;
    }

    /**
     * Extract metadata from the sheet (coach name, engineer name)
     * @param {Array} data - Sheet data as 2D array
     * @returns {Object} Metadata object
     */
    extractMetadata(data) {
        const metadata = {
            coach_name: null,
            engineer_name: null
        };

        if (data.length > 0) {
            const firstRow = data[0] || [];

            // H1 may contain coach name
            if (firstRow[7]) { // Column H (index 7)
                metadata.coach_name = String(firstRow[7]).trim();
                console.log(`   👨‍💼 Coach found in H1: ${metadata.coach_name}`);

                // Store globally if not set yet
                if (!this.results.metadata.coach_name) {
                    this.results.metadata.coach_name = metadata.coach_name;
                }
            }

            // D1 may contain engineer name
            if (firstRow[3]) { // Column D (index 3)
                metadata.engineer_name = String(firstRow[3]).trim();
                console.log(`   👤 Engineer found in D1: ${metadata.engineer_name}`);
            }
        }

        return metadata;
    }

    /**
     * Extract parameter headers from C2-I2
     * @param {Array} data - Sheet data as 2D array
     * @returns {Array} Parameter names
     */
    extractParameterHeaders(data) {
        const headers = [];

        if (data.length > 1) {
            const headerRow = data[1] || []; // Row 2 (index 1)

            // Extract C2-I2 (columns 2-8)
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
     * Find quarter boundaries in column A
     * @param {Array} data - Sheet data as 2D array
     * @returns {Array} Quarter objects with start/end rows
     */
    findQuarters(data) {
        const quarters = [];
        const quarterPattern = /Q[1-4]/i;

        // Find all quarter positions
        const quarterPositions = [];
        data.forEach((row, index) => {
            if (row[0] && quarterPattern.test(String(row[0]))) {
                quarterPositions.push({
                    name: String(row[0]).trim().toUpperCase(),
                    row: index
                });
            }
        });

        // Create quarter ranges
        quarterPositions.forEach((quarter, index) => {
            const nextQuarter = quarterPositions[index + 1];
            quarters.push({
                name: quarter.name,
                startRow: quarter.row,
                endRow: nextQuarter ? nextQuarter.row - 1 : data.length - 1
            });
        });

        this.results.metadata.quarters_found = quarters.map(q => q.name);
        return quarters;
    }

    /**
     * Parse cases within a quarter range
     * @param {Array} data - Sheet data as 2D array
     * @param {Object} quarter - Quarter object with start/end rows
     * @param {Array} paramHeaders - Parameter header information
     * @returns {Array} Cases found in this quarter
     */
    parseCasesInQuarter(data, quarter, paramHeaders) {
        const cases = [];

        for (let rowIndex = quarter.startRow; rowIndex <= quarter.endRow; rowIndex++) {
            const row = data[rowIndex] || [];

            // Check if column B has a number (case number)
            const caseNumber = row[1]; // Column B (index 1)
            if (caseNumber && !isNaN(Number(caseNumber))) {
                const caseData = {
                    case_number: Number(caseNumber),
                    quarter: quarter.name,
                    month: null,
                    notes: null,
                    parameters: {}
                };

                // Extract parameter values (C-I columns)
                paramHeaders.forEach(param => {
                    const value = row[param.column];
                    caseData.parameters[param.name] = this.parseBooleanValue(value);
                });

                // Extract month (Column J, index 9)
                if (row[9]) {
                    caseData.month = String(row[9]).trim();
                }

                // Extract notes (Column K, index 10)
                if (row[10]) {
                    caseData.notes = String(row[10]).trim();
                }

                cases.push(caseData);
                console.log(`     📎 Case ${caseData.case_number}: ${caseData.month || 'No month'}, ${Object.keys(caseData.parameters).length} params`);
            }
        }

        return cases;
    }

    /**
     * Parse boolean values from various formats
     * @param {any} value - Raw cell value
     * @returns {boolean|null} Parsed boolean or null if unclear
     */
    parseBooleanValue(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const str = String(value).toLowerCase().trim();

        // Handle various boolean representations
        if (str === 'true' || str === '1' || str === 'yes' || str === 'y') {
            return true;
        }
        if (str === 'false' || str === '0' || str === 'no' || str === 'n') {
            return false;
        }

        // Handle Excel boolean values
        if (typeof value === 'boolean') {
            return value;
        }

        return null; // Unclear value
    }

    /**
     * Validate parsed data
     * @returns {Object} Validation results
     */
    validateData() {
        const validation = {
            isValid: true,
            warnings: [],
            errors: []
        };

        // Check for required fields
        this.results.engineers.forEach(engineer => {
            if (!engineer.name || engineer.name.trim() === '') {
                validation.errors.push('Engineer name is required');
                validation.isValid = false;
            }

            engineer.evaluations.forEach(evaluation => {
                evaluation.cases.forEach(caseData => {
                    if (!caseData.case_number) {
                        validation.warnings.push(`Missing case number for ${engineer.name}`);
                    }
                    if (!caseData.month) {
                        validation.warnings.push(`Missing month for case ${caseData.case_number} (${engineer.name})`);
                    }
                });
            });
        });

        return validation;
    }

    /**
     * Generate summary report
     */
    generateSummary() {
        console.log('\n📊 PARSING SUMMARY');
        console.log('='.repeat(50));
        console.log(`👥 Engineers found: ${this.results.engineers.length}`);
        console.log(`👨‍💼 Coach: ${this.results.metadata.coach_name || 'Not found'}`);
        console.log(`📋 Total cases: ${this.results.metadata.total_cases}`);
        console.log(`🗓️  Quarters: ${this.results.metadata.quarters_found.join(', ')}`);
        console.log(`⚠️  Conflicts detected: ${this.results.conflicts.length}`);
        console.log(`❌ Errors: ${this.results.errors.length}`);

        // Show engineer details
        this.results.engineers.forEach(engineer => {
            const totalCases = engineer.evaluations.reduce((sum, evaluation) => sum + evaluation.cases.length, 0);
            console.log(`   👤 ${engineer.name}: ${totalCases} cases across ${engineer.evaluations.length} quarters`);
        });

        if (this.results.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            this.results.errors.forEach(error => console.log(`   • ${error}`));
        }

        if (this.results.conflicts.length > 0) {
            console.log('\n⚠️  CONFLICTS:');
            this.results.conflicts.forEach(conflict => console.log(`   • ${conflict}`));
        }

        const validation = this.validateData();
        console.log(`\n✅ Validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
        if (validation.warnings.length > 0) {
            console.log(`⚠️  Warnings: ${validation.warnings.length}`);
            validation.warnings.slice(0, 5).forEach(warning => console.log(`   • ${warning}`));
            if (validation.warnings.length > 5) {
                console.log(`   ... and ${validation.warnings.length - 5} more warnings`);
            }
        }

        return this.results;
    }
}

// Main execution
async function main() {
    const filePath = process.argv[2];

    if (!filePath) {
        console.log('Usage: node test-excel-parser.js <path-to-excel-file>');
        console.log('Example: node test-excel-parser.js ./sample-evaluations.xlsx');
        process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    const parser = new ExcelParser();
    const results = await parser.parseFile(filePath);
    const summary = parser.generateSummary();

    // Save results to JSON for inspection
    const outputPath = 'parsing-results.json';
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(`\n💾 Results saved to: ${outputPath}`);
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ExcelParser; 