<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { toastStore } from '$lib/stores/toast';
  import apiService from '$lib/api';
  import type { User } from '$lib/types';

  let currentUser: User | null = null;
  let users: User[] = [];
  let isLoading = true;
  let error = '';
  let successMessage = '';
  let showDeleteUserModal = false;
  let selectedUser: User | null = null;
  let deleteConfirmText = '';
  let searchTerm = '';

  // Database Management State
  let dbStatus: any = null;
  let dbBackups: any[] = [];
  let isLoadingDbStatus = false;
  let isLoadingDbBackups = false;
  let newDbPathInput = '';
  let isLoadingChangeDb = false;

  onMount(async () => {
    const unsubscribe = authStore.subscribe(async (auth) => {
      if (!auth.isAuthenticated && !auth.isLoading) {
        goto('/login');
      } else if (auth.isAuthenticated) {
        currentUser = auth.user;
        
        if (!currentUser?.is_admin) {
          goto('/dashboard');
          return;
        }
        
        await loadUsers();
        await loadDbStatus();
        await loadDbBackups();
      }
    });

    return unsubscribe;
  });

  async function handleLogout() {
    await authStore.logout();
    goto('/login');
  }

  async function loadUsers() {
    try {
      isLoading = true;
      const response = await apiService.getAllUsers();
      users = response.users;
    } catch (err: any) {
      error = err.response?.data?.error || 'Failed to load users';
    } finally {
      isLoading = false;
    }
  }

  async function updateUserRoles(userId: number, roles: { is_coach?: boolean; is_lead?: boolean; is_admin?: boolean }) {
    try {
      error = '';
      successMessage = '';
      
      const response = await apiService.updateUserRoles(userId, roles);
      
      // Update the user in the local list
      users = users.map(user => 
        user.id === userId ? response.user : user
      );
      
      successMessage = response.message;
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        successMessage = '';
      }, 3000);
      
    } catch (err: any) {
      error = err.response?.data?.error || 'Failed to update user roles';
    }
  }

  function getUserRoles(user: User): string[] {
    const roles: string[] = [];
    if (user.is_admin) roles.push('Admin');
    if (user.is_lead) roles.push('Lead');
    if (user.is_coach) roles.push('Coach');
    return roles.length > 0 ? roles : ['User'];
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  function openDeleteUserModal(user: User) {
    selectedUser = user;
    deleteConfirmText = '';
    showDeleteUserModal = true;
  }

  async function deleteUser() {
    try {
      if (deleteConfirmText !== 'DELETE') {
        toastStore.add({ type: 'warning', message: 'Please type "DELETE" to confirm' });
        return;
      }

      if (!selectedUser) return;

      // Soft delete the user
      await apiService.deleteUser(selectedUser.id);
      
      showDeleteUserModal = false;
      toastStore.add({ type: 'success', message: 'User deleted successfully' });
      await loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete user';
      toastStore.add({ type: 'error', message: errorMessage });
    }
  }

  // Filtered users based on search
  $: filteredUsers = users.filter(user => 
    !searchTerm || 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Database Management Functions
  async function loadDbStatus() {
    isLoadingDbStatus = true;
    try {
      dbStatus = await apiService.getDatabaseStatus();
    } catch (err: any) {
      toastStore.add({ type: 'error', message: err.response?.data?.error || 'Failed to load DB status' });
      dbStatus = { error: err.response?.data?.error || 'Failed to load DB status' }; // Store error in status
    } finally {
      isLoadingDbStatus = false;
    }
  }

  async function createDbBackup() {
    try {
      const backup = await apiService.createDatabaseBackup();
      toastStore.add({ type: 'success', message: backup.message });
      await loadDbBackups(); 
    } catch (err: any) {
      toastStore.add({ type: 'error', message: err.response?.data?.error || 'Failed to create DB backup' });
    }
  }

  async function loadDbBackups() {
    isLoadingDbBackups = true;
    try {
      const response = await apiService.getDatabaseBackups();
      dbBackups = response.backups;
    } catch (err: any) {
      toastStore.add({ type: 'error', message: err.response?.data?.error || 'Failed to load DB backups' });
    } finally {
      isLoadingDbBackups = false;
    }
  }

  async function handleChangeDbPath() {
    if (!newDbPathInput.trim()) {
      toastStore.add({ type: 'warning', message: 'New database path cannot be empty.' });
      return;
    }
    isLoadingChangeDb = true;
    try {
      const response = await apiService.changeDatabasePath(newDbPathInput);
      toastStore.add({ type: 'success', message: response.message });
      // Update current DB status with response from change DB operation
      dbStatus = {
        status: response.status,
        path: response.newPath,
        size: response.size,
        lastModified: response.lastModified,
        timestamp: response.timestamp
      };
      newDbPathInput = ''; // Clear input
    } catch (err: any) {
      toastStore.add({ type: 'error', message: err.response?.data?.error || 'Failed to change database path' });
    } finally {
      isLoadingChangeDb = false;
    }
  }

  function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
</script>

<svelte:head>
  <title>Admin Console - KCS Portal</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Navigation Header -->
  <nav class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center space-x-4">
          <a href="/dashboard" class="text-primary-600 hover:text-primary-500">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </a>
          <h1 class="text-xl font-semibold text-gray-900">Admin Console</h1>
        </div>
        
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-700">
            {currentUser?.name}
          </span>
          <span class="badge badge-admin">Admin</span>
          <button
            on:click={handleLogout}
            class="btn-secondary text-sm"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <div class="px-4 py-6 sm:px-0">
      
      <!-- User Management Header -->
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900">User Management</h2>
        <p class="text-gray-600">Manage user roles and permissions</p>
      </div>

      <!-- Search Filter -->
      <div class="card mb-6">
        <div class="px-6 py-4">
          <div class="flex justify-between items-center">
            <div class="flex-1 max-w-md">
              <label class="block text-sm font-medium text-gray-700 mb-1">Search Users</label>
              <input 
                type="text" 
                bind:value={searchTerm}
                placeholder="Search by name or email..."
                class="input"
              />
            </div>
            <span class="text-sm text-gray-500">
              {filteredUsers.length} of {users.length} users
            </span>
          </div>
        </div>
      </div>

      <!-- Messages -->
      {#if error}
        <div class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      {/if}

      {#if successMessage}
        <div class="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {successMessage}
        </div>
      {/if}

      <!-- Users Table -->
      {#if isLoading}
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p class="mt-2 text-gray-600">Loading users...</p>
          </div>
        </div>
      {:else}
        <div class="card overflow-hidden mb-8">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Roles
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each filteredUsers as user (user.id)}
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div class="text-sm font-medium text-gray-900">{user.name}</div>
                        <div class="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex space-x-1">
                        {#each getUserRoles(user) as role}
                          <span class="badge badge-{role.toLowerCase()}">{role}</span>
                        {/each}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div class="flex flex-col space-y-2">
                        <div class="flex space-x-2">
                          <!-- Coach Toggle -->
                          <button
                            class="btn text-xs {user.is_coach ? 'btn-primary' : 'btn-secondary'}"
                            on:click={() => updateUserRoles(user.id, { is_coach: !user.is_coach })}
                          >
                            {user.is_coach ? 'Remove Coach' : 'Make Coach'}
                          </button>
                          
                          <!-- Lead Toggle -->
                          <button
                            class="btn text-xs {user.is_lead ? 'btn-primary' : 'btn-secondary'}"
                            on:click={() => updateUserRoles(user.id, { is_lead: !user.is_lead })}
                          >
                            {user.is_lead ? 'Remove Lead' : 'Make Lead'}
                          </button>
                        </div>
                        
                        <div class="flex space-x-2">
                          <!-- Admin Toggle - disabled for current user -->
                          {#if user.id !== currentUser?.id}
                            <button
                              class="btn text-xs {user.is_admin ? 'btn-danger' : 'btn-secondary'}"
                              on:click={() => updateUserRoles(user.id, { is_admin: !user.is_admin })}
                            >
                              {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                            </button>
                            
                            <!-- Delete User -->
                            <button
                              class="btn text-xs bg-red-600 text-white hover:bg-red-700"
                              on:click={() => openDeleteUserModal(user)}
                            >
                              Delete User
                            </button>
                          {:else}
                            <button
                              class="btn text-xs btn-secondary opacity-50 cursor-not-allowed"
                              disabled
                              title="Cannot modify your own admin permissions"
                            >
                              Admin (Self)
                            </button>
                          {/if}
                        </div>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Summary Stats -->
        <div class="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div class="card p-4">
            <div class="text-2xl font-bold text-gray-900">{users.length}</div>
            <div class="text-sm text-gray-500">Total Users</div>
          </div>
          <div class="card p-4">
            <div class="text-2xl font-bold text-purple-600">{users.filter(u => u.is_admin).length}</div>
            <div class="text-sm text-gray-500">Admins</div>
          </div>
          <div class="card p-4">
            <div class="text-2xl font-bold text-blue-600">{users.filter(u => u.is_lead).length}</div>
            <div class="text-sm text-gray-500">Leads</div>
          </div>
          <div class="card p-4">
            <div class="text-2xl font-bold text-green-600">{users.filter(u => u.is_coach).length}</div>
            <div class="text-sm text-gray-500">Coaches</div>
          </div>
        </div>
      {/if}

      <!-- Database Management Section -->
      <div class="mt-12 pt-8 border-t border-gray-200">
        <div class="mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Database Management</h2>
          <p class="text-gray-600">Manage database status and backups. Change active database file.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Left Column: Status & Backups -->
          <div class="space-y-6">
            <!-- Database Status -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Database Status</h3>
                <button class="btn-secondary btn-sm" on:click={loadDbStatus} disabled={isLoadingDbStatus}>
                  {#if isLoadingDbStatus}
                    <span class="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" role="status" aria-label="loading"></span> Refreshing...
                  {:else}
                    Refresh
                  {/if}
                </button>
              </div>
              <div class="card-body">
                {#if dbStatus && !dbStatus.error}
                  <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt class="font-medium text-gray-500">Status:</dt>
                    <dd class="text-gray-900">
                      <span class="badge {dbStatus.status === 'healthy' ? 'badge-success' : 'badge-danger'}">
                        {dbStatus.status}
                      </span>
                    </dd>
                    <dt class="font-medium text-gray-500">Path:</dt>
                    <dd class="text-gray-900 truncate" title={dbStatus.path}>{dbStatus.path}</dd>
                    <dt class="font-medium text-gray-500">Size:</dt>
                    <dd class="text-gray-900">{formatBytes(dbStatus.size)}</dd>
                    <dt class="font-medium text-gray-500">Last Modified:</dt>
                    <dd class="text-gray-900">{dbStatus.lastModified ? new Date(dbStatus.lastModified).toLocaleString() : 'N/A'}</dd>
                  </dl>
                {:else if isLoadingDbStatus}
                   <p class="text-gray-500">Loading status...</p>
                {:else}
                  <p class="text-red-500">Error: {dbStatus?.error || 'Could not load database status.'}</p>
                {/if}
              </div>
            </div>

            <!-- Database Backups -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Database Backups</h3>
                <div class="space-x-2">
                    <button class="btn-secondary btn-sm" on:click={loadDbBackups} disabled={isLoadingDbBackups}>
                      {#if isLoadingDbBackups}
                        <span class="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" role="status" aria-label="loading"></span> Refreshing...
                      {:else}
                        Refresh
                      {/if}
                    </button>
                    <button class="btn-primary btn-sm" on:click={createDbBackup} disabled={isLoadingDbBackups}>
                        Create Backup
                    </button>
                </div>
              </div>
              <div class="card-body">
                {#if isLoadingDbBackups}
                  <p class="text-gray-500">Loading backups...</p>
                {:else if dbBackups.length > 0}
                  <ul class="divide-y divide-gray-200 max-h-60 overflow-y-auto">
                    {#each dbBackups as backup (backup.filename)}
                      <li class="py-3">
                        <div class="flex justify-between items-center text-sm">
                          <div>
                            <p class="font-medium text-gray-900">{backup.filename}</p>
                            <p class="text-gray-500 text-xs">Created: {new Date(backup.created).toLocaleString()}</p>
                          </div>
                          <span class="text-gray-700">{formatBytes(backup.size)}</span>
                        </div>
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p class="text-gray-500">No backups found. (Ensure 'backups' directory exists in backend root).</p>
                {/if}
              </div>
            </div>
          </div>

          <!-- Right Column: Change DB Path -->
          <div class="space-y-6">
            <!-- Change Database File -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Change Active Database</h3>
              </div>
              <div class="card-body">
                <p class="text-sm text-gray-600 mb-3">
                  Enter the path to a new SQLite database file. The path can be absolute or relative to the backend server root.
                  The application will attempt to connect to this new database.
                </p>
                <div class="mb-3">
                  <label for="newDbPath" class="block text-sm font-medium text-gray-700 mb-1">New Database Path (.db)</label>
                  <input 
                    type="text" 
                    id="newDbPath"
                    bind:value={newDbPathInput}
                    class="input"
                    placeholder="e.g., /path/to/your/new_database.db or ../data/another.db"
                  />
                </div>
                <button 
                  class="btn-primary w-full" 
                  on:click={handleChangeDbPath}
                  disabled={isLoadingChangeDb || !newDbPathInput.trim()}
                >
                  {#if isLoadingChangeDb}
                    <span class="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" role="status" aria-label="loading"></span> Changing...
                  {:else}
                    Change Database
                  {/if}
                </button>
                <p class="text-xs text-gray-500 mt-2">
                  Changing the database will restart the connection. Ensure the path is correct and the file exists and is accessible by the server.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Delete User Modal -->
{#if showDeleteUserModal && selectedUser}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <div class="mt-3">
        <h3 class="text-lg font-medium text-red-900 mb-4">Delete User: {selectedUser.name}</h3>
        
        <div class="mb-4">
          <p class="text-sm text-gray-700 mb-4">
            This will permanently delete the user ({selectedUser.email}). 
            The user will no longer be able to access the system and will be removed from all lists.
          </p>
          <p class="text-sm font-medium text-gray-900 mb-2">
            Type <span class="font-bold text-red-600">DELETE</span> to confirm:
          </p>
          <input 
            type="text" 
            bind:value={deleteConfirmText}
            placeholder="Type DELETE to confirm"
            class="input"
          />
        </div>
        
        <div class="flex justify-end space-x-3">
          <button 
            type="button" 
            on:click={() => showDeleteUserModal = false}
            class="btn-secondary"
          >
            Cancel
          </button>
          <button 
            on:click={deleteUser}
            class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
            disabled={deleteConfirmText !== 'DELETE'}
          >
            Delete User
          </button>
        </div>
      </div>
    </div>
  </div>
{/if} 