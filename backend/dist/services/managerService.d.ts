import { User } from '../types';
export declare class ManagerService {
    /**
     * Assign a manager to a user
     * @param managerId - ID of the manager
     * @param assignedToId - ID of the user to assign the manager to
     * @returns The manager assignment details
     */
    assignManager(managerId: number, assignedToId: number): Promise<any>;
    /**
     * Remove a manager assignment
     * @param managerId - ID of the manager
     * @param assignedToId - ID of the user the manager is assigned to
     */
    removeManager(managerId: number, assignedToId: number): Promise<void>;
    /**
     * Get the manager for a specific user
     * @param userId - ID of the user to get the manager for
     * @returns The manager user object or null if no manager is assigned
     */
    getManagerForUser(userId: number): User | null;
    /**
     * Get all users assigned to a specific manager
     * @param managerId - ID of the manager
     * @returns Array of user objects assigned to the manager
     */
    getUsersForManager(managerId: number): User[];
    /**
     * Get all manager assignments
     * @returns Array of all active manager assignments with user details
     */
    getAllManagerAssignments(): any[];
}
declare const _default: ManagerService;
export default _default;
//# sourceMappingURL=managerService.d.ts.map