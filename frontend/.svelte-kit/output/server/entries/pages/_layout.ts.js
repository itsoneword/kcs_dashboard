import { a as apiService } from "../../chunks/api.js";
const load = async () => {
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
};
export {
  load
};
