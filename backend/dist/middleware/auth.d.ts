import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare const authenticateToken: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const requireAdmin: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const requireLead: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const requireCoach: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const requireAnyRole: (roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map