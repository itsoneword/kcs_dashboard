import winston from 'winston';
declare const logger: winston.Logger;
export declare const auditLog: (action: string, userId: number, targetType?: string, targetId?: number, details?: any) => void;
export declare const logUserAction: {
    login: (userId: number, email: string) => void;
    logout: (userId: number) => void;
    roleChange: (adminId: number, targetUserId: number, oldRoles: any, newRoles: any) => void;
    evaluationCreate: (coachId: number, engineerId: number, evaluationId: number, evaluationDate: string) => void;
    evaluationUpdate: (userId: number, evaluationId: number, changes: any) => void;
    engineerCreate: (leadId: number, engineerId: number, engineerName: string) => void;
    engineerUpdate: (userId: number, engineerId: number, updateData: any) => void;
    assignmentCreate: (leadId: number, engineerId: number, coachId: number) => void;
    assignmentEnd: (leadId: number, assignmentId: number, engineerId: number, coachId: number) => void;
    passwordChange: (userId: number, targetUserId: number) => void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map