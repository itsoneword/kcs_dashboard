interface UserInfo {
    id: number;
    email: string;
    name: string;
    is_admin: boolean;
    is_lead: boolean;
    is_coach: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
    has_password: boolean;
}
export declare function checkUser(email: string): UserInfo | null;
export declare function listAllUsers(): UserInfo[];
export {};
//# sourceMappingURL=checkUser.d.ts.map