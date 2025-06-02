<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { loginTexts, registerTexts, roleOptions, errorMessages, debugTexts } from '$lib/content/help-texts';
  import type { UserRole } from '$lib/types';

  let email = '';
  let password = '';
  let isLoading = false;
  let error = '';
  let showRegister = false;
  let name = '';
  let selectedRole: UserRole = 'coach';
  let debugMode = false;
  let debugInfo = '';

  // Enable debug mode with URL parameter
  onMount(() => {
    if (browser) {
      const urlParams = new URLSearchParams(window.location.search);
      debugMode = urlParams.has('debug');
      
      // Log browser information in debug mode
      if (debugMode) {
        debugInfo = `User Agent: ${navigator.userAgent}\n`;
        debugInfo += `Window Size: ${window.innerWidth}x${window.innerHeight}\n`;
        debugInfo += `Local Storage Available: ${!!localStorage}\n`;
        
        try {
          const token = localStorage.getItem('auth_token');
          debugInfo += `Auth Token Present: ${!!token}\n`;
          
          const user = localStorage.getItem('user');
          debugInfo += `User Data Present: ${!!user}\n`;
        } catch (e) {
          debugInfo += `Error accessing localStorage: ${e.message}\n`;
        }
      }
    }
    
    // Redirect if already authenticated
    const unsubscribe = authStore.subscribe((auth) => {
      if (debugMode) {
        debugInfo += `Auth State: ${JSON.stringify(auth)}\n`;
      }
      
      if (auth.isAuthenticated && !auth.isLoading) {
        goto('/dashboard');
      }
    });
    
    return unsubscribe;
  });

  async function handleLogin() {
    if (!email || !password) {
      error = 'Please fill in all fields';
      return;
    }

    isLoading = true;
    error = '';

    try {
      // Normalize email to lowercase for case-insensitive login
      const normalizedEmail = email.toLowerCase().trim();
      
      if (debugMode) {
        debugInfo += `Login attempt: ${normalizedEmail}\n`;
      }
      
      await authStore.login(normalizedEmail, password);
      goto('/dashboard');
    } catch (err: any) {
      if (debugMode) {
        debugInfo += `Login error: ${JSON.stringify(err)}\n`;
        debugInfo += `Response status: ${err.response?.status}\n`;
        debugInfo += `Response data: ${JSON.stringify(err.response?.data)}\n`;
      }
      
      // More descriptive error messages
      if (err.response?.status === 401) {
        error = errorMessages.login.invalidCredentials;
      } else if (err.response?.status === 429) {
        error = errorMessages.login.rateLimited;
      } else if (!err.response) {
        error = 'Network error. Please check your connection.';
      } else {
        error = err.response?.data?.error || errorMessages.login.serverError;
      }
    } finally {
      isLoading = false;
    }
  }

  async function handleRegister() {
    if (!email || !password || !name) {
      error = 'Please fill in all fields';
      return;
    }

    if (password.length < 6) {
      error = errorMessages.register.passwordTooWeak;
      return;
    }

    isLoading = true;
    error = '';

    try {
      // Normalize email to lowercase for consistency
      const normalizedEmail = email.toLowerCase().trim();
      
      if (debugMode) {
        debugInfo += `Register attempt: ${normalizedEmail}\n`;
      }
      
      await authStore.register(normalizedEmail, password, name, selectedRole);
      goto('/dashboard');
    } catch (err: any) {
      if (debugMode) {
        debugInfo += `Register error: ${JSON.stringify(err)}\n`;
        debugInfo += `Response status: ${err.response?.status}\n`;
        debugInfo += `Response data: ${JSON.stringify(err.response?.data)}\n`;
      }
      
      // More descriptive error messages
      if (err.response?.status === 409) {
        error = errorMessages.register.emailTaken;
      } else if (!err.response) {
        error = 'Network error. Please check your connection.';
      } else {
        error = err.response?.data?.error || errorMessages.register.serverError;
      }
    } finally {
      isLoading = false;
    }
  }

  function toggleMode() {
    showRegister = !showRegister;
    error = '';
    email = '';
    password = '';
    name = '';
    selectedRole = 'coach';
  }
</script>

<svelte:head>
  <title>{showRegister ? 'Register' : 'Login'} - KCS Portal</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        {showRegister ? registerTexts.title : loginTexts.title}
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        {loginTexts.subtitle}
      </p>
    </div>
    
    <form class="mt-8 space-y-6" on:submit|preventDefault={showRegister ? handleRegister : handleLogin}>
      <div class="space-y-4">
        {#if showRegister}
          <div>
            <label for="name" class="form-label">{registerTexts.nameLabel}</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              class="form-input"
              placeholder="Enter your full name"
              bind:value={name}
              disabled={isLoading}
            />
          </div>

          <div>
            <label for="role" class="form-label">{registerTexts.roleLabel}</label>
            <select
              id="role"
              name="role"
              required
              class="form-input"
              bind:value={selectedRole}
              disabled={isLoading}
            >
              {#each roleOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
            <p class="mt-1 text-xs text-gray-500">{registerTexts.roleDescriptions[selectedRole]}</p>
          </div>

          <div class="mt-4">
            <p class="text-sm text-gray-600">{registerTexts.description}</p>
          </div>
        {/if}
        
        <div>
          <label for="email" class="form-label">{showRegister ? registerTexts.emailLabel : loginTexts.emailLabel}</label>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
            class="form-input"
            placeholder="Enter your email"
            bind:value={email}
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label for="password" class="form-label">{showRegister ? registerTexts.passwordLabel : loginTexts.passwordLabel}</label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete={showRegister ? 'new-password' : 'current-password'}
            required
            class="form-input"
            placeholder="Enter your password"
            bind:value={password}
            disabled={isLoading}
          />
          {#if showRegister}
            <p class="mt-1 text-xs text-gray-500">Password must be at least 6 characters</p>
          {/if}
        </div>
      </div>

      {#if error}
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <span class="block sm:inline">{error}</span>
          {#if debugMode}
            <button 
              class="absolute top-0 right-0 px-2 py-1 text-xs text-red-500" 
              on:click={() => error = ''}
            >
              Clear
            </button>
          {/if}
        </div>
      {/if}
      
      {#if debugMode}
        <div class="mt-4 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-48">
          <h4 class="font-bold mb-1">Debug Information</h4>
          <pre>{debugInfo}</pre>
        </div>
      {/if}

      <div>
        <button
          type="submit"
          class="btn-primary w-full flex justify-center py-3"
          disabled={isLoading}
        >
          {#if isLoading}
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          {:else}
            {showRegister ? registerTexts.submitButton : loginTexts.submitButton}
          {/if}
        </button>
      </div>

      <div class="text-center">
        <button
          type="button"
          class="text-primary-600 hover:text-primary-500 text-sm"
          on:click={toggleMode}
          disabled={isLoading}
        >
          {showRegister ? loginTexts.alreadyHaveAccount + ' Sign in' : loginTexts.needAccount + ' Register'}
        </button>
      </div>
    </form>
  </div>
</div> 