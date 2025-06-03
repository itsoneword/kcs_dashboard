import { p as push, n as getContext, b as attr_class, j as attr, c as escape_html, e as ensure_array_like, i as stringify, m as bind_props, a as pop } from "./index2.js";
import { y as fallback } from "./utils.js";
import "./client.js";
import "./auth.js";
import "./api.js";
function MultiSelectSearchable($$payload, $$props) {
  push();
  let filteredOptions;
  let options = fallback($$props["options"], () => [], true);
  let values = fallback($$props["values"], () => [], true);
  let placeholder = fallback($$props["placeholder"], "Select options...");
  let searchPlaceholder = fallback($$props["searchPlaceholder"], "Search...");
  let disabled = fallback($$props["disabled"], false);
  let group = fallback($$props["group"], "");
  let isOpen = false;
  let searchTerm = "";
  const groupContext = getContext("dropdownGroup");
  if (groupContext && group) {
    groupContext.openDropdown.subscribe((key) => {
      if (key !== group) {
        isOpen = false;
        searchTerm = "";
      }
    });
  }
  function isSelected(option) {
    return values.includes(option.value);
  }
  filteredOptions = options.filter((option) => option.label.toLowerCase().includes(searchTerm.toLowerCase()));
  $$payload.out += `<div class="relative"><button type="button"${attr_class(`w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${stringify(disabled ? "bg-gray-100 cursor-not-allowed" : "cursor-pointer hover:border-gray-400")}`)}${attr("disabled", disabled, true)}><span class="flex flex-wrap gap-1">`;
  if (values.length === 0) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<span class="text-gray-400">${escape_html(placeholder)}</span>`;
  } else {
    $$payload.out += "<!--[!-->";
    const each_array = ensure_array_like(values);
    $$payload.out += `<!--[-->`;
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let v = each_array[$$index];
      if (options.find((opt) => opt.value === v)) {
        $$payload.out += "<!--[-->";
        $$payload.out += `<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs flex items-center gap-1">${escape_html(options.find((opt) => opt.value === v).label)} <span class="cursor-pointer ml-1">×</span></span>`;
      } else {
        $$payload.out += "<!--[!-->";
      }
      $$payload.out += `<!--]-->`;
    }
    $$payload.out += `<!--]-->`;
  }
  $$payload.out += `<!--]--></span> <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></span></button> `;
  if (isOpen) {
    $$payload.out += "<!--[-->";
    const each_array_1 = ensure_array_like(filteredOptions);
    $$payload.out += `<div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg"><div class="p-2 border-b border-gray-200"><input type="text"${attr("value", searchTerm)}${attr("placeholder", searchPlaceholder)} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"/></div> <div class="max-h-60 overflow-auto">`;
    if (each_array_1.length !== 0) {
      $$payload.out += "<!--[-->";
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let option = each_array_1[$$index_1];
        $$payload.out += `<button type="button"${attr_class(`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${stringify(isSelected(option) ? "bg-blue-100 text-blue-900" : "text-gray-900")}`)}><span>${escape_html(option.label)}</span> `;
        if (isSelected(option)) {
          $$payload.out += "<!--[-->";
          $$payload.out += `<span class="ml-2 text-blue-600">✓</span>`;
        } else {
          $$payload.out += "<!--[!-->";
        }
        $$payload.out += `<!--]--></button>`;
      }
    } else {
      $$payload.out += "<!--[!-->";
      $$payload.out += `<div class="px-3 py-2 text-sm text-gray-500">No options found</div>`;
    }
    $$payload.out += `<!--]--></div></div>`;
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--></div> `;
  if (isOpen) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="fixed inset-0 z-0"></div>`;
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]-->`;
  bind_props($$props, {
    options,
    values,
    placeholder,
    searchPlaceholder,
    disabled,
    group
  });
  pop();
}
function Header($$payload, $$props) {
  push();
  let title = $$props["title"];
  let showBackButton = fallback($$props["showBackButton"], true);
  let backUrl = fallback($$props["backUrl"], "/dashboard");
  let user = fallback($$props["user"], null);
  function getUserRoles(user2) {
    const roles = [];
    if (user2.is_admin) roles.push("Admin");
    if (user2.is_lead) roles.push("Lead");
    if (user2.is_coach) roles.push("Coach");
    return roles.length > 0 ? roles : ["User"];
  }
  $$payload.out += `<nav class="bg-white shadow-sm border-b border-gray-200"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="flex justify-between h-16"><div class="flex items-center space-x-4">`;
  if (showBackButton) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<button class="text-primary-600 hover:text-primary-700" title="Go Back"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg></button>`;
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> <button class="text-primary-600 hover:text-primary-700" title="Go to Dashboard"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg></button> <h1 class="text-xl font-semibold text-gray-900">${escape_html(title)}</h1></div> `;
  if (user) {
    $$payload.out += "<!--[-->";
    const each_array = ensure_array_like(getUserRoles(user));
    $$payload.out += `<div class="flex items-center space-x-4"><div class="relative"><button class="text-sm text-gray-700 hover:underline focus:outline-none">Welcome, ${escape_html(user.name)} <svg class="w-4 h-4 inline-block ml-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.793 7.793a1 1 0 011.414 0L10 10.586l2.793-2.793a1 1 0 011.414 1.414l-3.5 3.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg></button> `;
    {
      $$payload.out += "<!--[!-->";
    }
    $$payload.out += `<!--]--></div> <div class="flex space-x-1"><!--[-->`;
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let role = each_array[$$index];
      $$payload.out += `<span${attr_class(`badge badge-${stringify(role.toLowerCase())}`)}>${escape_html(role)}</span>`;
    }
    $$payload.out += `<!--]--></div> <button class="btn-secondary text-sm">Logout</button></div>`;
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--></div></div></nav>`;
  bind_props($$props, { title, showBackButton, backUrl, user });
  pop();
}
export {
  Header as H,
  MultiSelectSearchable as M
};
