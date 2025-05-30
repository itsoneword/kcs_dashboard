<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import apiService from '$lib/api';
  import type { User, DashboardOverview } from '$lib/types';

  let user: User | null = null;
  let isLoading = true;
  let overview: DashboardOverview | null = null;
  let lastLoadTime: number = 0;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  onMount(() => {
    const unsubscribe = authStore.subscribe((auth) => {
      if (!auth.isAuthenticated && !auth.isLoading) {
        goto('/login');
      } else if (auth.isAuthenticated) {
        user = auth.user;
        loadDashboardData();
      }
    });

    return unsubscribe;
  });

  async function loadDashboardData() {
    // Check if we have cached data that's still fresh
    const now = Date.now();
    if (overview && (now - lastLoadTime) < CACHE_DURATION) {
      return; // Use cached data
    }

    try {
      isLoading = true;
      const response = await apiService.getDashboardOverview();
      overview = response.overview;
      lastLoadTime = now;
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      isLoading = false;
    }
  }

  async function handleLogout() {
    await authStore.logout();
    goto('/login');
  }

  function getUserRoles(user: User): string[] {
    const roles: string[] = [];
    if (user.is_admin) roles.push('Admin');
    if (user.is_lead) roles.push('Lead');
    if (user.is_coach) roles.push('Coach');
    return roles.length > 0 ? roles : ['User'];
  }
</script>

<svelte:head>
  <title>Dashboard - KCS Portal</title>
</svelte:head>

{#if isLoading}
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading dashboard...</p>
    </div>
  </div>
{:else if user}
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation Header -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-semibold text-gray-900">KCS Performance Portal</h1>
          </div>
          
          <div class="flex items-center space-x-4">
            <div class="text-sm text-gray-700">
              Welcome, <span class="font-medium">{user.name}</span>
            </div>
            
            <div class="flex space-x-1">
              {#each getUserRoles(user) as role}
                <span class="badge badge-{role.toLowerCase()}">{role}</span>
              {/each}
            </div>
            
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
        
        <!-- Welcome Section -->
        <div class="card p-6 mb-6">
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Welcome to KCS Portal</h2>
          <p class="text-gray-600">
            Knowledge-Centered Service Performance Tracking System
          </p>
        </div>

        <!-- Role-based Navigation Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {#if user.is_admin}
            <a href="/admin" class="card p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                </div>
                <div class="ml-4">
                  <h3 class="text-lg font-medium text-gray-900">Admin Console</h3>
                  <p class="text-sm text-gray-500">Manage users and system settings</p>
                </div>
              </div>
            </a>
          {/if}

          {#if user.is_lead}
            <a href="/lead" class="card p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div class="ml-4">
                  <h3 class="text-lg font-medium text-gray-900">Team Management</h3>
                  <p class="text-sm text-gray-500">Manage engineers and assignments</p>
                </div>
              </div>
            </a>
          {/if}

          <!-- Evaluations (available to all authenticated users) -->
          <a href="/evaluations" class="card p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-medium text-gray-900">Evaluations</h3>
                <p class="text-sm text-gray-500">View and manage evaluations</p>
              </div>
            </div>
          </a>

          <!-- Reports (available to all roles) -->
          <a href="/reports" class="card p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-medium text-gray-900">Reports</h3>
                <p class="text-sm text-gray-500">View performance statistics</p>
              </div>
            </div>
          </a>
        </div>

        <!-- Quick Stats Section -->
        <div class="mt-8">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Quick Overview</h3>
          {#if overview}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div class="card p-4">
                <div class="text-2xl font-bold text-primary-600">{overview.total_evaluations}</div>
                <div class="text-sm text-gray-500">Total Evaluations</div>
              </div>
              <div class="card p-4">
                <div class="text-2xl font-bold text-green-600">{overview.this_month_evaluations}</div>
                <div class="text-sm text-gray-500">{overview.current_month}</div>
              </div>
              <div class="card p-4">
                <div class="text-2xl font-bold text-blue-600">{overview.total_engineers}</div>
                <div class="text-sm text-gray-500">Engineers</div>
              </div>
              <div class="card p-4">
                <div class="text-2xl font-bold text-purple-600">{overview.total_coaches}</div>
                <div class="text-sm text-gray-500">Coaches</div>
              </div>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div class="card p-4">
                <div class="text-2xl font-bold text-gray-400">...</div>
                <div class="text-sm text-gray-500">Total Evaluations</div>
              </div>
              <div class="card p-4">
                <div class="text-2xl font-bold text-gray-400">...</div>
                <div class="text-sm text-gray-500">This Month</div>
              </div>
              <div class="card p-4">
                <div class="text-2xl font-bold text-gray-400">...</div>
                <div class="text-sm text-gray-500">Engineers</div>
              </div>
              <div class="card p-4">
                <div class="text-2xl font-bold text-gray-400">...</div>
                <div class="text-sm text-gray-500">Coaches</div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if} 