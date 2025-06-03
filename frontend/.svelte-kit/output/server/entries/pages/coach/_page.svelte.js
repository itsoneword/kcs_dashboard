import { k as copy_payload, l as assign_payload, a as pop, p as push, h as head } from "../../../chunks/index2.js";
import "../../../chunks/client.js";
import "../../../chunks/auth.js";
import "../../../chunks/api.js";
function _page($$payload, $$props) {
  push();
  ({
    year: (/* @__PURE__ */ new Date()).getFullYear().toString()
  });
  ({
    evaluation_date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
  });
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    head($$payload2, ($$payload3) => {
      $$payload3.title = `<title>Coach Evaluations - KCS Portal</title>`;
    });
    {
      $$payload2.out += "<!--[-->";
      $$payload2.out += `<div class="flex items-center justify-center min-h-screen"><div class="text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div> <p class="mt-4 text-gray-600">Loading evaluations...</p></div></div>`;
    }
    $$payload2.out += `<!--]-->`;
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  pop();
}
export {
  _page as default
};
