<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { authStore } from "$lib/stores/auth";
    import { toastStore } from "$lib/stores/toast";
    import apiService from "$lib/api";
    import type { User } from "$lib/types";

    let currentUser: User | null = null;
    let isLoading = true;

    // Database Management State
    let dbStatus: any = null;
    let dbBackups: any[] = [];
    let isLoadingDbStatus = false;
    let isLoadingDbBackups = false;
    let newDbPathInput = "";
    let isLoadingChangeDb = false;
    let selectedFile: File | null = null;
    let isLoadingUpload = false;

    onMount(() => {
        const unsubscribe = authStore.subscribe(async (auth) => {
            if (!auth.isAuthenticated && !auth.isLoading) {
                goto("/login");
            } else if (auth.isAuthenticated) {
                currentUser = auth.user;
                isLoading = false;

                if (!currentUser?.is_admin) {
                    toastStore.add({
                        type: "error",
                        message:
                            "You do not have permission to view this page.",
                    });
                    goto("/dashboard");
                    return;
                }

                await loadDbStatus();
                await loadDbBackups();
            }
        });

        return () => unsubscribe();
    });

    async function handleLogout() {
        await authStore.logout();
        goto("/login");
    }

    // Database Management Functions
    async function loadDbStatus() {
        isLoadingDbStatus = true;
        try {
            dbStatus = await apiService.getDatabaseStatus();
        } catch (err: any) {
            toastStore.add({
                type: "error",
                message:
                    err.response?.data?.error || "Failed to load DB status",
            });
            dbStatus = {
                error: err.response?.data?.error || "Failed to load DB status",
            }; // Store error in status
        } finally {
            isLoadingDbStatus = false;
        }
    }

    async function createDbBackup() {
        try {
            const backup = await apiService.createDatabaseBackup();
            toastStore.add({ type: "success", message: backup.message });
            await loadDbBackups();
        } catch (err: any) {
            toastStore.add({
                type: "error",
                message:
                    err.response?.data?.error || "Failed to create DB backup",
            });
        }
    }

    async function loadDbBackups() {
        isLoadingDbBackups = true;
        try {
            const response = await apiService.getDatabaseBackups();
            dbBackups = response.backups;
        } catch (err: any) {
            toastStore.add({
                type: "error",
                message:
                    err.response?.data?.error || "Failed to load DB backups",
            });
        } finally {
            isLoadingDbBackups = false;
        }
    }

    async function downloadBackup(filename: string) {
        try {
            toastStore.add({
                type: "info",
                message: `Preparing download for ${filename}...`,
            });
            const response = await apiService.downloadBackup(filename);

            // Create a blob from the response
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            // Create a temporary link element to trigger the download
            const a = document.createElement("a");
            a.href = url;
            a.download = filename; // The filename for the downloaded file
            document.body.appendChild(a);
            a.click();

            // Clean up
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error("Download failed:", err);
            toastStore.add({
                type: "error",
                message: err.message || "Failed to download backup.",
            });
        }
    }

    function handleFileSelect(e: Event) {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            selectedFile = target.files[0];
        } else {
            selectedFile = null;
        }
    }

    async function handleUploadDatabase() {
        if (!selectedFile) {
            toastStore.add({
                type: "warning",
                message: "Please select a file.",
            });
            return;
        }

        isLoadingUpload = true;
        try {
            const response = await apiService.uploadDatabase(selectedFile);
            toastStore.add({ type: "success", message: response.message });

            // Refresh status and backups
            await loadDbStatus();
            await loadDbBackups();
            selectedFile = null; // Clear file input
            // Clear the file input visually
            const fileInput = document.getElementById(
                "dbUpload",
            ) as HTMLInputElement;
            if (fileInput) {
                fileInput.value = "";
            }
        } catch (err: any) {
            toastStore.add({
                type: "error",
                message:
                    err.response?.data?.error || "Failed to upload database.",
            });
        } finally {
            isLoadingUpload = false;
        }
    }

    async function handleChangeDbPath() {
        if (!newDbPathInput.trim()) {
            toastStore.add({
                type: "warning",
                message: "New database path cannot be empty.",
            });
            return;
        }
        isLoadingChangeDb = true;
        try {
            const response =
                await apiService.changeDatabasePath(newDbPathInput);
            toastStore.add({ type: "success", message: response.message });
            // Update current DB status with response from change DB operation
            dbStatus = {
                status: response.status,
                path: response.newPath,
                size: response.size,
                lastModified: response.lastModified,
                timestamp: response.timestamp,
            };
            newDbPathInput = ""; // Clear input
        } catch (err: any) {
            toastStore.add({
                type: "error",
                message:
                    err.response?.data?.error ||
                    "Failed to change database path",
            });
        } finally {
            isLoadingChangeDb = false;
        }
    }

    function formatBytes(bytes: number, decimals = 2) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
        );
    }

    function getUserRoles(user: User | null | undefined): string[] {
        if (!user) return ["User"];

        const roles: string[] = [];
        if (user.is_admin) roles.push("Admin");
        if (user.is_manager) roles.push("Manager");
        if (user.is_lead) roles.push("Lead");
        if (user.is_coach) roles.push("Coach");
        return roles.length > 0 ? roles : ["User"];
    }
