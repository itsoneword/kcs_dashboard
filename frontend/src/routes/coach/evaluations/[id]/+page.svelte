<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import apiService from '$lib/api';
  import type { User, Evaluation, CaseEvaluation, UpdateCaseEvaluationRequest } from '$lib/types';

  let user: User | null = null;
  let evaluation: Evaluation | null = null;
  let isLoading = true;
  let isSaving = false;
  let saveMessage = '';
  let evaluationId: number;

  // Track changes for auto-save
  let pendingChanges: Map<number, UpdateCaseEvaluationRequest> = new Map();
  let saveTimeout: NodeJS.Timeout | null = null;

  onMount(() => {
    evaluationId = parseInt($page.params.id);
    
    const unsubscribe = authStore.subscribe((auth) => {
      if (!auth.isAuthenticated && !auth.isLoading) {
        goto('/login');
      } else if (auth.isAuthenticated) {
        user = auth.user;
        if (!user?.is_coach && !user?.is_admin) {
          goto('/dashboard');
        } else {
          loadEvaluation();
        }
      }
    });

    return unsubscribe;
  });

  async function loadEvaluation() {
    try {
      isLoading = true;
      const response = await apiService.getEvaluationById(evaluationId);
      evaluation = response.evaluation;
    } catch (error) {
      console.error('Error loading evaluation:', error);
      alert('Failed to load evaluation');
      goto('/coach');
    } finally {
      isLoading = false;
    }
  }

  function updateCase(caseEval: CaseEvaluation, field: keyof UpdateCaseEvaluationRequest, value: any) {
    if (!evaluation) return;

    // Update the local state immediately
    const caseIndex = evaluation.cases?.findIndex(c => c.id === caseEval.id);
    if (caseIndex !== undefined && caseIndex >= 0 && evaluation.cases) {
      evaluation.cases[caseIndex] = { ...evaluation.cases[caseIndex], [field]: value };
    }

    // Track the change for auto-save
    const existingChanges = pendingChanges.get(caseEval.id) || {};
    pendingChanges.set(caseEval.id, { ...existingChanges, [field]: value });

    // Debounce the save
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      saveChanges();
    }, 1000); // Save after 1 second of no changes
  }

  async function saveChanges() {
    if (pendingChanges.size === 0) return;

    try {
      isSaving = true;
      saveMessage = 'Saving...';

      // Save all pending changes
      const savePromises = Array.from(pendingChanges.entries()).map(([caseId, changes]) =>
        apiService.updateCaseEvaluation(caseId, changes)
      );

      await Promise.all(savePromises);
      
      // Clear pending changes
      pendingChanges.clear();
      saveMessage = 'Saved';
      
      // Clear the message after 2 seconds
      setTimeout(() => {
        saveMessage = '';
      }, 2000);
    } catch (error) {
      console.error('Error saving changes:', error);
      saveMessage = 'Error saving';
      setTimeout(() => {
        saveMessage = '';
      }, 3000);
    } finally {
      isSaving = false;
    }
  }

  async function addNewCase() {
    if (!evaluation?.cases) return;

    try {
      const newCaseNumber = Math.max(...evaluation.cases.map(c => c.case_number)) + 1;
      const response = await apiService.addCaseToEvaluation(evaluationId, {
        case_number: newCaseNumber
      });

      // Reload evaluation to get the new case
      await loadEvaluation();
    } catch (error) {
      console.error('Error adding new case:', error);
      alert('Failed to add new case');
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  function getQuarter(dateString: string): string {
    const month = new Date(dateString).getMonth() + 1;
    return `Q${Math.ceil(month / 3)}`;
  }

  // Helper function to check if a field should be disabled based on KCS logic
  function isFieldDisabled(caseEval: CaseEvaluation, field: string): boolean {
    switch (field) {
      case 'article_linked':
      case 'improvement_opportunity':
      case 'create_opportunity':
        return !caseEval.kb_potential;
      case 'relevant_link':
        return !caseEval.kb_potential || !caseEval.article_linked;
      case 'article_improved':
        return !caseEval.kb_potential || !caseEval.improvement_opportunity;
      case 'article_created':
        return !caseEval.kb_potential || !caseEval.create_opportunity;
      default:
        return false;
    }
  }

  async function handleLogout() {
    await authStore.logout();
    goto('/login');
  }
</script>

<svelte:head>
  <title>Evaluation Details - KCS Portal</title>
</svelte:head>

{#if isLoading}
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading evaluation...</p>
    </div>
  </div>
{:else if evaluation}
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center space-x-4">
            <a href="/coach" class="text-gray-600 hover:text-gray-900">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 class="text-xl font-semibold text-gray-900">Evaluation Details</h1>
          </div>
          
          <div class="flex items-center space-x-4">
            {#if saveMessage}
              <span class="text-sm {saveMessage === 'Saved' ? 'text-green-600' : saveMessage === 'Saving...' ? 'text-blue-600' : 'text-red-600'}">
                {saveMessage}
              </span>
            {/if}
            <span class="text-sm text-gray-700">Welcome, {user?.name}</span>
            <span class="badge badge-coach">Coach</span>
            <button on:click={handleLogout} class="btn-secondary text-sm">Logout</button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        
        <!-- Evaluation Header -->
        <div class="card p-6 mb-6">
          <div class="flex justify-between items-start">
            <div>
              <h2 class="text-2xl font-bold text-gray-900">{evaluation.engineer_name}</h2>
              <p class="text-gray-600">Evaluation for {formatDate(evaluation.evaluation_date)} ({getQuarter(evaluation.evaluation_date)})</p>
              <p class="text-sm text-gray-500 mt-1">Coach: {evaluation.coach_name}</p>
            </div>
            <div class="text-right">
              <div class="text-sm text-gray-500">Created: {formatDate(evaluation.created_at)}</div>
              <div class="text-sm text-gray-500">Cases: {evaluation.cases?.length || 0}</div>
            </div>
          </div>
        </div>

        <!-- KCS Evaluation Criteria Info -->
        <div class="card p-6 mb-6 bg-blue-50 border-blue-200">
          <h3 class="text-lg font-medium text-blue-900 mb-3">KCS Evaluation Criteria</h3>
          <div class="text-sm text-blue-800 space-y-2">
            <p><strong>KB Potential:</strong> Whether case should have an article or not. If false, other fields are not required.</p>
            <p><strong>Article Linked:</strong> If an article is linked/used. Used for calculating link rate.</p>
            <p><strong>Relevant Link:</strong> If the linked article is correct. Used for link accuracy rate.</p>
            <p><strong>Improvement Opportunity:</strong> Activates Article Improved field.</p>
            <p><strong>Article Improved:</strong> Used for calculating contribution index. Only active if Improvement Opportunity is true.</p>
            <p><strong>Create Opportunity:</strong> Activates Article Created field.</p>
            <p><strong>Article Created:</strong> Used for calculating contribution index. Only active if Create Opportunity is true.</p>
          </div>
        </div>

        <!-- Cases List -->
        <div class="space-y-6">
          {#each evaluation.cases || [] as caseEval (caseEval.id)}
            <div class="card p-6">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-gray-900">Case #{caseEval.case_number}</h3>
                <div class="text-sm text-gray-500">
                  Case ID: {caseEval.case_id || 'Not specified'}
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Left Column -->
                <div class="space-y-4">
                  <!-- Case ID -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Case ID</label>
                    <input 
                      type="text" 
                      value={caseEval.case_id || ''} 
                      on:input={(e) => updateCase(caseEval, 'case_id', e.target.value)}
                      placeholder="Enter case ID from CRM"
                      class="input"
                    />
                  </div>

                  <!-- KB Potential -->
                  <div>
                    <label class="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={caseEval.kb_potential}
                        on:change={(e) => updateCase(caseEval, 'kb_potential', e.target.checked)}
                        class="checkbox"
                      />
                      <span class="text-sm font-medium text-gray-700">KB Potential</span>
                    </label>
                    <p class="text-xs text-gray-500 mt-1">Should this case have an article?</p>
                  </div>

                  <!-- Article Linked -->
                  <div>
                    <label class="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={caseEval.article_linked}
                        disabled={isFieldDisabled(caseEval, 'article_linked')}
                        on:change={(e) => updateCase(caseEval, 'article_linked', e.target.checked)}
                        class="checkbox"
                      />
                      <span class="text-sm font-medium text-gray-700">Article Linked</span>
                    </label>
                    <p class="text-xs text-gray-500 mt-1">Was an article linked/used?</p>
                  </div>

                  <!-- Relevant Link -->
                  <div>
                    <label class="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={caseEval.relevant_link}
                        disabled={isFieldDisabled(caseEval, 'relevant_link')}
                        on:change={(e) => updateCase(caseEval, 'relevant_link', e.target.checked)}
                        class="checkbox"
                      />
                      <span class="text-sm font-medium text-gray-700">Relevant Link</span>
                    </label>
                    <p class="text-xs text-gray-500 mt-1">Was the linked article correct/relevant?</p>
                  </div>
                </div>

                <!-- Right Column -->
                <div class="space-y-4">
                  <!-- Improvement Opportunity -->
                  <div>
                    <label class="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={caseEval.improvement_opportunity}
                        disabled={isFieldDisabled(caseEval, 'improvement_opportunity')}
                        on:change={(e) => updateCase(caseEval, 'improvement_opportunity', e.target.checked)}
                        class="checkbox"
                      />
                      <span class="text-sm font-medium text-gray-700">Improvement Opportunity</span>
                    </label>
                    <p class="text-xs text-gray-500 mt-1">Could an existing article be improved?</p>
                  </div>

                  <!-- Article Improved -->
                  <div>
                    <label class="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={caseEval.article_improved}
                        disabled={isFieldDisabled(caseEval, 'article_improved')}
                        on:change={(e) => updateCase(caseEval, 'article_improved', e.target.checked)}
                        class="checkbox"
                      />
                      <span class="text-sm font-medium text-gray-700">Article Improved</span>
                    </label>
                    <p class="text-xs text-gray-500 mt-1">Was an article actually improved?</p>
                  </div>

                  <!-- Create Opportunity -->
                  <div>
                    <label class="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={caseEval.create_opportunity}
                        disabled={isFieldDisabled(caseEval, 'create_opportunity')}
                        on:change={(e) => updateCase(caseEval, 'create_opportunity', e.target.checked)}
                        class="checkbox"
                      />
                      <span class="text-sm font-medium text-gray-700">Create Opportunity</span>
                    </label>
                    <p class="text-xs text-gray-500 mt-1">Should a new article be created?</p>
                  </div>

                  <!-- Article Created -->
                  <div>
                    <label class="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={caseEval.article_created}
                        disabled={isFieldDisabled(caseEval, 'article_created')}
                        on:change={(e) => updateCase(caseEval, 'article_created', e.target.checked)}
                        class="checkbox"
                      />
                      <span class="text-sm font-medium text-gray-700">Article Created</span>
                    </label>
                    <p class="text-xs text-gray-500 mt-1">Was a new article actually created?</p>
                  </div>
                </div>
              </div>

              <!-- Notes -->
              <div class="mt-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea 
                  value={caseEval.notes || ''} 
                  on:input={(e) => updateCase(caseEval, 'notes', e.target.value)}
                  placeholder="Add any additional notes about this case..."
                  rows="3"
                  class="input"
                ></textarea>
              </div>
            </div>
          {/each}

          <!-- Add New Case Button -->
          <div class="text-center">
            <button 
              on:click={addNewCase}
              class="btn-secondary"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add New Case
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <h2 class="text-xl font-semibold text-gray-900">Evaluation not found</h2>
      <p class="text-gray-600 mt-2">The evaluation you're looking for doesn't exist or you don't have permission to view it.</p>
      <a href="/coach" class="btn-primary mt-4">Back to Evaluations</a>
    </div>
  </div>
{/if} 