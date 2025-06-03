import { w as writable } from "./index.js";
import { a as apiService } from "./api.js";
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true
};
function createAuthStore() {
  const { subscribe, set, update } = writable(initialState);
  return {
    subscribe,
    // Initialize auth state from localStorage
    init: () => {
    },
    // Login action
    login: async (email, password) => {
      update((state) => ({ ...state, isLoading: true }));
      const maxRetries = 3;
      let lastError;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await apiService.login({ email, password });
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false
          });
          return response;
        } catch (error) {
          lastError = error;
          if (error.response?.status === 401 || error.response?.status === 429) {
            break;
          }
          if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 408 && error.response?.status !== 409) {
            break;
          }
          if (attempt < maxRetries) {
            const delay = Math.min(1e3 * Math.pow(2, attempt - 1), 5e3);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
      throw lastError;
    },
    // Register action
    register: async (email, password, name, role) => {
      update((state) => ({ ...state, isLoading: true }));
      try {
        const response = await apiService.register({ email, password, name, role });
        set({
          user: response.user,
          isAuthenticated: true,
          isLoading: false
        });
        return response;
      } catch (error) {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false
        });
        throw error;
      }
    },
    // Logout action
    logout: async () => {
      update((state) => ({ ...state, isLoading: true }));
      try {
        await apiService.logout();
      } finally {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false
        });
      }
    },
    // Update user in store (after role changes, etc.)
    updateUser: (user) => {
      update((state) => ({
        ...state,
        user
      }));
    },
    // Check if user has specific role
    hasRole: (role) => {
      const currentState = get(authStore);
      if (!currentState.user) return false;
      switch (role) {
        case "admin":
          return currentState.user.is_admin;
        case "lead":
          return currentState.user.is_lead;
        case "coach":
          return currentState.user.is_coach;
        case "manager":
          return currentState.user.is_manager;
        default:
          return false;
      }
    },
    // Check if user has any of the specified roles
    hasAnyRole: (roles) => {
      return roles.some((role) => authStore.hasRole(role));
    }
  };
}
const authStore = createAuthStore();
function get(store) {
  let value;
  const unsubscribe = store.subscribe((v) => value = v);
  unsubscribe();
  return value;
}
export {
  authStore as a
};
