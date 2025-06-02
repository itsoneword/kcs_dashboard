import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { User, UserRole } from '../types';
import apiService from '../api';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const initialState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: true,
};

function createAuthStore() {
    const { subscribe, set, update } = writable<AuthState>(initialState);

    return {
        subscribe,

        // Initialize auth state from localStorage
        init: () => {
            if (browser) {
                const token = apiService.getStoredToken();
                const user = apiService.getStoredUser();

                if (token && user) {
                    set({
                        user,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } else {
                    set({
                        user: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                }
            }
        },

        // Login action
        login: async (email: string, password: string) => {
            update(state => ({ ...state, isLoading: true }));

            const maxRetries = 3;
            let lastError: any;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const response = await apiService.login({ email, password });

                    set({
                        user: response.user,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    return response;
                } catch (error: any) {
                    lastError = error;

                    // Don't retry on authentication errors (401) or rate limiting (429)
                    if (error.response?.status === 401 || error.response?.status === 429) {
                        break;
                    }

                    // Don't retry on client errors (4xx) except for 408 (timeout) and 409 (conflict)
                    if (error.response?.status >= 400 && error.response?.status < 500 &&
                        error.response?.status !== 408 && error.response?.status !== 409) {
                        break;
                    }

                    // Wait before retry (exponential backoff)
                    if (attempt < maxRetries) {
                        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }

            // All retries failed
            set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
            });

            throw lastError;
        },

        // Register action
        register: async (email: string, password: string, name: string, role: UserRole) => {
            update(state => ({ ...state, isLoading: true }));

            try {
                const response = await apiService.register({ email, password, name, role });

                set({
                    user: response.user,
                    isAuthenticated: true,
                    isLoading: false,
                });

                return response;
            } catch (error) {
                set({
                    user: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
                throw error;
            }
        },

        // Logout action
        logout: async () => {
            update(state => ({ ...state, isLoading: true }));

            try {
                await apiService.logout();
            } finally {
                set({
                    user: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
            }
        },

        // Update user in store (after role changes, etc.)
        updateUser: (user: User) => {
            update(state => ({
                ...state,
                user,
            }));

            if (browser) {
                localStorage.setItem('user', JSON.stringify(user));
            }
        },

        // Check if user has specific role
        hasRole: (role: 'admin' | 'lead' | 'coach' | 'manager'): boolean => {
            const currentState = get(authStore);
            if (!currentState.user) return false;

            switch (role) {
                case 'admin':
                    return currentState.user.is_admin;
                case 'lead':
                    return currentState.user.is_lead;
                case 'coach':
                    return currentState.user.is_coach;
                case 'manager':
                    return currentState.user.is_manager;
                default:
                    return false;
            }
        },

        // Check if user has any of the specified roles
        hasAnyRole: (roles: ('admin' | 'lead' | 'coach' | 'manager')[]): boolean => {
            return roles.some(role => authStore.hasRole(role));
        },
    };
}

export const authStore = createAuthStore();

// Helper function to get current state
function get<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
    let value: T;
    const unsubscribe = store.subscribe((v) => value = v);
    unsubscribe();
    return value!;
} 