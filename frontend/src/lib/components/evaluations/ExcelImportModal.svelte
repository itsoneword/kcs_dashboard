<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { toastStore } from '$lib/stores/toast';
  import apiService from '$lib/api';
  import type { User, ExcelImportPreview, ExcelImportResult } from '$lib/types';

  export let show = false;
  export let user: User | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    success: void;
  }>();

  // Step management
  let currentStep: 'upload' | 'preview' | 'results' = 'upload';
  let isLoading = false;

  // Upload step data
  let selectedFile: File | null = null;
  let importYear = new Date().getFullYear();
  let importAsRole: 'coach' | 'admin' = 'coach';

  // Preview step data
  let preview: ExcelImportPreview | null = null;
  let coachSelections: Record<string, number> = {};
  let availableCoaches: User[] = [];

  // Results step data
  let importResult: ExcelImportResult | null = null;

  // Year options (current year and previous 2 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i);

  // File input element
  let fileInput: HTMLInputElement;

  function resetModal() {
    currentStep = 'upload';
    selectedFile = null;
    preview = null;
    coachSelections = {};
    importResult = null;
    isLoading = false;
    importYear = new Date().getFullYear();
    importAsRole = 'coach';
  }

  function handleClose() {
    resetModal();
    dispatch('close');
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
      ];
      
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xlsm)$/i)) {
        toastStore.add({ type: 'error', message: 'Please select a valid Excel file (.xlsx or .xlsm)' });
        return;
      }

      // Validate file size (2MB limit)
      if (file.size > 2 * 1024 * 1024) {
        toastStore.add({ type: 'error', message: 'File size must be less than 2MB' });
        return;
      }

      selectedFile = file;
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      toastStore.add({ type: 'warning', message: 'Please select a file first' });
      return;
    }

    try {
      isLoading = true;
      const response = await apiService.importExcelPreview(
        selectedFile,
        importYear,
        user?.is_admin ? importAsRole : undefined
      );

      preview = response.preview;
      
      // Load available coaches for admin selections
      if (importAsRole === 'admin') {
        await loadAvailableCoaches();
      }
      
      // Initialize coach selections based on role and hierarchy
      initializeCoachSelections();
      
      currentStep = 'preview';
      
      if (preview.errors.length > 0) {
        toastStore.add({ 
          type: 'warning', 
          message: `File parsed with ${preview.errors.length} warning(s). Please review.` 
        });
      } else {
        toastStore.add({ type: 'success', message: 'File parsed successfully!' });
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to parse Excel file';
      toastStore.add({ type: 'error', message: errorMessage });
    } finally {
      isLoading = false;
    }
  }

  async function loadAvailableCoaches() {
    try {
      const response = await apiService.getAllUsers();
      availableCoaches = response.users.filter(u => u.is_coach && !u.deleted_at);
      console.log('Available coaches loaded:', availableCoaches.length);
    } catch (error: any) {
      console.error('Failed to load coaches:', error);
      toastStore.add({ type: 'warning', message: 'Failed to load available coaches' });
    }
  }

  function initializeCoachSelections() {
    if (!preview || !user) return;

    coachSelections = {};
    
    // Handle conflicts based on role hierarchy: admin > coach > lead
    preview.conflicts.forEach(conflict => {
      if (importAsRole === 'admin') {
        // Admins can choose any action
        coachSelections[conflict.engineer_name] = 0; // Default to "select coach"
      } else if (user.is_coach) {
        // Coaches skip conflicts by default
        if (conflict.action === 'skip') {
          coachSelections[conflict.engineer_name] = -1; // Skip
        } else {
          coachSelections[conflict.engineer_name] = 0; // Select coach
        }
      }
    });

    // Handle missing coaches that need manual selection
    preview.missing_coaches.forEach(missing => {
      if (missing.suggested_action === 'manual_select') {
        coachSelections[missing.engineer_name] = 0; // Default to "select coach"
      }
    });
  }

  async function handleImport() {
    if (!selectedFile || !preview) return;

    try {
      isLoading = true;
      const response = await apiService.importExcelData(
        selectedFile,
        importYear,
        coachSelections,
        user?.is_admin ? importAsRole : undefined
      );

      importResult = response.result;
      currentStep = 'results';

      if (importResult.success) {
        toastStore.add({ type: 'success', message: 'Import completed successfully!' });
        dispatch('success');
      } else {
        toastStore.add({ 
          type: 'warning', 
          message: 'Import completed with errors. Please review the results.' 
        });
      }
    } catch (error: any) {
      console.error('Import error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Import failed';
      toastStore.add({ type: 'error', message: errorMessage });
    } finally {
      isLoading = false;
    }
  }

  function formatConflictAction(action: string): string {
    switch (action) {
      case 'skip': return 'Skip (keep current coach)';
      case 'reassign': return 'Reassign to Excel coach';
      case 'manual': return 'Manual selection required';
      default: return action;
    }
  }

  function canProceedFromPreview(): boolean {
    if (!preview) return false;
    
    // Block if there's a coach ownership warning
    if (preview.coach_ownership_warning) return false;
    
    // Check if all conflicts are resolved
    for (const conflict of preview.conflicts) {
      if (!(conflict.engineer_name in coachSelections) || coachSelections[conflict.engineer_name] === 0) {
        // Only block if manual selection is required and not selected
        if (conflict.action === 'manual') return false;
      }
    }
    
    // Check if all missing coaches that require manual selection are resolved
    for (const missing of preview.missing_coaches) {
      if (missing.suggested_action === 'manual_select') {
        if (!(missing.engineer_name in coachSelections) || coachSelections[missing.engineer_name] === 0) {
          return false;
        }
      }
    }
    
    return true;
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-4 mx-auto p-6 border w-full max-w-4xl shadow-lg rounded-md bg-white m-4">
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-semibold text-gray-900">
          Excel Import - 
          {#if currentStep === 'upload'}
            Upload File
          {:else if currentStep === 'preview'}
            Review Data
          {:else}
            Import Results
          {/if}
        </h3>
        <button
          on:click={handleClose}
          class="text-gray-400 hover:text-gray-600"
          disabled={isLoading}
        >
          ✕
        </button>
      </div>

      <!-- Progress indicator -->
      <div class="mb-6">
        <div class="flex items-center">
          <div class="flex items-center text-sm">
            <div class="flex items-center {currentStep === 'upload' ? 'text-blue-600' : 'text-green-600'}">
              <div class="w-6 h-6 rounded-full border-2 {currentStep === 'upload' ? 'border-blue-600 bg-blue-100' : 'border-green-600 bg-green-100'} flex items-center justify-center mr-2">
                {#if currentStep === 'upload'}
                  1
                {:else}
                  ✓
                {/if}
              </div>
              Upload
            </div>
            <div class="mx-2 text-gray-300">→</div>
            <div class="flex items-center {currentStep === 'preview' ? 'text-blue-600' : currentStep === 'results' ? 'text-green-600' : 'text-gray-400'}">
              <div class="w-6 h-6 rounded-full border-2 {currentStep === 'preview' ? 'border-blue-600 bg-blue-100' : currentStep === 'results' ? 'border-green-600 bg-green-100' : 'border-gray-300'} flex items-center justify-center mr-2">
                {#if currentStep === 'preview'}
                  2
                {:else if currentStep === 'results'}
                  ✓
                {:else}
                  2
                {/if}
              </div>
              Preview
            </div>
            <div class="mx-2 text-gray-300">→</div>
            <div class="flex items-center {currentStep === 'results' ? 'text-blue-600' : 'text-gray-400'}">
              <div class="w-6 h-6 rounded-full border-2 {currentStep === 'results' ? 'border-blue-600 bg-blue-100' : 'border-gray-300'} flex items-center justify-center mr-2">
                3
              </div>
              Import
            </div>
          </div>
        </div>
      </div>

      <!-- Upload Step -->
      {#if currentStep === 'upload'}
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Excel File (.xlsx, .xlsm) *
            </label>
            <input
              bind:this={fileInput}
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
              on:change={handleFileSelect}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            {#if selectedFile}
              <p class="text-sm text-gray-600 mt-2">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            {/if}
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Import Year *
              </label>
              <select
                bind:value={importYear}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              >
                {#each yearOptions as year}
                  <option value={year}>{year}</option>
                {/each}
              </select>
            </div>

            {#if user?.is_admin}
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Import As Role
                </label>
                <select
                  bind:value={importAsRole}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="coach">Coach</option>
                  <option value="admin">Admin</option>
                </select>
                <p class="text-xs text-gray-500 mt-1">
                  Coach role skips conflicts, Admin allows reassignment
                </p>
              </div>
            {/if}
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 class="font-medium text-blue-900 mb-2">File Requirements:</h4>
            <ul class="text-sm text-blue-800 list-disc list-inside space-y-1">
              <li>First sheet is summary (will be skipped)</li>
              <li>Each sheet = engineer name (ignore "Engineer X" empty sheets)</li>
              <li>A1 contains quarter (Q1, Q2, Q3, Q4)</li>
              <li>Column B contains case numbers</li>
              <li>C2-I2 contain evaluation parameter names</li>
              <li>Column J contains month, Column K contains notes</li>
              <li>H1 may contain coach name, D1 may contain engineer name</li>
            </ul>
          </div>

          <div class="flex justify-end gap-2">
            <button
              on:click={handleClose}
              class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              on:click={handleUpload}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              disabled={!selectedFile || isLoading}
            >
              {#if isLoading}
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              {/if}
              Parse File
            </button>
          </div>
        </div>
      {/if}

      <!-- Preview Step -->
      {#if currentStep === 'preview' && preview}
        <div class="space-y-6">
          <!-- Coach Ownership Warning (blocking) -->
          {#if preview.coach_ownership_warning}
            <div class="bg-red-50 border border-red-200 rounded-md p-4">
              <h4 class="font-medium text-red-900 mb-2">⚠️ Import Blocked - Coach Ownership Conflict</h4>
              <div class="text-sm text-red-800">
                <p class="mb-2">
                  This Excel file appears to belong to <strong>{preview.coach_ownership_warning.detected_coach}</strong>,
                  but you are logged in as <strong>{preview.coach_ownership_warning.importing_user}</strong>.
                </p>
                <p class="font-medium">
                  Only <strong>{preview.coach_ownership_warning.detected_coach}</strong> or an admin can import this file.
                </p>
                <p class="mt-2 text-red-600">
                  Please contact your administrator or ask {preview.coach_ownership_warning.detected_coach} to perform the import.
                </p>
              </div>
            </div>
          {:else}
            <!-- Summary -->
            <div class="bg-gray-50 rounded-lg p-4">
              <h4 class="font-medium mb-2">Import Summary</h4>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span class="text-gray-600">Engineers:</span>
                  <span class="font-medium ml-1">{preview.engineers.length}</span>
                </div>
                <div>
                  <span class="text-gray-600">Total Cases:</span>
                  <span class="font-medium ml-1">{preview.metadata.total_cases}</span>
                </div>
                <div>
                  <span class="text-gray-600">Quarters:</span>
                  <span class="font-medium ml-1">{preview.metadata.quarters_found.join(', ')}</span>
                </div>
                <div>
                  <span class="text-gray-600">Coach:</span>
                  <span class="font-medium ml-1">{preview.metadata.coach_name || 'Various'}</span>
                </div>
              </div>
            </div>

            <!-- Missing Coaches -->
            {#if preview.missing_coaches.length > 0}
              <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 class="font-medium text-blue-900 mb-2">Coach Assignment Information ({preview.missing_coaches.length})</h4>
                <div class="space-y-2">
                  {#each preview.missing_coaches as missing}
                    <div class="flex items-center justify-between bg-white p-3 rounded border">
                      <div class="flex-1">
                        <div class="font-medium">{missing.engineer_name}</div>
                        <div class="text-sm text-gray-600">
                          {#if missing.excel_coach_name}
                            Excel coach "{missing.excel_coach_name}" not found in database
                          {:else}
                            No coach specified in Excel
                          {/if}
                        </div>
                      </div>
                      <div class="ml-4">
                        {#if missing.suggested_action === 'manual_select' && importAsRole === 'admin'}
                          <select
                            bind:value={coachSelections[missing.engineer_name]}
                            class="px-3 py-1 border border-gray-300 rounded text-sm min-w-[150px]"
                          >
                            <option value={0}>Select coach...</option>
                            {#each availableCoaches as coach}
                              <option value={coach.id}>{coach.name}</option>
                            {/each}
                          </select>
                        {:else}
                          <span class="text-sm px-2 py-1 bg-blue-100 rounded">
                            {#if missing.suggested_action === 'assign_to_importer'}
                              Will assign to you
                            {:else}
                              Manual selection required
                            {/if}
                          </span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Errors -->
            {#if preview.errors.length > 0}
              <div class="bg-red-50 border border-red-200 rounded-md p-4">
                <h4 class="font-medium text-red-900 mb-2">Parsing Warnings ({preview.errors.length})</h4>
                <ul class="text-sm text-red-800 list-disc list-inside space-y-1">
                  {#each preview.errors as error}
                    <li>{error}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            <!-- Conflicts -->
            {#if preview.conflicts.length > 0}
              <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h4 class="font-medium text-yellow-900 mb-2">Coach Assignment Conflicts ({preview.conflicts.length})</h4>
                <div class="space-y-3">
                  {#each preview.conflicts as conflict}
                    <div class="flex items-center justify-between bg-white p-3 rounded border">
                      <div class="flex-1">
                        <div class="font-medium">{conflict.engineer_name}</div>
                        <div class="text-sm text-gray-600">
                          Current: {conflict.current_coach} → Excel: {conflict.excel_coach || 'Not specified'}
                        </div>
                      </div>
                      <div class="ml-4">
                        {#if conflict.action === 'manual' && importAsRole === 'admin'}
                          <select
                            bind:value={coachSelections[conflict.engineer_name]}
                            class="px-3 py-1 border border-gray-300 rounded text-sm min-w-[150px]"
                          >
                            <option value={0}>Select action...</option>
                            <option value={-1}>Skip (keep current)</option>
                            <option value={-2}>Reassign to Excel coach</option>
                            {#each availableCoaches as coach}
                              <option value={coach.id}>Assign to {coach.name}</option>
                            {/each}
                          </select>
                        {:else}
                          <span class="text-sm px-2 py-1 bg-gray-100 rounded">
                            {formatConflictAction(conflict.action)}
                          </span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Engineers Preview -->
            <div class="bg-white border rounded-lg overflow-hidden">
              <div class="px-4 py-3 bg-gray-50 border-b">
                <h4 class="font-medium">Engineers to Import</h4>
              </div>
              <div class="max-h-60 overflow-y-auto">
                {#each preview.engineers as engineer}
                  <div class="p-3 border-b last:border-b-0">
                    <div class="flex justify-between items-start">
                      <div>
                        <div class="font-medium">{engineer.name}</div>
                        {#if engineer.coach_name}
                          <div class="text-sm text-gray-600">Coach: {engineer.coach_name}</div>
                        {/if}
                      </div>
                      <div class="text-sm text-gray-500">
                        {engineer.evaluations.reduce((sum, evaluation) => sum + evaluation.cases.length, 0)} cases
                      </div>
                    </div>
                    <div class="text-sm text-gray-600 mt-1">
                      Quarters: {engineer.evaluations.map(evaluation => evaluation.quarter).join(', ')}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <div class="flex justify-between">
            <button
              on:click={() => currentStep = 'upload'}
              class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              disabled={isLoading}
            >
              ← Back
            </button>
            {#if preview.coach_ownership_warning}
              <div class="text-sm text-red-600 font-medium py-2">
                Import blocked due to ownership conflict
              </div>
            {:else}
              <button
                on:click={handleImport}
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                disabled={!canProceedFromPreview() || isLoading}
              >
                {#if isLoading}
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {/if}
                Import Data
              </button>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Results Step -->
      {#if currentStep === 'results' && importResult}
        <div class="space-y-6">
          <div class="text-center">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full {importResult.success ? 'bg-green-100' : 'bg-yellow-100'} mb-4">
              {#if importResult.success}
                <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              {:else}
                <svg class="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.334 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              {/if}
            </div>
            <h3 class="text-lg font-medium text-gray-900">
              {importResult.success ? 'Import Completed Successfully!' : 'Import Completed with Issues'}
            </h3>
          </div>

          <!-- Import Statistics -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="font-medium mb-3">Import Results</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div class="text-center">
                <div class="text-2xl font-bold text-blue-600">{importResult.imported_engineers}</div>
                <div class="text-gray-600">Engineers</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-green-600">{importResult.imported_evaluations}</div>
                <div class="text-gray-600">Evaluations</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-purple-600">{importResult.imported_cases}</div>
                <div class="text-gray-600">Cases</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-orange-600">{importResult.skipped_engineers.length}</div>
                <div class="text-gray-600">Skipped</div>
              </div>
            </div>
          </div>

          <!-- Skipped Engineers -->
          {#if importResult.skipped_engineers.length > 0}
            <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h4 class="font-medium text-yellow-900 mb-2">Skipped Engineers ({importResult.skipped_engineers.length})</h4>
              <ul class="text-sm text-yellow-800 list-disc list-inside">
                {#each importResult.skipped_engineers as engineer}
                  <li>{engineer}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Errors -->
          {#if importResult.errors.length > 0}
            <div class="bg-red-50 border border-red-200 rounded-md p-4">
              <h4 class="font-medium text-red-900 mb-2">Import Errors ({importResult.errors.length})</h4>
              <ul class="text-sm text-red-800 list-disc list-inside space-y-1">
                {#each importResult.errors as error}
                  <li>{error}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <div class="flex justify-center">
            <button
              on:click={handleClose}
              class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if} 