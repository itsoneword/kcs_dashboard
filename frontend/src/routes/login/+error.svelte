<script>
  import { page } from '$app/stores';
  import { dev } from '$app/environment';
  import { browser } from '$app/environment';
  
  // Track reload attempts to prevent infinite loops
  let reloadAttempts = 0;
  
  if (browser) {
    // Get stored attempts from session storage
    const storedAttempts = sessionStorage.getItem('login_reload_attempts');
    reloadAttempts = storedAttempts ? parseInt(storedAttempts, 10) : 0;
    
    // Increment and store
    reloadAttempts++;
    sessionStorage.setItem('login_reload_attempts', reloadAttempts.toString());
    
    // If too many reloads, clear auth data as it might be corrupted
    if (reloadAttempts > 3) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    }
  }
</script>

<div class="login-error-container">
  <div class="login-error-content">
    <h1>Login Page Error</h1>
    <p>There was an error loading the login page.</p>
    
    {#if $page.error?.message}
      <div class="error-message">
        <strong>Error:</strong> {$page.error.message}
      </div>
    {/if}
    
    {#if reloadAttempts > 3}
      <div class="reload-warning">
        <p>Multiple reload attempts detected. Your authentication data has been cleared to prevent further issues.</p>
      </div>
    {/if}
    
    {#if dev && $page.error?.stack}
      <pre class="error-stack">{$page.error.stack}</pre>
    {/if}
    
    <div class="error-actions">
      <a href="/" class="btn-primary">Go to Home</a>
      {#if reloadAttempts <= 5}
        <button 
          class="btn-secondary" 
          on:click={() => {
            // Reset counter and try again
            if (browser) {
              sessionStorage.setItem('login_reload_attempts', '0');
              window.location.href = '/login?debug=true';
            }
          }}
        >
          Try Again with Debug Mode
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .login-error-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 2rem;
    background-color: #f7fafc;
  }
  
  .login-error-content {
    max-width: 800px;
    padding: 2rem;
    background-color: white;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  h1 {
    color: #e53e3e;
    margin-bottom: 1rem;
  }
  
  .error-message {
    background-color: #fed7d7;
    border-left: 4px solid #e53e3e;
    padding: 1rem;
    margin: 1rem 0;
    border-radius: 0.25rem;
  }
  
  .reload-warning {
    background-color: #feebc8;
    border-left: 4px solid #dd6b20;
    padding: 1rem;
    margin: 1rem 0;
    border-radius: 0.25rem;
  }
  
  .error-stack {
    background-color: #f7fafc;
    padding: 1rem;
    border-radius: 0.25rem;
    overflow-x: auto;
    margin: 1.5rem 0;
    font-size: 0.875rem;
    white-space: pre-wrap;
  }
  
  .error-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }
  
  .btn-primary {
    background-color: #4299e1;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    text-decoration: none;
    display: inline-block;
  }
  
  .btn-secondary {
    background-color: #e2e8f0;
    color: #4a5568;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    border: none;
    cursor: pointer;
  }
</style>
