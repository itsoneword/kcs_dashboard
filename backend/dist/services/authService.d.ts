import { User, LoginRequest, CreateUserRequest } from '../types';
export declare class AuthService {
    private jwtSecret;
    private jwtExpiresIn;
    constructor();
    login(credentials: LoginRequest): Promise<{
        user: User;
        token: string;
    }>;
    register(userData: CreateUserRequest): Promise<{
        user: User;
        token: string;
    }>;
    verifyToken(token: string): User;
    private generateToken;
    getUserById(id: number): User | null;
    updateUserRoles(adminId: number, targetUserId: number, roles: {
        is_coach?: boolean;
        is_lead?: boolean;
        is_admin?: boolean;
        is_manager?: boolean;
    }): Promise<User>;
    getAllUsers(): User[];
    deleteUser(adminId: number, targetUserId: number): Promise<void>;
}
declare const _default: AuthService;
export default _default;
//# sourceMappingURL=authService.d.ts.map