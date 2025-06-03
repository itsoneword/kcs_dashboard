import { h as head, a as pop, p as push } from "../../../chunks/index2.js";
import "../../../chunks/client.js";
import "../../../chunks/auth.js";
import "../../../chunks/toast.js";
import "../../../chunks/api.js";
function _page($$payload, $$props) {
  push();
  let engineers = [];
  ({
    start_date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
  });
  engineers.filter((engineer) => {
    const matchesActive = engineer.is_active;
    return matchesActive;
  });
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>Engineers - KCS Portal</title>`;
  });
  {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="flex items-center justify-center min-h-screen"><div class="text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div> <p class="mt-4 text-gray-600">Loading team data...</p></div></div>`;
  }
  $$payload.out += `<!--]-->`;
  pop();
}
export {
  _page as default
};
