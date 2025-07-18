// @ts-nocheck
import type { LayoutLoad } from './$types';
import type { User } from '$lib/types';
import { apiService } from '$lib/api';

export const load = async () => {
    try {
        const response = await apiService.getCurrentUser();
        return {
            user: response.user
        };
    } catch (error) {
        return {
            user: null
        };
    }
}; ;null as any as LayoutLoad;