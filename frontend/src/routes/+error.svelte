<script>
  import { page } from '$app/stores';
  import { dev } from '$app/environment';
</script>

<div class="error-container">
  <div class="error-content">
    <h1>{$page.status}: {$page.error?.message || 'An error occurred'}</h1>
    
    {#if dev && $page.error?.stack}
      <pre class="error-stack">{$page.error.stack}</pre>
    {/if}
    
    <div class="error-actions">
      <a href="/" class="btn-primary">Go to Home</a>
      <button 
        class="btn-secondary" 
        on:click={() => window.location.reload()}
      >
        Try Again
      </button>
    </div>
  </div>
</div>

<style>
  .error-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 2rem;
  }
  
  .error-content {
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
  
  .error-stack {
    background-color: #f7fafc;
    padding: 1rem;
    border-radius: 0.25rem;
    overflow-x: auto;
    margin-bottom: 1.5rem;
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
