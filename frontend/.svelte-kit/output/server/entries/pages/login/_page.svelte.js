import { h as head, c as escape_html, j as attr, a as pop, p as push } from "../../../chunks/index2.js";
import "../../../chunks/client.js";
import "../../../chunks/auth.js";
const loginTexts = {
  title: "Sign in to your account",
  subtitle: "KCS Performance Tracking Portal",
  emailLabel: "Email address",
  passwordLabel: "Password",
  submitButton: "Sign in",
  needAccount: "Need an account?"
};
function _page($$payload, $$props) {
  push();
  let email = "";
  let password = "";
  let isLoading = false;
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>${escape_html("Login")} - KCS Portal</title>`;
  });
  $$payload.out += `<div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"><div class="max-w-md w-full space-y-8"><div><h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">${escape_html(loginTexts.title)}</h2> <p class="mt-2 text-center text-sm text-gray-600">${escape_html(loginTexts.subtitle)}</p></div> <form class="mt-8 space-y-6"><div class="space-y-4">`;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> <div><label for="email" class="form-label">${escape_html(loginTexts.emailLabel)}</label> <input id="email" name="email" type="email" autocomplete="email" required class="form-input" placeholder="Enter your email"${attr("value", email)}${attr("disabled", isLoading, true)}/></div> <div><label for="password" class="form-label">${escape_html(loginTexts.passwordLabel)}</label> <input id="password" name="password" type="password"${attr("autocomplete", "current-password")} required class="form-input" placeholder="Enter your password"${attr("value", password)}${attr("disabled", isLoading, true)}/> `;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--></div></div> `;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> `;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> <div><button type="submit" class="btn-primary w-full flex justify-center py-3"${attr("disabled", isLoading, true)}>`;
  {
    $$payload.out += "<!--[!-->";
    $$payload.out += `${escape_html(loginTexts.submitButton)}`;
  }
  $$payload.out += `<!--]--></button></div> <div class="text-center"><button type="button" class="text-primary-600 hover:text-primary-500 text-sm"${attr("disabled", isLoading, true)}>${escape_html(loginTexts.needAccount + " Register")}</button></div></form></div></div>`;
  pop();
}
export {
  _page as default
};
