import { User } from '../types';
interface ParsedCase {
    case_number: number;
    quarter: string;
    month: string | null;
    notes: string | null;
    parameters: Record<string, boolean | null>;
}
interface ParsedEngineer {
    name: string;
    coach_name: string | null;
    evaluations: {
        quarter: string;
        cases: ParsedCase[];
    }[];
}
interface ImportPreview {
    engineers: ParsedEngineer[];
    conflicts: {
        engineer_name: string;
        current_coach: string;
        excel_coach: string | null;
        action: 'skip' | 'reassign' | 'manual';
    }[];
    metadata: {
        coach_name: string | null;
        total_cases: number;
        quarters_found: string[];
        file_name: string;
    };
    errors: string[];
    missing_coaches: {
        engineer_name: string;
        excel_coach_name: string | null;
        suggested_action: 'assign_to_importer' | 'manual_select';
    }[];
    coach_ownership_warning: {
        detected_coach: string;
        importing_user: string;
        should_block_import: boolean;
    } | null;
}
interface ImportResult {
    success: boolean;
    imported_engineers: number;
    imported_evaluations: number;
    imported_cases: number;
    skipped_engineers: string[];
    errors: string[];
}
declare class ExcelImportService {
    /**
     * Parse Excel file and return preview data
     */
    parseExcelFile(fileBuffer: Buffer, fileName: string, importingUser: User, importRole?: 'coach' | 'lead' | 'admin'): Promise<ImportPreview>;
    /**
     * Parse individual engineer sheet
     */
    private parseEngineerSheet;
    /**
     * Convert sheet to 2D array
     */
    private convertSheetToArray;
    /**
     * Extract metadata (coach, engineer names)
     */
    private extractMetadata;
    /**
     * Extract parameter headers from C2-I2
     */
    private extractParameterHeaders;
    /**
     * Find quarter boundaries
     */
    private findQuarters;
    /**
     * Parse cases within quarter
     */
    private parseCasesInQuarter;
    /**
     * Parse boolean values
     */
    private parseBooleanValue;
    /**
     * Detect conflicts with existing data
     */
    private detectConflicts;
    /**
     * Import data after preview confirmation
     */
    importData(preview: ImportPreview, selectedYear: number, coachSelections: Record<string, number>, // engineer_name -> coach_user_id
    importingUser: User, importRole?: 'coach' | 'lead' | 'admin'): Promise<ImportResult>;
    /**
     * Process individual engineer import
     */
    private processEngineerImport;
    /**
     * Process coach assignment for engineer
     */
    private processCoachAssignment;
    /**
     * Get fallback coach for assignment
     */
    private getFallbackCoach;
    /**
     * Process evaluation import for engineer
     */
    private processEvaluationImport;
}
declare const _default: ExcelImportService;
export default _default;
//# sourceMappingURL=excelImportService.d.ts.map