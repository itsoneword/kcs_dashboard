import { writable } from 'svelte/store';

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
}

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    return {
        subscribe,

        add: (toast: Omit<Toast, 'id'>) => {
            const id = Math.random().toString(36).substr(2, 9);
            const newToast: Toast = {
                ...toast,
                id,
                duration: toast.duration || 5000
            };

            update(toasts => [...toasts, newToast]);

            // Auto remove after duration
            if (newToast.duration && newToast.duration > 0) {
                setTimeout(() => {
                    update(toasts => toasts.filter(t => t.id !== id));
                }, newToast.duration);
            }

            return id;
        },

        remove: (id: string) => {
            update(toasts => toasts.filter(t => t.id !== id));
        },

        clear: () => {
            update(() => []);
        },

        // Convenience methods
        success: (message: string, duration?: number) => {
            update(toasts => [...toasts, {
                id: Math.random().toString(36).substr(2, 9),
                type: 'success',
                message,
                duration: duration || 5000
            }]);
        },

        error: (message: string, duration?: number) => {
            update(toasts => [...toasts, {
                id: Math.random().toString(36).substr(2, 9),
                type: 'error',
                message,
                duration: duration || 5000
            }]);
        },

        warning: (message: string, duration?: number) => {
            update(toasts => [...toasts, {
                id: Math.random().toString(36).substr(2, 9),
                type: 'warning',
                message,
                duration: duration || 5000
            }]);
        },

        info: (message: string, duration?: number) => {
            update(toasts => [...toasts, {
                id: Math.random().toString(36).substr(2, 9),
                type: 'info',
                message,
                duration: duration || 5000
            }]);
        }
    };
}

export const toastStore = createToastStore(); 