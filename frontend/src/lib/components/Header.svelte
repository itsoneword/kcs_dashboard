<script lang="ts">
    import { goto } from "$app/navigation";
    import { authStore } from "$lib/stores/auth";
    import type { User } from "$lib/types";
    import { onMount } from "svelte";
    import apiService from "$lib/api";

    export let title: string;
    export let showBackButton = true;
    export let backUrl = "/dashboard";
    export let user: User | null = null;

    async function handleLogout() {
        await authStore.logout();
        goto("/login");
    }

    function getUserRoles(user: User): string[] {
        const roles: string[] = [];
        if (user.is_admin) roles.push("Admin");
        if (user.is_lead) roles.push("Lead");
        if (user.is_coach) roles.push("Coach");
        return roles.length > 0 ? roles : ["User"];
    }

    function handleBack() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            goto(backUrl);
        }
    }

    function goHome() {
        goto("/dashboard");
    }

    let showMenu = false;

    function toggleMenu() {
        showMenu = !showMenu;
    }

    function closeMenu() {
        showMenu = false;
    }

    onMount(() => {
        window.addEventListener("click", closeMenu);
        return () => window.removeEventListener("click", closeMenu);
    });

    async function handleChangePassword() {
        if (!user) return;
        const newPassword = window.prompt("Enter your new password:");
        if (!newPassword) return;
        try {
            await apiService.changeUserPassword(user.id, newPassword);
            alert("Password changed successfully");
        } catch (error) {
            console.error(error);
            alert("Failed to change password. Please try again.");
        } finally {
            showMenu = false;
        }
    }
</script>

<nav class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
            <div class="flex items-center space-x-4">
                {#if showBackButton}
                    <button
                        on:click={handleBack}
                        class="text-primary-600 hover:text-primary-700"
                        title="Go Back"
                    >
                        <svg
                            class="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            />
                        </svg>
                    </button>
                {/if}
                <button
                    on:click={goHome}
                    class="text-primary-600 hover:text-primary-700"
                    title="Go to Dashboard"
                >
                    <svg
                        class="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                        />
                    </svg>
                </button>
                <h1 class="text-xl font-semibold text-gray-900">{title}</h1>
            </div>

            {#if user}
                <div class="flex items-center space-x-4">
                    <div class="relative" on:click|stopPropagation>
                        <button
                            on:click={toggleMenu}
                            class="text-sm text-gray-700 hover:underline focus:outline-none"
                        >
                            Welcome, {user.name}
                            <svg
                                class="w-4 h-4 inline-block ml-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path
                                    fill-rule="evenodd"
                                    d="M5.793 7.793a1 1 0 011.414 0L10 10.586l2.793-2.793a1 1 0 011.414 1.414l-3.5 3.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 010-1.414z"
                                    clip-rule="evenodd"
                                />
                            </svg>
                        </button>
                        {#if showMenu}
                            <div
                                class="absolute right-0 mt-2 w-48 bg-white border border-gray-200 shadow-lg rounded-md py-1 z-20"
                            >
                                <button
                                    on:click={handleChangePassword}
                                    class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    Change Password
                                </button>
                            </div>
                        {/if}
                    </div>

                    <div class="flex space-x-1">
                        {#each getUserRoles(user) as role}
                            <span class="badge badge-{role.toLowerCase()}"
                                >{role}</span
                            >
                        {/each}
                    </div>

                    <button
                        on:click={handleLogout}
                        class="btn-secondary text-sm"
                    >
                        Logout
                    </button>
                </div>
            {/if}
        </div>
    </div>
</nav>
