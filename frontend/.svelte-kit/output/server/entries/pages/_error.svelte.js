import { c as escape_html, g as store_get, u as unsubscribe_stores, a as pop, p as push } from "../../chunks/index2.js";
import { p as page } from "../../chunks/stores.js";
function _error($$payload, $$props) {
  push();
  var $$store_subs;
  $$payload.out += `<div class="error-container svelte-1kmzs4o"><div class="error-content svelte-1kmzs4o"><h1 class="svelte-1kmzs4o">${escape_html(store_get($$store_subs ??= {}, "$page", page).status)}: ${escape_html(store_get($$store_subs ??= {}, "$page", page).error?.message || "An error occurred")}</h1> `;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> <div class="error-actions svelte-1kmzs4o"><a href="/" class="btn-primary svelte-1kmzs4o">Go to Home</a> <button class="btn-secondary svelte-1kmzs4o">Try Again</button></div></div></div>`;
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _error as default
};
