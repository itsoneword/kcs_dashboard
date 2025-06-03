import { CoachAssignment, CreateCoachAssignmentRequest } from '../types';
declare class CoachAssignmentService {
    getAllAssignments(engineerId?: number, coachUserId?: number, isActive?: boolean): CoachAssignment[];
    getAssignmentById(id: number): CoachAssignment | null;
    createAssignment(assignmentData: CreateCoachAssignmentRequest): CoachAssignment;
    endAssignment(id: number, endDate: string): CoachAssignment;
    getActiveAssignmentsByCoach(coachUserId: number): CoachAssignment[];
    getAssignmentsByLead(leadUserId: number): CoachAssignment[];
    hasActiveCoach(engineerId: number): boolean;
}
declare const _default: CoachAssignmentService;
export default _default;
//# sourceMappingURL=coachAssignmentService.d.ts.map