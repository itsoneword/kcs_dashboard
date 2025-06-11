import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
    // Get user data from parent layout
    const { user } = await parent();
    // Removed server-side redirect; rely on client-side auth guard
    return { user };
}; 