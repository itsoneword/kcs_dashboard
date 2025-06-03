import { e as ensure_array_like, h as head, c as escape_html, b as attr_class, i as stringify, j as attr, a as pop, p as push } from "../../../chunks/index2.js";
import "../../../chunks/client.js";
import "../../../chunks/auth.js";
import "../../../chunks/toast.js";
import "../../../chunks/api.js";
function _page($$payload, $$props) {
  push();
  let filteredUsers;
  let currentUser = null;
  let users = [];
  let searchTerm = "";
  let dbBackups = [];
  let isLoadingDbStatus = false;
  let isLoadingDbBackups = false;
  let newDbPathInput = "";
  function getUserRoles(user) {
    return ["User"];
  }
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = [
      "Bytes",
      "KB",
      "MB",
      "GB",
      "TB",
      "PB",
      "EB",
      "ZB",
      "YB"
    ];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }
  filteredUsers = users.filter((user) => true);
  const each_array = ensure_array_like(getUserRoles());
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>User Management - KCS Portal</title>`;
  });
  $$payload.out += `<div class="min-h-screen bg-gray-50"><nav class="bg-white shadow-sm border-b border-gray-200"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="flex justify-between h-16"><div class="flex items-center space-x-4"><a href="/dashboard" class="text-primary-600 hover:text-primary-500"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg></a> <h1 class="text-xl font-semibold text-gray-900">User Management</h1></div> <div class="flex items-center space-x-4"><span class="text-sm text-gray-700">${escape_html(currentUser?.name)}</span> <!--[-->`;
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let role = each_array[$$index];
    $$payload.out += `<span${attr_class(`badge badge-${stringify(role.toLowerCase())}`)}>${escape_html(role)}</span>`;
  }
  $$payload.out += `<!--]--> <button class="btn-secondary text-sm">Logout</button></div></div></div></nav> <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"><div class="px-4 py-6 sm:px-0"><div class="mb-6"><h2 class="text-2xl font-bold text-gray-900">User Management</h2> <p class="text-gray-600">Manage user roles and permissions</p></div> <div class="card mb-6"><div class="px-6 py-4"><div class="flex justify-between items-center"><div class="flex-1 max-w-md"><label class="block text-sm font-medium text-gray-700 mb-1">Search Users</label> <input type="text"${attr("value", searchTerm)} placeholder="Search by name or email..." class="input"/></div> <span class="text-sm text-gray-500">${escape_html(filteredUsers.length)} of ${escape_html(users.length)} users</span></div></div></div> `;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> `;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> `;
  {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="flex items-center justify-center py-12"><div class="text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div> <p class="mt-2 text-gray-600">Loading users...</p></div></div>`;
  }
  $$payload.out += `<!--]--> <div class="mt-12 pt-8 border-t border-gray-200"><div class="mb-6"><h2 class="text-2xl font-bold text-gray-900">Database Management</h2> <p class="text-gray-600">Manage database status and backups. Change active database file.</p></div> <div class="grid grid-cols-1 lg:grid-cols-2 gap-8"><div class="space-y-6"><div class="card"><div class="card-header"><h3 class="card-title">Database Status</h3> <button class="btn-secondary btn-sm"${attr("disabled", isLoadingDbStatus, true)}>`;
  {
    $$payload.out += "<!--[!-->";
    $$payload.out += `Refresh`;
  }
  $$payload.out += `<!--]--></button></div> <div class="card-body">`;
  {
    $$payload.out += "<!--[!-->";
    $$payload.out += `<p class="text-red-500">Error: ${escape_html("Could not load database status.")}</p>`;
  }
  $$payload.out += `<!--]--></div></div> <div class="card"><div class="card-header"><h3 class="card-title">Database Backups</h3> <div class="space-x-2"><button class="btn-secondary btn-sm"${attr("disabled", isLoadingDbBackups, true)}>`;
  {
    $$payload.out += "<!--[!-->";
    $$payload.out += `Refresh`;
  }
  $$payload.out += `<!--]--></button> <button class="btn-primary btn-sm"${attr("disabled", isLoadingDbBackups, true)}>Create Backup</button></div></div> <div class="card-body">`;
  if (dbBackups.length > 0) {
    $$payload.out += "<!--[1-->";
    const each_array_3 = ensure_array_like(dbBackups);
    $$payload.out += `<ul class="divide-y divide-gray-200 max-h-120 overflow-y-auto"><!--[-->`;
    for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
      let backup = each_array_3[$$index_3];
      $$payload.out += `<li class="py-3"><div class="flex justify-between items-center text-sm"><div><p class="font-medium text-gray-900">${escape_html(backup.filename)}</p> <p class="text-gray-500 text-xs">Created: ${escape_html(new Date(backup.created).toLocaleString())}</p></div> <span class="text-gray-700">${escape_html(formatBytes(backup.size))}</span></div></li>`;
    }
    $$payload.out += `<!--]--></ul>`;
  } else {
    $$payload.out += "<!--[!-->";
    $$payload.out += `<p class="text-gray-500">No backups found. (Ensure 'backups' directory exists in
                    backend root).</p>`;
  }
  $$payload.out += `<!--]--></div></div></div> <div class="space-y-6"><div class="card"><div class="card-header"><h3 class="card-title">Change Active Database</h3></div> <div class="card-body"><p class="text-sm text-gray-600 mb-3">Enter the path to a new SQLite database file. The path can be
                  absolute or relative to the backend server root. The
                  application will attempt to connect to this new database.</p> <div class="mb-3"><label for="newDbPath" class="block text-sm font-medium text-gray-700 mb-1">New Database Path (.db)</label> <input type="text" id="newDbPath"${attr("value", newDbPathInput)} class="input" placeholder="e.g., /path/to/your/new_database.db or ../data/another.db"/></div> <button class="btn-primary w-full"${attr("disabled", !newDbPathInput.trim(), true)}>`;
  {
    $$payload.out += "<!--[!-->";
    $$payload.out += `Change Database`;
  }
  $$payload.out += `<!--]--></button> <p class="text-xs text-gray-500 mt-2">Changing the database will restart the connection. Ensure the
                  path is correct and the file exists and is accessible by the
                  server.</p></div></div></div></div></div></div></div></div> `;
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
  $$payload.out += `<!--]--> `;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]-->`;
  pop();
}
export {
  _page as default
};
