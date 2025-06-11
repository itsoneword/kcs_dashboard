// @ts-nocheck
import type { PageLoad } from './$types';

export const load = async ({ parent }: Parameters<PageLoad>[0]) => {
    // Get user data from parent layout
    const { user } = await parent();
    // Removed server-side redirect; rely on client-side auth guard
    return { user };
}; 