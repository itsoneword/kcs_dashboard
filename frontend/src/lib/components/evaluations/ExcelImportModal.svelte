<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { toastStore } from "$lib/stores/toast";
  import apiService from "$lib/api";
  import type { User, ExcelImportPreview, ExcelImportResult } from "$lib/types";

  export let show = false;
  export let user: User | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    success: void;
  }>();

  // Step management
  let currentStep: "upload" | "preview" | "results" = "upload";
  let isLoading = false;

  // Upload step data
  let selectedFiles: File[] = [];
  let importYear = new Date().getFullYear();
  let importAsRole: "coach" | "lead" | "admin" =
    user?.is_admin || user?.is_manager ? "admin" : "coach"; // Extended roles

  // Preview step data
  let previews: ExcelImportPreview[] = [];
  let preview: ExcelImportPreview | null = null;
  let coachSelections: Record<string, number> = {};
  let leadSelections: Record<string, number> = {}; // New: lead assignments per engineer
  let availableCoaches: User[] = [];
  let availableLeads: User[] = []; // New: available leads

  // Results step data
  let importResult: ExcelImportResult | null = null;
  // split missing-coach assignment messages into warnings
  $: warnings = importResult
    ? importResult.errors.filter((msg) =>
        msg.includes("No active coach assignment"),
      )
    : [];
  $: errors = importResult
    ? importResult.errors.filter(
        (msg) => !msg.includes("No active coach assignment"),
      )
    : [];

  // --- Role helpers ---
  function isAdmin() {
    return user?.is_admin;
  }
  function isManager() {
    return user?.is_manager;
  }
  function isLead() {
    return user?.is_lead;
  }
  function isCoach() {
    return user?.is_coach;
  }

  // Year options (current year and previous 2 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i);

  // File input element
  let fileInput: HTMLInputElement;

  function resetModal() {
    currentStep = "upload";
    selectedFiles = [];
    previews = [];
    preview = null;
    coachSelections = {};
    importResult = null;
    isLoading = false;
    importYear = new Date().getFullYear();
    importAsRole = user?.is_admin || user?.is_manager ? "admin" : "coach";
  }

  function handleClose() {
    const didSucceed = importResult?.success;
    resetModal();
    dispatch("close");
    if (didSucceed) dispatch("success");
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    selectedFiles = target.files ? Array.from(target.files) : [];
    if (selectedFiles.length === 0) {
      toastStore.add({
        type: "warning",
        message: "Please select at least one file",
      });
    }
  }

  async function handleUpload() {
    // Load leads if needed
    if (importAsRole === "admin" || importAsRole === "lead")
      await loadAvailableLeads();
    if (selectedFiles.length === 0) {
      toastStore.add({ type: "warning", message: "Please select files first" });
      return;
    }
    try {
      isLoading = true;
      const responses = [];
      for (const f of selectedFiles) {
        responses.push(
          await apiService.importExcelPreview(
            f,
            importYear,
            (user?.is_admin || user?.is_manager) && importAsRole !== "lead"
              ? importAsRole
              : undefined,
          ),
        );
      }
      previews = responses.map((r) => r.preview);
      preview = combinePreviews(previews);
      // coaches
      await loadAvailableCoaches();
      initializeCoachSelections();
      currentStep = "preview";
      if (preview.errors.length > 0)
        toastStore.add({
          type: "warning",
          message: `Parsed ${preview.errors.length} warning(s). Please review.`,
        });
      else
        toastStore.add({
          type: "success",
          message: "Files parsed successfully.",
        });
    } catch (error: any) {
      console.error("Upload error:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to parse Excel file";
      toastStore.add({ type: "error", message: errorMessage });
    } finally {
      isLoading = false;
    }
  }

  async function loadAvailableCoaches() {
    try {
      const response = await apiService.getAllUsers();
      availableCoaches = response.users.filter(
        (u) => u.is_coach && !u.deleted_at,
      );
      // Optionally sort alphabetically
      availableCoaches.sort((a, b) => a.name.localeCompare(b.name));
      console.log("Available coaches loaded:", availableCoaches.length);
    } catch (error: any) {
      console.error("Failed to load coaches:", error);
      toastStore.add({
        type: "warning",
        message: "Failed to load available coaches",
      });
    }
  }

  // New: Load available leads
  async function loadAvailableLeads() {
    try {
      const response = await apiService.getAllUsers();
      availableLeads = response.users.filter(
        (u) => (u.is_lead || u.is_manager || u.is_admin) && !u.deleted_at,
      );
      availableLeads.sort((a, b) => a.name.localeCompare(b.name));
      console.log("Available leads loaded:", availableLeads.length);
    } catch (error: any) {
      console.error("Failed to load leads:", error);
      toastStore.add({
        type: "warning",
        message: "Failed to load available leads",
      });
    }
  }

  function initializeCoachSelections() {
    if (!preview || !user) return;

    coachSelections = {};
    leadSelections = {};

    // Handle conflicts based on role hierarchy: admin > manager > lead > coach
    preview.conflicts.forEach((conflict) => {
      if (importAsRole === "admin") {
        // Admins can choose any action
        coachSelections[conflict.engineer_name] = 0; // Default to "select coach"
        leadSelections[conflict.engineer_name] = 0; // Default to "select lead"
      } else if (importAsRole === "lead") {
        // Leads can only upload for their engineers, assign themselves as lead for new
        coachSelections[conflict.engineer_name] = 0;
        if (user) leadSelections[conflict.engineer_name] = user.id;
      } else if (importAsRole === "coach") {
        // Coaches skip conflicts by default
        if (conflict.action === "skip") {
          coachSelections[conflict.engineer_name] = -1; // Skip
        } else {
          coachSelections[conflict.engineer_name] = 0; // Select coach
        }
        // No lead selection for coach
      }
    });

    // Handle missing coaches that need manual selection
    preview.missing_coaches.forEach((missing) => {
      if (missing.suggested_action === "manual_select") {
        coachSelections[missing.engineer_name] = 0; // Default to "select coach"
        if (importAsRole === "admin") {
          leadSelections[missing.engineer_name] = 0;
        } else if (importAsRole === "lead") {
          if (user) leadSelections[missing.engineer_name] = user.id;
        }
      }
    });
  }

  async function handleImport() {
    if (!selectedFiles || !preview) return;
    try {
      isLoading = true;
      const responses = [];
      for (const f of selectedFiles) {
        responses.push(
          await apiService.importExcelData(
            f,
            importYear,
            coachSelections,
            (user?.is_admin || user?.is_manager) && importAsRole !== "lead"
              ? importAsRole
              : undefined,
          ),
        );
      }
      importResult = combineResults(responses);
      currentStep = "results";
      if (importResult.success) {
        toastStore.add({
          type: "success",
          message: "Import completed successfully!",
        });
        // delay dispatch until modal close so results remain visible
      } else {
        toastStore.add({
          type: "warning",
          message: "Import completed with errors.",
        });
      }
    } catch (error: any) {
      console.error("Import error:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "Import failed";
      toastStore.add({ type: "error", message: errorMessage });
    } finally {
      isLoading = false;
    }
  }

  function formatConflictAction(action: string): string {
    switch (action) {
      case "skip":
        return "Skip (keep current coach)";
      case "reassign":
        return "Reassign to Excel coach";
      case "manual":
        return "Manual selection required";
      default:
        return action;
    }
  }

  function canProceedFromPreview(): boolean {
    if (!preview) return false;
    // Block import only for coach ownership conflicts
    if (preview.coach_ownership_warning) return false;
    return true;
  }

  // Set default import role based on user role
  onMount(() => {
    if (user?.is_admin || user?.is_manager) {
      importAsRole = "admin";
    } else if (user?.is_lead) {
      importAsRole = "lead";
    } else {
      importAsRole = "coach";
    }
  });

  // Combine multiple previews into one
  function combinePreviews(prevs: ExcelImportPreview[]): ExcelImportPreview {
    const engineers = prevs.flatMap((p) => p.engineers);
    const conflicts = prevs.flatMap((p) => p.conflicts);
    const missing_coaches = prevs.flatMap((p) => p.missing_coaches);
    const errors = prevs.flatMap((p) => p.errors);
    const total_cases = prevs.reduce(
      (sum, p) => sum + p.metadata.total_cases,
      0,
    );
    const quarters_found = prevs.flatMap((p) => p.metadata.quarters_found);
    const file_name = prevs.map((p) => p.metadata.file_name).join(", ");
    const warns = prevs
      .map((p) => p.coach_ownership_warning)
      .filter(Boolean) as NonNullable<
      ExcelImportPreview["coach_ownership_warning"]
    >[];
    const coach_ownership_warning =
      warns.find((w) => w.should_block_import) || warns[0] || null;
    return {
      engineers,
      conflicts,
      missing_coaches,
      errors,
      metadata: { coach_name: null, total_cases, quarters_found, file_name },
      coach_ownership_warning,
    };
  }

  // Merge multiple import results
  function combineResults(
    resp: { result: ExcelImportResult }[],
  ): ExcelImportResult {
    return {
      success: resp.every((r) => r.result.success),
      imported_engineers: resp.reduce(
        (sum, r) => sum + r.result.imported_engineers,
        0,
      ),
      imported_evaluations: resp.reduce(
        (sum, r) => sum + r.result.imported_evaluations,
        0,
      ),
      imported_cases: resp.reduce((sum, r) => sum + r.result.imported_cases, 0),
      skipped_engineers: resp.flatMap((r) => r.result.skipped_engineers),
      errors: resp.flatMap((r) => r.result.errors),
    };
  }
</script>

{#if show}
  <div
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
  >
    <div
      class="relative top-4 mx-auto p-6 border w-full max-w-4xl shadow-lg rounded-md bg-white m-4"
    >
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-semibold text-gray-900">
          Excel Import -
          {#if currentStep === "upload"}
            Upload File
          {:else if currentStep === "preview"}
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
            <div
              class="flex items-center {currentStep === 'upload'
                ? 'text-blue-600'
                : 'text-green-600'}"
            >
              <div
                class="w-6 h-6 rounded-full border-2 {currentStep === 'upload'
                  ? 'border-blue-600 bg-blue-100'
                  : 'border-green-600 bg-green-100'} flex items-center justify-center mr-2"
              >
                {#if currentStep === "upload"}
                  1
                {:else}
                  ✓
                {/if}
              </div>
              Upload
            </div>
            <div class="mx-2 text-gray-300">→</div>
            <div
              class="flex items-center {currentStep === 'preview'
                ? 'text-blue-600'
                : currentStep === 'results'
                  ? 'text-green-600'
                  : 'text-gray-400'}"
            >
              <div
                class="w-6 h-6 rounded-full border-2 {currentStep === 'preview'
                  ? 'border-blue-600 bg-blue-100'
                  : currentStep === 'results'
                    ? 'border-green-600 bg-green-100'
                    : 'border-gray-300'} flex items-center justify-center mr-2"
              >
                {#if currentStep === "preview"}
                  2
                {:else if currentStep === "results"}
                  ✓
                {:else}
                  2
                {/if}
              </div>
              Preview
            </div>
            <div class="mx-2 text-gray-300">→</div>
            <div
              class="flex items-center {currentStep === 'results'
                ? 'text-blue-600'
                : 'text-gray-400'}"
            >
              <div
                class="w-6 h-6 rounded-full border-2 {currentStep === 'results'
                  ? 'border-blue-600 bg-blue-100'
                  : 'border-gray-300'} flex items-center justify-center mr-2"
              >
                3
              </div>
              Import
            </div>
          </div>
        </div>
      </div>

      <!-- Upload Step -->
      {#if currentStep === "upload"}
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Excel File (.xlsx, .xlsm) *
            </label>
            <input
              bind:this={fileInput}
              type="file"
              multiple
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
              on:change={handleFileSelect}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            {#if selectedFiles.length > 0}
              <p class="text-sm text-gray-600 mt-2">
                Selected {selectedFiles.length} file(s):
              </p>
              <ul class="list-disc ml-5 text-sm text-gray-600">
                {#each selectedFiles as f}
                  <li>{f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</li>
                {/each}
              </ul>
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
              <li>
                Each sheet = engineer name (ignore "Engineer X" empty sheets)
              </li>
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
              disabled={!selectedFiles.length || isLoading}
            >
              {#if isLoading}
                <div
                  class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
                ></div>
              {/if}
              Parse File
            </button>
          </div>
        </div>
      {/if}

      <!-- Preview Step -->
      {#if currentStep === "preview" && preview}
        <div class="space-y-6">
          <!-- Coach Ownership Warning (blocking) -->
          {#if preview.coach_ownership_warning}
            <div class="bg-red-50 border border-red-200 rounded-md p-4">
              <h4 class="font-medium text-red-900 mb-2">
                ⚠️ Import Blocked - Coach Ownership Conflict
              </h4>
              <div class="text-sm text-red-800">
                <p class="mb-2">
                  This Excel file appears to belong to <strong
                    >{preview.coach_ownership_warning.detected_coach}</strong
                  >, but you are logged in as
                  <strong
                    >{preview.coach_ownership_warning.importing_user}</strong
                  >.
                </p>
                <p class="font-medium">
                  Only <strong
                    >{preview.coach_ownership_warning.detected_coach}</strong
                  > or an admin can import this file.
                </p>
                <p class="mt-2 text-red-600">
                  Please contact your administrator or ask {preview
                    .coach_ownership_warning.detected_coach} to perform the import.
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
                  <span class="font-medium ml-1"
                    >{preview.engineers.length}</span
                  >
                </div>
                <div>
                  <span class="text-gray-600">Total Cases:</span>
                  <span class="font-medium ml-1"
                    >{preview.metadata.total_cases}</span
                  >
                </div>
                <div>
                  <span class="text-gray-600">Quarters:</span>
                  <span class="font-medium ml-1"
                    >{preview.metadata.quarters_found.join(", ")}</span
                  >
                </div>
                <div>
                  <span class="text-gray-600">Coach:</span>
                  <span class="font-medium ml-1"
                    >{preview.metadata.coach_name || "Various"}</span
                  >
                </div>
              </div>
            </div>

            <!-- Missing Coaches -->
            {#if preview.missing_coaches.length > 0}
              <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 class="font-medium text-blue-900 mb-2">
                  Coach Assignment Information ({preview.missing_coaches
                    .length})
                </h4>
                <div class="space-y-2">
                  {#each preview.missing_coaches as missing}
                    <div
                      class="flex items-center justify-between bg-white p-3 rounded border"
                    >
                      <div class="flex-1">
                        <div class="font-medium">{missing.engineer_name}</div>
                        <div class="text-sm text-gray-600">
                          {#if missing.excel_coach_name}
                            Excel coach "{missing.excel_coach_name}" not found
                            in database
                          {:else}
                            No coach specified in Excel
                          {/if}
                        </div>
                      </div>
                      <div class="ml-4">
                        {#if missing.suggested_action === "manual_select" && importAsRole === "admin"}
                          <div class="flex flex-col gap-1">
                            <label class="text-xs text-gray-700"
                              >Assign Coach:</label
                            >
                            <select
                              bind:value={
                                coachSelections[missing.engineer_name]
                              }
                              class="px-3 py-1 border border-gray-300 rounded text-sm min-w-[150px]"
                            >
                              <option value={0}>Select coach...</option>
                              {#each availableCoaches as coach}
                                <option value={coach.id}>{coach.name}</option>
                              {/each}
                            </select>
                            <label class="text-xs text-gray-700 mt-2"
                              >Assign Lead:</label
                            >
                            <select
                              bind:value={leadSelections[missing.engineer_name]}
                              class="px-3 py-1 border border-gray-300 rounded text-sm min-w-[150px]"
                            >
                              <option value={0}>Select lead...</option>
                              {#each availableLeads as lead}
                                <option value={lead.id}>{lead.name}</option>
                              {/each}
                            </select>
                          </div>
                        {:else if missing.suggested_action === "manual_select" && importAsRole === "lead"}
                          <div class="flex flex-col gap-1">
                            <label class="text-xs text-gray-700"
                              >Assign Coach:</label
                            >
                            <select
                              bind:value={
                                coachSelections[missing.engineer_name]
                              }
                              class="px-3 py-1 border border-gray-300 rounded text-sm min-w-[150px]"
                            >
                              <option value={0}>Select coach...</option>
                              {#each availableCoaches as coach}
                                <option value={coach.id}>{coach.name}</option>
                              {/each}
                            </select>
                            <div
                              class="text-xs text-gray-500 mt-2 bg-blue-100 p-2 rounded"
                            >
                              New engineers will be assigned to you as
                              <span class="font-bold">{user?.name}</span>.
                            </div>
                          </div>
                        {:else}
                          <span class="text-sm px-2 py-1 bg-blue-100 rounded">
                            {#if missing.suggested_action === "assign_to_importer"}
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
                <h4 class="font-medium text-red-900 mb-2">
                  Parsing Warnings ({preview.errors.length})
                </h4>
                <ul
                  class="text-sm text-red-800 list-disc list-inside space-y-1"
                >
                  {#each preview.errors as error}
                    <li>{error}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            <!-- Conflicts -->
            {#if preview.conflicts.length > 0}
              <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h4 class="font-medium text-yellow-900 mb-2">
                  Coach Assignment Conflicts ({preview.conflicts.length})
                </h4>
                <div class="text-sm text-yellow-900 mb-2">
                  <span
                    >There is a mismatch between the coach in the uploaded file
                    and the current database for these engineers. Please resolve
                    the conflict below.</span
                  >
                </div>
                <div class="space-y-3">
                  {#each preview.conflicts as conflict}
                    <div
                      class="flex items-center justify-between bg-white p-3 rounded border"
                    >
                      <div class="flex-1">
                        <div class="font-medium">{conflict.engineer_name}</div>
                        <div class="text-sm text-gray-600">
                          Current: {conflict.current_coach} → Excel: {conflict.excel_coach ||
                            "Not specified"}
                        </div>
                      </div>
                      <div class="ml-4">
                        {#if importAsRole === "admin" && conflict.action === "manual"}
                          <div class="flex flex-col gap-1">
                            <label class="text-xs text-gray-700"
                              >Assign Coach:</label
                            >
                            <select
                              bind:value={
                                coachSelections[conflict.engineer_name]
                              }
                              class="px-3 py-1 border border-gray-300 rounded text-sm min-w-[150px]"
                            >
                              <option value={0}>Select coach...</option>
                              {#each availableCoaches as coach}
                                <option value={coach.id}>{coach.name}</option>
                              {/each}
                            </select>
                            <label class="text-xs text-gray-700 mt-2"
                              >Assign Lead:</label
                            >
                            <select
                              bind:value={
                                leadSelections[conflict.engineer_name]
                              }
                              class="px-3 py-1 border border-gray-300 rounded text-sm min-w-[150px]"
                            >
                              <option value={0}>Select lead...</option>
                              {#each availableLeads as lead}
                                <option value={lead.id}>{lead.name}</option>
                              {/each}
                            </select>
                          </div>
                        {:else if importAsRole === "lead"}
                          <div>
                            <label class="text-xs text-gray-700"
                              >Assign Coach:</label
                            >
                            <select
                              bind:value={
                                coachSelections[conflict.engineer_name]
                              }
                              class="px-3 py-1 border border-gray-300 rounded text-sm min-w-[150px]"
                            >
                              <option value={0}>Select coach...</option>
                              {#each availableCoaches as coach}
                                <option value={coach.id}>{coach.name}</option>
                              {/each}
                            </select>
                            <div
                              class="text-xs text-gray-500 mt-2 bg-yellow-100 p-2 rounded"
                            >
                              You will be assigned as lead. You may override the
                              coach.
                            </div>
                          </div>
                        {:else if importAsRole === "coach"}
                          <span
                            class="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded"
                            >Coach does not match your account. You cannot
                            import this evaluation.</span
                          >
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
                          <div class="text-sm text-gray-600">
                            Coach: {engineer.coach_name}
                          </div>
                        {/if}
                      </div>
                      <div class="text-sm text-gray-500">
                        {engineer.evaluations.reduce(
                          (sum, evaluation) => sum + evaluation.cases.length,
                          0,
                        )} cases
                      </div>
                    </div>
                    <div class="text-sm text-gray-600 mt-1">
                      Quarters: {engineer.evaluations
                        .map((evaluation) => evaluation.quarter)
                        .join(", ")}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <div class="flex justify-between">
            <button
              on:click={() => (currentStep = "upload")}
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
                  <div
                    class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
                  ></div>
                {/if}
                Import Data
              </button>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Results Step -->
      {#if currentStep === "results" && importResult}
        <div class="space-y-6">
          <div class="text-center">
            <div
              class="mx-auto flex items-center justify-center h-12 w-12 rounded-full {importResult.success
                ? 'bg-green-100'
                : 'bg-yellow-100'} mb-4"
            >
              {#if importResult.success}
                <svg
                  class="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              {:else}
                <svg
                  class="h-6 w-6 text-yellow-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.334 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              {/if}
            </div>
            <h3 class="text-lg font-medium text-gray-900">
              {importResult.success
                ? "Import Completed Successfully!"
                : "Import Completed with Issues"}
            </h3>
          </div>

          <!-- Import Statistics -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="font-medium mb-3">Import Results</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div class="text-center">
                <div class="text-2xl font-bold text-blue-600">
                  {importResult.imported_engineers}
                </div>
                <div class="text-gray-600">Engineers</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-green-600">
                  {importResult.imported_evaluations}
                </div>
                <div class="text-gray-600">Evaluations</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-purple-600">
                  {importResult.imported_cases}
                </div>
                <div class="text-gray-600">Cases</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-orange-600">
                  {importResult.skipped_engineers.length}
                </div>
                <div class="text-gray-600">Skipped</div>
              </div>
            </div>
          </div>

          <!-- Summary Info -->
          <div class="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
            <h4 class="font-medium text-blue-900 mb-2">Import Summary</h4>
            <p class="text-sm text-blue-800">
              Imported {importResult.imported_engineers} engineers and {importResult.imported_evaluations}
              evaluations with {importResult.imported_cases} cases successfully.
            </p>
            <div class="mt-2 space-x-4">
              <a href="/lead" class="text-blue-600 underline">View Engineers</a>
              <a href="/evaluations" class="text-blue-600 underline"
                >View Evaluations</a
              >
            </div>
          </div>

          <!-- Skipped Engineers -->
          {#if importResult.skipped_engineers.length > 0}
            <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h4 class="font-medium text-yellow-900 mb-2">
                Skipped Engineers ({importResult.skipped_engineers.length})
              </h4>
              <ul class="text-sm text-yellow-800 list-disc list-inside">
                {#each importResult.skipped_engineers as engineer}
                  <li>{engineer}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Warnings -->
          {#if warnings.length > 0}
            <div
              class="bg-yellow-50 border border-yellow-200 rounded-md p-4 mt-4"
            >
              <h4 class="font-medium text-yellow-900 mb-2">Warnings</h4>
              <ul
                class="text-sm text-yellow-800 list-disc list-inside space-y-1"
              >
                {#each warnings as warning}
                  <li>{warning}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Errors -->
          {#if errors.length > 0}
            <div class="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
              <h4 class="font-medium text-red-900 mb-2">
                Errors ({errors.length})
              </h4>
              <ul class="text-sm text-red-800 list-disc list-inside space-y-1">
                {#each errors as error}
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