</script>

<svelte:head>
    <title>Database Management - KCS Portal</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
    <!-- removed local nav header; using global Header -->

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
            <!-- Database Management Section -->
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-900">
                    Database Management
                </h2>
                <p class="text-gray-600">
                    Manage database status and backups. Change active database
                    file.
                </p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Left Column: Status & Backups -->
                <div class="space-y-6">
                    <!-- Database Status -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Database Status</h3>
                            <button
                                class="btn-secondary btn-sm"
                                on:click={loadDbStatus}
                                disabled={isLoadingDbStatus}
                            >
                                {#if isLoadingDbStatus}
                                    <span
                                        class="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                                        role="status"
                                        aria-label="loading"
                                    ></span> Refreshing...
                                {:else}
                                    Refresh
                                {/if}
                            </button>
                        </div>
                        <div class="card-body">
                            {#if dbStatus && !dbStatus.error}
                                <dl
                                    class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm"
                                >
                                    <dt class="font-medium text-gray-500">
                                        Status:
                                    </dt>
                                    <dd class="text-gray-900">
                                        <span
                                            class="badge {dbStatus.status ===
                                            'healthy'
                                                ? 'badge-success'
                                                : 'badge-danger'}"
                                        >
                                            {dbStatus.status}
                                        </span>
                                    </dd>
                                    <dt class="font-medium text-gray-500">
                                        Path:
                                    </dt>
                                    <dd
                                        class="text-gray-900 truncate"
                                        title={dbStatus.path}
                                    >
                                        {dbStatus.path}
                                    </dd>
                                    <dt class="font-medium text-gray-500">
                                        Size:
                                    </dt>
                                    <dd class="text-gray-900">
                                        {formatBytes(dbStatus.size)}
                                    </dd>
                                    <dt class="font-medium text-gray-500">
                                        Last Modified:
                                    </dt>
                                    <dd class="text-gray-900">
                                        {dbStatus.lastModified
                                            ? new Date(
                                                  dbStatus.lastModified,
                                              ).toLocaleString()
                                            : "N/A"}
                                    </dd>
                                </dl>
                            {:else if isLoadingDbStatus}
                                <p class="text-gray-500">Loading status...</p>
                            {:else}
                                <p class="text-red-500">
                                    Error: {dbStatus?.error ||
                                        "Could not load database status."}
                                </p>
                            {/if}
                        </div>
                    </div>

                    <!-- Database Backups -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Database Backups</h3>
                            <div class="space-x-2">
                                <button
                                    class="btn-secondary btn-sm"
                                    on:click={loadDbBackups}
                                    disabled={isLoadingDbBackups}
                                >
                                    {#if isLoadingDbBackups}
                                        <span
                                            class="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                                            role="status"
                                            aria-label="loading"
                                        ></span> Refreshing...
                                    {:else}
                                        Refresh
                                    {/if}
                                </button>
                                <button
                                    class="btn-primary btn-sm"
                                    on:click={createDbBackup}
                                    disabled={isLoadingDbBackups}
                                >
                                    Create Backup
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            {#if isLoadingDbBackups}
                                <p class="text-gray-500">Loading backups...</p>
                            {:else if dbBackups.length > 0}
                                <ul
                                    class="divide-y divide-gray-200 max-h-120 overflow-y-auto"
                                >
                                    {#each dbBackups as backup (backup.filename)}
                                        <li class="py-3">
                                            <div
                                                class="flex justify-between items-center text-sm"
                                            >
                                                <div>
                                                    <p
                                                        class="font-medium text-gray-900"
                                                    >
                                                        {backup.filename}
                                                    </p>
                                                    <p
                                                        class="text-gray-500 text-xs"
                                                    >
                                                        Created: {new Date(
                                                            backup.created,
                                                        ).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div
                                                    class="flex items-center space-x-2"
                                                >
                                                    <span class="text-gray-700"
                                                        >{formatBytes(
                                                            backup.size,
                                                        )}</span
                                                    >
                                                    <button
                                                        class="btn-secondary btn-xs"
                                                        on:click={() =>
                                                            downloadBackup(
                                                                backup.filename,
                                                            )}
                                                    >
                                                        Download
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    {/each}
                                </ul>
                            {:else}
                                <p class="text-gray-500">
                                    No backups found. (Ensure 'backups'
                                    directory exists in backend root).
                                </p>
                            {/if}
                        </div>
                    </div>
                </div>

                <!-- Right Column: Upload and Change Path -->
                <div class="space-y-6">
                    <!-- Upload Database File -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">
                                Upload and Replace Database
                            </h3>
                        </div>
                        <div class="card-body">
                            <p class="text-sm text-gray-600 mb-3">
                                Upload a new SQLite database file (.db).
                                Uploading will first create a backup of the
                                current database before replacing it.
                            </p>
                            <div class="mb-3">
                                <label
                                    for="dbUpload"
                                    class="block text-sm font-medium text-gray-700 mb-1"
                                    >New Database File</label
                                >
                                <input
                                    type="file"
                                    id="dbUpload"
                                    on:change={handleFileSelect}
                                    class="input-file"
                                    accept=".db"
                                />
                                {#if selectedFile}
                                    <p class="text-xs text-gray-500 mt-1">
                                        Selected: {selectedFile.name} ({formatBytes(
                                            selectedFile.size,
                                        )})
                                    </p>
                                {/if}
                            </div>
                            <button
                                class="btn-primary w-full"
                                on:click={handleUploadDatabase}
                                disabled={isLoadingUpload || !selectedFile}
                            >
                                {#if isLoadingUpload}
                                    <span
                                        class="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                                        role="status"
                                        aria-label="loading"
                                    ></span> Uploading...
                                {:else}
                                    Upload and Replace
                                {/if}
                            </button>
                            <p class="text-xs text-gray-500 mt-2">
                                The application will restart its database
                                connection. Ensure the uploaded file is a valid
                                and uncorrupted database.
                            </p>
                        </div>
                    </div>

                    <!-- Change Database File by Path -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">
                                Change Active Database (by Path)
                            </h3>
                        </div>
                        <div class="card-body">
                            <p class="text-sm text-gray-600 mb-3">
                                Alternatively, enter a path to a new SQLite
                                database file on the server.
                            </p>
                            <div class="mb-3">
                                <label
                                    for="newDbPath"
                                    class="block text-sm font-medium text-gray-700 mb-1"
                                    >New Database Path (.db)</label
                                >
                                <input
                                    type="text"
                                    id="newDbPath"
                                    bind:value={newDbPathInput}
                                    class="input"
                                    placeholder="e.g., /path/to/your/new_database.db"
                                />
                            </div>
                            <button
                                class="btn-primary w-full"
                                on:click={handleChangeDbPath}
                                disabled={isLoadingChangeDb ||
                                    !newDbPathInput.trim()}
                            >
                                {#if isLoadingChangeDb}
                                    <span
                                        class="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                                        role="status"
                                        aria-label="loading"
                                    ></span> Changing...
                                {:else}
                                    Change Database
                                {/if}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
