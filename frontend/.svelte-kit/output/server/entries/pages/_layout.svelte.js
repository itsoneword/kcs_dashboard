import { e as ensure_array_like, b as attr_class, c as escape_html, d as clsx, a as pop, p as push, f as slot } from "../../chunks/index2.js";
import "../../chunks/auth.js";
import { t as toastStore } from "../../chunks/toast.js";
function Toast($$payload, $$props) {
  push();
  let toasts = [];
  toastStore.subscribe((value) => {
    toasts = value;
  });
  function getToastClasses(type) {
    const baseClasses = "flex items-center p-4 mb-4 text-sm rounded-lg shadow-lg";
    switch (type) {
      case "success":
        return `${baseClasses} text-green-800 bg-green-50 border border-green-200`;
      case "error":
        return `${baseClasses} text-red-800 bg-red-50 border border-red-200`;
      case "warning":
        return `${baseClasses} text-yellow-800 bg-yellow-50 border border-yellow-200`;
      case "info":
        return `${baseClasses} text-blue-800 bg-blue-50 border border-blue-200`;
      default:
        return `${baseClasses} text-gray-800 bg-gray-50 border border-gray-200`;
    }
  }
  function getIcon(type) {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✗";
      case "warning":
        return "⚠";
      case "info":
        return "ℹ";
      default:
        return "•";
    }
  }
  const each_array = ensure_array_like(toasts);
  $$payload.out += `<div class="fixed top-4 right-4 z-50 space-y-2"><!--[-->`;
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let toast = each_array[$$index];
    $$payload.out += `<div${attr_class(clsx(getToastClasses(toast.type)))}><span class="mr-2 font-bold">${escape_html(getIcon(toast.type))}</span> <span class="flex-1">${escape_html(toast.message)}</span> <button class="ml-2 text-gray-400 hover:text-gray-600" aria-label="Close">×</button></div>`;
  }
  $$payload.out += `<!--]--></div>`;
  pop();
}
function _layout($$payload, $$props) {
  push();
  $$payload.out += `<main class="min-h-screen"><!---->`;
  slot($$payload, $$props, "default", {});
  $$payload.out += `<!----></main> `;
  Toast($$payload);
  $$payload.out += `<!---->`;
  pop();
}
export {
  _layout as default
};
