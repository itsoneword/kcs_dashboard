<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { onMount } from 'svelte';

  let email = '';
  let password = '';
  let isLoading = false;
  let error = '';
  let showRegister = false;
  let name = '';

  // Redirect if already authenticated
  onMount(() => {
    const unsubscribe = authStore.subscribe((auth) => {
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
      await authStore.login(normalizedEmail, password);
      goto('/dashboard');
    } catch (err: any) {
      error = err.response?.data?.error || 'Login failed';
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
      error = 'Password must be at least 6 characters';
      return;
    }

    isLoading = true;
    error = '';

    try {
      // Normalize email to lowercase for consistency
      const normalizedEmail = email.toLowerCase().trim();
      await authStore.register(normalizedEmail, password, name);
      goto('/dashboard');
    } catch (err: any) {
      error = err.response?.data?.error || 'Registration failed';
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
  }
</script>

<svelte:head>
  <title>{showRegister ? 'Register' : 'Login'} - KCS Portal</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        {showRegister ? 'Create your account' : 'Sign in to your account'}
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        KCS Performance Tracking Portal
      </p>
    </div>
    
    <form class="mt-8 space-y-6" on:submit|preventDefault={showRegister ? handleRegister : handleLogin}>
      <div class="space-y-4">
        {#if showRegister}
          <div>
            <label for="name" class="form-label">Full Name</label>
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
        {/if}
        
        <div>
          <label for="email" class="form-label">Email address</label>
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
          <label for="password" class="form-label">Password</label>
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
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
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
            {showRegister ? 'Create Account' : 'Sign In'}
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
          {showRegister ? 'Already have an account? Sign in' : 'Need an account? Register'}
        </button>
      </div>
    </form>
  </div>
</div> 