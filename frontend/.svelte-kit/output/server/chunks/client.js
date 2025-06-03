import "clsx";
import "./exports.js";
import { z as noop } from "./utils.js";
function get(key, parse = JSON.parse) {
  try {
    return parse(sessionStorage[key]);
  } catch {
  }
}
const SNAPSHOT_KEY = "sveltekit:snapshot";
const SCROLL_KEY = "sveltekit:scroll";
const is_legacy = noop.toString().includes("$$") || /function \w+\(\) \{\}/.test(noop.toString());
if (is_legacy) {
  ({
    data: {},
    form: null,
    error: null,
    params: {},
    route: { id: null },
    state: {},
    status: -1,
    url: new URL("https://example.com")
  });
}
get(SCROLL_KEY) ?? {};
get(SNAPSHOT_KEY) ?? {};
function pushState(url, state) {
  {
    throw new Error("Cannot call pushState(...) on the server");
  }
}
export {
  pushState as p
};
