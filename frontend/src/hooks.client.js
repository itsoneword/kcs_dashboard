// Client-side hooks for error handling
import { browser } from '$app/environment';

// Global error handler to catch unhandled errors
if (browser) {
  // Keep track of errors to prevent infinite loops
  let errorCount = 0;
  const ERROR_THRESHOLD = 5;
  const ERROR_RESET_TIME = 10000; // 10 seconds
  
  // Store original console.error to preserve functionality
  const originalConsoleError = console.error;
  
  // Override console.error to capture and log errors
  console.error = function(...args) {
    // Call the original console.error
    originalConsoleError.apply(console, args);
    
    // Track errors for the login page specifically
    if (window.location.pathname === '/login') {
      errorCount++;
      
      // Log to sessionStorage for debugging
      try {
        const errors = JSON.parse(sessionStorage.getItem('kcs_login_errors') || '[]');
        errors.push({
          timestamp: new Date().toISOString(),
          message: args.map(arg => {
            try {
              return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
            } catch (e) {
              return 'Unstringifiable object';
            }
          }).join(' ')
        });
        
        // Keep only the last 10 errors
        if (errors.length > 10) {
          errors.shift();
        }
        
        sessionStorage.setItem('kcs_login_errors', JSON.stringify(errors));
      } catch (e) {
        // Ignore storage errors
      }
      
      // If too many errors in a short time, might be an infinite loop
      if (errorCount >= ERROR_THRESHOLD) {
        // Clear potential problematic state
        try {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          sessionStorage.setItem('kcs_error_recovery', 'true');
          
          // Redirect to error page instead of reloading
          if (!window.location.search.includes('debug')) {
            window.location.href = '/login?debug=true&recovery=true';
          }
        } catch (e) {
          // Last resort if we can't redirect
          document.body.innerHTML = `
            <div style="padding: 20px; max-width: 800px; margin: 0 auto; font-family: sans-serif;">
              <h1 style="color: #e53e3e;">Error Recovery Mode</h1>
              <p>The login page encountered too many errors and has been stopped to prevent browser issues.</p>
              <p>Please try clearing your browser cache and cookies, then try again.</p>
              <div style="margin-top: 20px;">
                <a href="/" style="background-color: #4299e1; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px;">Go to Home</a>
              </div>
            </div>
          `;
        }
      }
    }
  };
  
  // Reset error count periodically
  setInterval(() => {
    errorCount = 0;
  }, ERROR_RESET_TIME);
  
  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled Promise Rejection:', event.reason);
  });
  
  // Capture global errors
  window.addEventListener('error', function(event) {
    console.error('Global Error:', event.message, 'at', event.filename, ':', event.lineno);
  });
}

// Export hooks for SvelteKit
export const handleError = ({ error, event }) => {
  if (browser) {
    console.error('SvelteKit Error:', error);
  }
  
  return {
    message: error.message || 'An unexpected error occurred',
    code: error.code || 'UNKNOWN'
  };
};
