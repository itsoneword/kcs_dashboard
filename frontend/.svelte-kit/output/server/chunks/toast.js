import { w as writable } from "./index.js";
function createToastStore() {
  const { subscribe, update } = writable([]);
  return {
    subscribe,
    add: (toast) => {
      const id = Math.random().toString(36).substr(2, 9);
      const newToast = {
        ...toast,
        id,
        duration: toast.duration || 5e3
      };
      update((toasts) => [...toasts, newToast]);
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          update((toasts) => toasts.filter((t) => t.id !== id));
        }, newToast.duration);
      }
      return id;
    },
    remove: (id) => {
      update((toasts) => toasts.filter((t) => t.id !== id));
    },
    clear: () => {
      update(() => []);
    },
    // Convenience methods
    success: (message, duration) => {
      update((toasts) => [...toasts, {
        id: Math.random().toString(36).substr(2, 9),
        type: "success",
        message,
        duration: duration || 5e3
      }]);
    },
    error: (message, duration) => {
      update((toasts) => [...toasts, {
        id: Math.random().toString(36).substr(2, 9),
        type: "error",
        message,
        duration: duration || 5e3
      }]);
    },
    warning: (message, duration) => {
      update((toasts) => [...toasts, {
        id: Math.random().toString(36).substr(2, 9),
        type: "warning",
        message,
        duration: duration || 5e3
      }]);
    },
    info: (message, duration) => {
      update((toasts) => [...toasts, {
        id: Math.random().toString(36).substr(2, 9),
        type: "info",
        message,
        duration: duration || 5e3
      }]);
    }
  };
}
const toastStore = createToastStore();
export {
  toastStore as t
};
