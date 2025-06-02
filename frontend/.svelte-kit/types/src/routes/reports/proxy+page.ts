// @ts-nocheck
import type { PageLoad } from './$types';

export const load = async ({ parent }: Parameters<PageLoad>[0]) => {
    // Get user data from parent layout
    const { user } = await parent();
    
    // URL parameter parsing is now handled by the reportStore.parseUrlParams method
    // directly in the page component
    return { user };
}; 