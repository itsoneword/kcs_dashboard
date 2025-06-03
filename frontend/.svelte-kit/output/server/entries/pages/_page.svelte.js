import "clsx";
import { a as pop, p as push } from "../../chunks/index2.js";
import "../../chunks/client.js";
import "../../chunks/auth.js";
function _page($$payload, $$props) {
  push();
  $$payload.out += `<div class="flex items-center justify-center min-h-screen"><div class="text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div> <p class="mt-4 text-gray-600">Loading KCS Portal...</p></div></div>`;
  pop();
}
export {
  _page as default
};
