import { h as head, c as escape_html, j as attr, e as ensure_array_like, a as pop, p as push } from "../../../chunks/index2.js";
import "../../../chunks/auth.js";
import "../../../chunks/api.js";
function _page($$payload, $$props) {
  push();
  let apiTestResults = {};
  let testInProgress = false;
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>Debug - KCS Portal</title>`;
  });
  $$payload.out += `<div class="min-h-screen bg-gray-50 p-8"><div class="max-w-4xl mx-auto"><h1 class="text-3xl font-bold text-gray-900 mb-8">Authentication &amp; API Debug</h1> <div class="bg-white rounded-lg shadow p-6 mb-6"><h2 class="text-xl font-semibold mb-4">Authentication Status</h2> <div class="grid grid-cols-2 gap-4"><div><p><strong>Is Authenticated:</strong> ${escape_html("No")}</p> <p><strong>Has Token:</strong> ${escape_html("No")}</p> `;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--></div> <div>`;
  {
    $$payload.out += "<!--[!-->";
    $$payload.out += `<p class="text-gray-500">No user data</p>`;
  }
  $$payload.out += `<!--]--></div></div></div> <div class="bg-white rounded-lg shadow p-6 mb-6"><h2 class="text-xl font-semibold mb-4">Stored Data</h2> <div class="grid grid-cols-2 gap-4"><div><h3 class="font-medium mb-2">Stored User:</h3> `;
  {
    $$payload.out += "<!--[!-->";
    $$payload.out += `<p class="text-gray-500">No stored user</p>`;
  }
  $$payload.out += `<!--]--></div> <div><h3 class="font-medium mb-2">Current User (from store):</h3> `;
  {
    $$payload.out += "<!--[!-->";
    $$payload.out += `<p class="text-gray-500">No current user</p>`;
  }
  $$payload.out += `<!--]--></div></div></div> <div class="bg-white rounded-lg shadow p-6 mb-6"><h2 class="text-xl font-semibold mb-4">API Test Results</h2> <div class="space-y-4"><button${attr("disabled", testInProgress, true)} class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">${escape_html("Test API Endpoints")}</button> `;
  if (Object.keys(apiTestResults).length > 0) {
    $$payload.out += "<!--[-->";
    const each_array = ensure_array_like(Object.entries(apiTestResults));
    $$payload.out += `<div class="space-y-2"><!--[-->`;
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let [endpoint, result] = each_array[$$index];
      $$payload.out += `<div class="border rounded p-3"><h4 class="font-medium">${escape_html(endpoint)}</h4> `;
      if (result.success) {
        $$payload.out += "<!--[-->";
        $$payload.out += `<p class="text-green-600">✓ Success</p> `;
        if (result.count !== void 0) {
          $$payload.out += "<!--[-->";
          $$payload.out += `<p class="text-sm text-gray-600">Count: ${escape_html(result.count)}</p>`;
        } else {
          $$payload.out += "<!--[!-->";
        }
        $$payload.out += `<!--]--> `;
        if (result.data) {
          $$payload.out += "<!--[-->";
          $$payload.out += `<pre class="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">${escape_html(JSON.stringify(result.data, null, 2))}</pre>`;
        } else {
          $$payload.out += "<!--[!-->";
        }
        $$payload.out += `<!--]-->`;
      } else {
        $$payload.out += "<!--[!-->";
        $$payload.out += `<p class="text-red-600">✗ Failed: ${escape_html(result.error)}</p>`;
      }
      $$payload.out += `<!--]--></div>`;
    }
    $$payload.out += `<!--]--></div>`;
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--></div></div> <div class="bg-white rounded-lg shadow p-6"><h2 class="text-xl font-semibold mb-4">Actions</h2> <div class="space-x-4"><button class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Clear Storage &amp; Reload</button> <button class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Logout</button> <a href="/login" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 inline-block">Go to Login</a> <a href="/lead" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 inline-block">Go to Team Management</a></div></div></div></div>`;
  pop();
}
export {
  _page as default
};
