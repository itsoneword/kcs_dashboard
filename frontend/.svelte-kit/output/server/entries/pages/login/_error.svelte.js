import { g as store_get, c as escape_html, u as unsubscribe_stores, a as pop, p as push } from "../../../chunks/index2.js";
import { p as page } from "../../../chunks/stores.js";
function _error($$payload, $$props) {
  push();
  var $$store_subs;
  $$payload.out += `<div class="login-error-container svelte-66ac1v"><div class="login-error-content svelte-66ac1v"><h1 class="svelte-66ac1v">Login Page Error</h1> <p>There was an error loading the login page.</p> `;
  if (store_get($$store_subs ??= {}, "$page", page).error?.message) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="error-message svelte-66ac1v"><strong>Error:</strong> ${escape_html(store_get($$store_subs ??= {}, "$page", page).error.message)}</div>`;
  } else {
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
  $$payload.out += `<!--]--> <div class="error-actions svelte-66ac1v"><a href="/" class="btn-primary svelte-66ac1v">Go to Home</a> `;
  {
    $$payload.out += "<!--[-->";
    $$payload.out += `<button class="btn-secondary svelte-66ac1v">Try Again with Debug Mode</button>`;
  }
  $$payload.out += `<!--]--></div></div></div>`;
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _error as default
};
