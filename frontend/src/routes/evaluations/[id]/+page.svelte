<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { toastStore } from '$lib/stores/toast';
  import apiService from '$lib/api';
  import type { Evaluation, CaseEvaluation } from '$lib/types';
  import { authStore } from '$lib/stores/auth';

  let user: any = null;

  // Subscribe to auth store to get user
  authStore.subscribe((auth) => {
    user = auth.user;
  });
  let evaluation: Evaluation | null = null;
  let isLoading = false;
  let isEditing = false;
  let showAddCaseModal = false;
  let showDeleteEvaluationModal = false;
  let showDuplicateWarning = false;
  let duplicateInfo: any = null;
  let newCase = {
    case_id: '',
    kb_potential: false,
    article_linked: false,
    article_improved: false,
    improvement_opportunity: false,
    article_created: false,
    create_opportunity: false,
    relevant_link: false,
    notes: ''
  };

  // Get evaluation ID from URL
  $: evaluationId = parseInt($page.params.id);

  onMount(() => {
    if (evaluationId) {
      loadEvaluation();
    }
  });

  async function loadEvaluation() {
    try {
      isLoading = true;
      const response = await apiService.getEvaluationById(evaluationId);
      evaluation = response.evaluation;
    } catch (error: any) {
      console.error('Error loading evaluation:', error);
      const errorMessage = error.response?.data?.error || 'Failed to load evaluation';
      toastStore.add({ type: 'error', message: errorMessage });
      
      // If access denied, redirect to evaluations list
      if (error.response?.status === 403) {
        goto('/evaluations');
      }
    } finally {
      isLoading = false;
    }
  }

  async function updateCase(caseEvaluation: CaseEvaluation, field: string, value: any) {
    try {
      const updateData = { [field]: value };
      await apiService.updateCaseEvaluation(caseEvaluation.id, updateData);
      
      // Update local state
      if (evaluation?.cases) {
        const caseIndex = evaluation.cases.findIndex(c => c.id === caseEvaluation.id);
        if (caseIndex !== -1) {
          evaluation.cases[caseIndex] = { ...evaluation.cases[caseIndex], [field]: value };
        }
      }
      
      toastStore.add({ type: 'success', message: 'Case updated successfully' });
    } catch (error: any) {
      console.error('Error updating case:', error);
      const errorMessage = error.response?.data?.error || 'Failed to update case';
      toastStore.add({ type: 'error', message: errorMessage });
    }
  }

  function canEdit(): boolean {
    if (!user || !evaluation) return false;
    
    // Admin can edit everything
    if (user.is_admin) return true;
    
    // Coach can edit their own evaluations
    if (user.is_coach && evaluation.coach_user_id === user.id) return true;
    
    return false;
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function getBooleanDisplay(value: boolean | null): string {
    if (value === null || value === undefined) return 'N/A';
    return value ? 'Yes' : 'No';
  }

  function getBooleanClass(value: boolean | null): string {
    if (value === null || value === undefined) return 'text-gray-500';
    return value ? 'text-green-600' : 'text-red-600';
  }

  async function addCase() {
    try {
      if (!newCase.case_id) {
        toastStore.add({ type: 'warning', message: 'Please enter a case ID' });
        return;
      }

      // Check if case ID already exists
      const checkResult = await checkCaseId(newCase.case_id);
      if (checkResult.exists) {
        // Show duplicate warning instead of proceeding
        duplicateInfo = checkResult.evaluation;
        showDuplicateWarning = true;
        return;
      }

      await proceedWithAddCase();
    } catch (error: any) {
      console.error('Error adding case:', error);
      const errorMessage = error.response?.data?.error || 'Failed to add case';
      toastStore.add({ type: 'error', message: errorMessage });
    }
  }

  async function checkCaseId(caseId: string): Promise<{ exists: boolean; evaluation?: any }> {
    try {
      return await apiService.checkCaseIdExists(caseId);
    } catch (error: any) {
      console.error('Error checking case ID:', error);
      // If check fails, allow proceeding (don't block on check failure)
      return { exists: false };
    }
  }

  async function proceedWithAddCase() {
    try {
      await apiService.addCaseToEvaluation(evaluationId, newCase);
      showAddCaseModal = false;
      showDuplicateWarning = false;
      duplicateInfo = null;
      newCase = {
        case_id: '',
        kb_potential: false,
        article_linked: false,
        article_improved: false,
        improvement_opportunity: false,
        article_created: false,
        create_opportunity: false,
        relevant_link: false,
        notes: ''
      };
      toastStore.add({ type: 'success', message: 'Case added successfully' });
      await loadEvaluation();
    } catch (error: any) {
      console.error('Error adding case:', error);
      const errorMessage = error.response?.data?.error || 'Failed to add case';
      toastStore.add({ type: 'error', message: errorMessage });
    }
  }

  function cancelAddCase() {
    showAddCaseModal = false;
    showDuplicateWarning = false;
    duplicateInfo = null;
    newCase = {
      case_id: '',
      kb_potential: false,
      article_linked: false,
      article_improved: false,
      improvement_opportunity: false,
      article_created: false,
      create_opportunity: false,
      relevant_link: false,
      notes: ''
    };
  }

  async function deleteCase(caseEvaluation: CaseEvaluation) {
    if (!confirm(`Are you sure you want to delete Case #${caseEvaluation.case_number}? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiService.deleteCaseEvaluation(caseEvaluation.id);
      toastStore.add({ type: 'success', message: 'Case deleted successfully' });
      await loadEvaluation(); // Reload to update the list
    } catch (error: any) {
      console.error('Error deleting case:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete case';
      toastStore.add({ type: 'error', message: errorMessage });
    }
  }

  // Calculate statistics
  $: stats = evaluation?.cases ? {
    totalCases: evaluation.cases.length,
    linkedCases: evaluation.cases.filter(c => c.article_linked).length,
    relevantLinkedCases: evaluation.cases.filter(c => c.article_linked && c.relevant_link).length,
    improvementOpportunities: evaluation.cases.filter(c => c.improvement_opportunity).length,
    linkRate: evaluation.cases.length > 0 ? (evaluation.cases.filter(c => c.article_linked).length / evaluation.cases.length * 100) : 0,
    accuracyRate: evaluation.cases.filter(c => c.article_linked).length > 0 ? (evaluation.cases.filter(c => c.article_linked && c.relevant_link).length / evaluation.cases.filter(c => c.article_linked).length * 100) : 0,
    contributionRate: evaluation.cases.length > 0 ? (evaluation.cases.filter(c => c.improvement_opportunity).length / evaluation.cases.length * 100) : 0
  } : null;

  async function deleteEvaluation() {
    try {
      if (!evaluation) return;

      await apiService.deleteEvaluation(evaluation.id);
      toastStore.add({ type: 'success', message: 'Evaluation deleted successfully' });
      
      // Redirect to evaluations list
      goto('/evaluations');
    } catch (error: any) {
      console.error('Error deleting evaluation:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete evaluation';
      toastStore.add({ type: 'error', message: errorMessage });
    } finally {
      showDeleteEvaluationModal = false;
    }
  }
</script>

<svelte:head>
  <title>Evaluation Details - KCS Portal</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="flex justify-between items-center mb-6">
    <div class="flex items-center gap-4">
      <button
        on:click={() => goto('/evaluations')}
        class="text-blue-600 hover:text-blue-800 flex items-center gap-2"
      >
        ← Back to Evaluations
      </button>
      <h1 class="text-3xl font-bold text-gray-900">Evaluation Details</h1>
    </div>
    
    {#if canEdit()}
      <div class="flex gap-2">
        <button
          on:click={() => isEditing = !isEditing}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {isEditing ? 'Save' : 'Edit Mode'}
        </button>
        
        <button
          on:click={() => showDeleteEvaluationModal = true}
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Delete Evaluation
        </button>
      </div>
    {/if}
  </div>

  {#if isLoading}
    <div class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  {:else if !evaluation}
    <div class="text-center py-8 text-gray-500">
      Evaluation not found or access denied.
    </div>
  {:else}
    <!-- Evaluation Info -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">Evaluation Information</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Engineer</label>
          <p class="text-lg font-semibold text-gray-900">{evaluation.engineer_name}</p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700">Coach</label>
          <p class="text-lg text-gray-900">{evaluation.coach_name}</p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700">Evaluated Month</label>
          <p class="text-lg text-gray-900">{formatDate(evaluation.evaluation_date)}</p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700">Total Cases</label>
          <p class="text-lg text-gray-900">{evaluation.cases?.length || 0}</p>
        </div>
      </div>
    </div>

    <!-- Statistics Dashboard -->
    {#if stats && stats.totalCases > 0}
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">Performance Metrics</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Link Rate -->
          <div class="text-center">
            <div class="text-3xl font-bold text-blue-600">{stats.linkRate.toFixed(1)}%</div>
            <div class="text-sm text-gray-600">Link Rate</div>
            <div class="text-xs text-gray-500">{stats.linkedCases} of {stats.totalCases} cases linked</div>
          </div>
          
          <!-- Accuracy Rate -->
          <div class="text-center">
            <div class="text-3xl font-bold text-green-600">{stats.accuracyRate.toFixed(1)}%</div>
            <div class="text-sm text-gray-600">Accuracy Rate</div>
            <div class="text-xs text-gray-500">{stats.relevantLinkedCases} of {stats.linkedCases} linked cases relevant</div>
          </div>
          
          <!-- Contribution Rate -->
          <div class="text-center">
            <div class="text-3xl font-bold text-purple-600">{stats.contributionRate.toFixed(1)}%</div>
            <div class="text-sm text-gray-600">Contribution Rate</div>
            <div class="text-xs text-gray-500">{stats.improvementOpportunities} of {stats.totalCases} cases with improvement opportunities</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Cases -->
    <div class="bg-white rounded-lg shadow-md overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 class="text-xl font-semibold">Case Evaluations</h2>
          {#if isEditing}
            <p class="text-sm text-gray-600 mt-1">Click on checkboxes to toggle values. Enter case IDs and notes as needed.</p>
          {/if}
        </div>
        
        {#if canEdit()}
          <button
            on:click={() => showAddCaseModal = true}
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Add Case
          </button>
        {/if}
      </div>

      {#if !evaluation.cases || evaluation.cases.length === 0}
        <div class="text-center py-8 text-gray-500">
          No cases found for this evaluation.
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Case #
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Case ID
                </th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  KB Potential
                </th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Article Linked
                </th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Article Improved
                </th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Improvement Opp.
                </th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Article Created
                </th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Create Opp.
                </th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Relevant Link
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-48">
                  Notes
                </th>
                {#if isEditing && canEdit()}
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                {/if}
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each evaluation.cases as caseEval}
                <tr class="hover:bg-gray-50">
                  <!-- Case Number -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {caseEval.case_number}
                    </div>
                  </td>

                  <!-- Case ID -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    {#if isEditing && canEdit()}
                      <input
                        type="text"
                        value={caseEval.case_id || ''}
                        on:blur={(e) => updateCase(caseEval, 'case_id', e.target.value)}
                        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter case ID"
                      />
                    {:else}
                      <div class="text-sm text-gray-900">
                        {caseEval.case_id || '-'}
                      </div>
                    {/if}
                  </td>

                  <!-- KB Potential -->
                  <td class="px-4 py-4 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      checked={caseEval.kb_potential || false}
                      on:change={(e) => updateCase(caseEval, 'kb_potential', e.target.checked)}
                      disabled={!isEditing || !canEdit()}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded {!isEditing || !canEdit() ? 'opacity-75' : ''}"
                    />
                  </td>

                  <!-- Article Linked -->
                  <td class="px-4 py-4 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      checked={caseEval.article_linked || false}
                      on:change={(e) => updateCase(caseEval, 'article_linked', e.target.checked)}
                      disabled={!isEditing || !canEdit()}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded {!isEditing || !canEdit() ? 'opacity-75' : ''}"
                    />
                  </td>

                  <!-- Article Improved -->
                  <td class="px-4 py-4 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      checked={caseEval.article_improved || false}
                      on:change={(e) => updateCase(caseEval, 'article_improved', e.target.checked)}
                      disabled={!isEditing || !canEdit()}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded {!isEditing || !canEdit() ? 'opacity-75' : ''}"
                    />
                  </td>

                  <!-- Improvement Opportunity -->
                  <td class="px-4 py-4 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      checked={caseEval.improvement_opportunity || false}
                      on:change={(e) => updateCase(caseEval, 'improvement_opportunity', e.target.checked)}
                      disabled={!isEditing || !canEdit()}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded {!isEditing || !canEdit() ? 'opacity-75' : ''}"
                    />
                  </td>

                  <!-- Article Created -->
                  <td class="px-4 py-4 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      checked={caseEval.article_created || false}
                      on:change={(e) => updateCase(caseEval, 'article_created', e.target.checked)}
                      disabled={!isEditing || !canEdit()}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded {!isEditing || !canEdit() ? 'opacity-75' : ''}"
                    />
                  </td>

                  <!-- Create Opportunity -->
                  <td class="px-4 py-4 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      checked={caseEval.create_opportunity || false}
                      on:change={(e) => updateCase(caseEval, 'create_opportunity', e.target.checked)}
                      disabled={!isEditing || !canEdit()}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded {!isEditing || !canEdit() ? 'opacity-75' : ''}"
                    />
                  </td>

                  <!-- Relevant Link -->
                  <td class="px-4 py-4 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      checked={caseEval.relevant_link || false}
                      on:change={(e) => updateCase(caseEval, 'relevant_link', e.target.checked)}
                      disabled={!isEditing || !canEdit()}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded {!isEditing || !canEdit() ? 'opacity-75' : ''}"
                    />
                  </td>

                  <!-- Notes -->
                  <td class="px-6 py-4">
                    {#if isEditing && canEdit()}
                      <textarea
                        value={caseEval.notes || ''}
                        on:blur={(e) => updateCase(caseEval, 'notes', e.target.value)}
                        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows="2"
                        placeholder="Enter notes"
                      ></textarea>
                    {:else}
                      <div class="text-sm text-gray-900 max-w-xs">
                        {caseEval.notes || '-'}
                      </div>
                    {/if}
                  </td>

                  <!-- Actions -->
                  {#if isEditing && canEdit()}
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        on:click={() => deleteCase(caseEval)}
                        class="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Add Case Modal -->
{#if showAddCaseModal}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <div class="mt-3">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Add New Case</h3>
        
        <div class="mb-4">
          <label for="case-id" class="block text-sm font-medium text-gray-700 mb-1">
            Case ID *
          </label>
          <input
            id="case-id"
            type="text"
            bind:value={newCase.case_id}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter unique case ID"
            required
          />
          <p class="text-xs text-gray-500 mt-1">Case number will be automatically assigned</p>
        </div>

        <div class="mb-4">
          <label for="case-notes" class="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="case-notes"
            bind:value={newCase.notes}
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter notes"
          ></textarea>
        </div>

        <div class="flex justify-end gap-2">
          <button
            on:click={cancelAddCase}
            class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            on:click={addCase}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Case
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Duplicate Case Warning Modal -->
{#if showDuplicateWarning && duplicateInfo}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <div class="mt-3">
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
          <svg class="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <h3 class="text-lg font-medium text-gray-900 mb-4 text-center">Case Already Exists</h3>
        
        <div class="mb-4 p-4 bg-yellow-50 rounded-lg">
          <p class="text-sm text-gray-700 mb-2">
            <strong>Case ID "{newCase.case_id}"</strong> already exists in another evaluation:
          </p>
          <ul class="text-sm text-gray-600 space-y-1">
            <li><strong>Engineer:</strong> {duplicateInfo.engineer_name}</li>
            <li><strong>Coach:</strong> {duplicateInfo.coach_name}</li>
            <li><strong>Evaluation Date:</strong> {formatDate(duplicateInfo.evaluation_date)}</li>
          </ul>
        </div>

        <p class="text-sm text-gray-600 mb-4">
          Do you still want to add this case? This will create a duplicate case ID across evaluations.
        </p>

        <div class="flex justify-end gap-2">
          <button
            on:click={cancelAddCase}
            class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            on:click={proceedWithAddCase}
            class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Add Anyway
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Evaluation Modal -->
{#if showDeleteEvaluationModal && evaluation}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <div class="mt-3">
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v1M4 7h16" />
          </svg>
        </div>
        
        <h3 class="text-lg font-medium text-gray-900 mb-4 text-center">Delete Evaluation</h3>
        
        <div class="mb-4 p-4 bg-red-50 rounded-lg">
          <p class="text-sm text-gray-700 mb-2">
            <strong>Are you sure you want to delete this evaluation?</strong>
          </p>
          <ul class="text-sm text-gray-600 space-y-1">
            <li><strong>Engineer:</strong> {evaluation.engineer_name}</li>
            <li><strong>Coach:</strong> {evaluation.coach_name}</li>
            <li><strong>Evaluation Date:</strong> {formatDate(evaluation.evaluation_date)}</li>
            <li><strong>Total Cases:</strong> {evaluation.cases?.length || 0}</li>
          </ul>
        </div>

        <p class="text-sm text-gray-600 mb-4">
          This action cannot be undone. The evaluation and all its case data will be permanently removed from the system.
        </p>

        <div class="flex justify-end gap-2">
          <button
            on:click={() => showDeleteEvaluationModal = false}
            class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            on:click={deleteEvaluation}
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete Evaluation
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Custom styles if needed */
</style> 