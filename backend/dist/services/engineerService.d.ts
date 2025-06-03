import { Engineer, CreateEngineerRequest, UpdateEngineerRequest } from '../types';
declare class EngineerService {
    getAllEngineers(leadUserId?: number, isActive?: boolean): Engineer[];
    getEngineerById(id: number): Engineer | null;
    createEngineer(data: CreateEngineerRequest): Engineer;
    updateEngineer(id: number, data: UpdateEngineerRequest): Engineer;
    getEngineersByCoach(coachUserId: number): Engineer[];
    getEngineersByLead(leadUserId: number): Engineer[];
    searchEngineers(searchTerm: string, leadUserId?: number): Engineer[];
}
declare const _default: EngineerService;
export default _default;
//# sourceMappingURL=engineerService.d.ts.map