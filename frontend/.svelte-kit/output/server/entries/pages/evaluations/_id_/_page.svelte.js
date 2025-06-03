import { g as store_get, h as head, c as escape_html, u as unsubscribe_stores, a as pop, p as push } from "../../../../chunks/index2.js";
import { p as page } from "../../../../chunks/stores.js";
import "../../../../chunks/client.js";
import "../../../../chunks/toast.js";
import "../../../../chunks/api.js";
import { a as authStore } from "../../../../chunks/auth.js";
function _page($$payload, $$props) {
  push();
  var $$store_subs;
  authStore.subscribe((auth) => {
    auth.user;
  });
  function canEdit() {
    return false;
  }
  parseInt(store_get($$store_subs ??= {}, "$page", page).params.id);
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>Evaluation Details - KCS Portal</title>`;
  });
  $$payload.out += `<div class="container mx-auto px-4 py-8"><div class="flex justify-between items-center mb-6"><div class="flex items-center gap-4"><button class="text-blue-600 hover:text-blue-800 flex items-center gap-2">← Back to Evaluations</button> <h1 class="text-3xl font-bold text-gray-900">Evaluation Details</h1></div> `;
  if (canEdit()) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="flex gap-2"><button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">${escape_html("Edit Mode")}</button> <button class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Delete Evaluation</button></div>`;
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--></div> `;
  {
    $$payload.out += "<!--[1-->";
    $$payload.out += `<div class="text-center py-8 text-gray-500">Evaluation not found or access denied.</div>`;
  }
  $$payload.out += `<!--]--></div> `;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> `;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> `;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]-->`;
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _page as default
};
