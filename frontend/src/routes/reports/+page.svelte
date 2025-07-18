<script lang="ts">
  export const ssr = false;
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { browser } from '$app/environment';
  import { reportStore, selectedEngineers } from '$lib/stores/reports';
  import ReportFilters from '$lib/components/ReportFilters.svelte';
  import ReportSummary from '$lib/components/ReportSummary.svelte';
  import EngineerStats from '$lib/components/EngineerStats.svelte';
  import type { User } from '$lib/types';

  let user: User | null = null;

  onMount(() => {
    const unsubscribeAuth = authStore.subscribe((auth) => {
      if (!auth.isAuthenticated && !auth.isLoading) {
        goto('/login');
      } else if (auth.isAuthenticated) {
        if (!user) {
          user = auth.user;
          reportStore.init();
          reportStore.loadEngineers();
          reportStore.loadQuickFilterEngineers(
            user.id,
            user.is_lead,
            user.is_coach,
            user.is_manager
          );
          if (browser) {
            const unsubReport = reportStore.subscribe((state) => {
              if (state.engineers.length > 0) {
                const url = new URL(window.location.href);
                const { filters, engineerIds } = reportStore.parseUrlParams(url);
                if (Object.keys(filters).length > 0 || engineerIds.length > 0) {
                  reportStore.generateReport();
                }
                unsubReport();
              }
            });
            window.addEventListener('popstate', (event) => {
              const url = new URL(window.location.href);
              reportStore.parseUrlParams(url);
              if (event.state?.reportGenerated || url.search) {
                reportStore.generateReport();
              }
            });
          }
        }
      }
    });
    return () => {
      unsubscribeAuth();
      reportStore.reset();
      window.removeEventListener('popstate', () => {});
    };
  });
</script>

{#if !user}
  <div class="container mx-auto px-4 py-8">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900">Please log in</h1>
      <p class="mt-2 text-gray-600">
        You need to be logged in to view this page.
      </p>
      <a href="/login" class="mt-4 inline-block btn-primary">Log In</a>
    </div>
  </div>
{:else}
  <div class="min-h-screen bg-gray-50">
    <div class="container mx-auto px-4 py-8">
      <div class="flex justify-between items-center mb-8">
        <div class="text-sm text-gray-500">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      <!-- Filters -->
      <ReportFilters user={user} />

      <!-- Summary -->
      {#if $reportStore.reportGenerated}
        <ReportSummary />

        <!-- Individual Engineer Stats -->
        {#each $selectedEngineers as engineer}
          <EngineerStats {engineer} />
        {/each}
      {/if}

      <!-- Error Display -->
      {#if $reportStore.error}
        <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                class="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">Error</h3>
              <div class="mt-2 text-sm text-red-700">
                <p>{$reportStore.error}</p>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(.card) {
    @apply bg-white rounded-lg shadow-md;
  }

  :global(.input) {
    @apply block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm;
  }

  :global(.btn-primary) {
    @apply inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500;
  }

  :global(.btn-secondary) {
    @apply inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500;
  }
</style>
