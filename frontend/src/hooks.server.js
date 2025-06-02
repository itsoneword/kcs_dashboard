// Server-side hooks for error handling

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  try {
    return await resolve(event);
  } catch (error) {
    console.error('Server-side error:', error);
    
    // Return a more graceful error response
    return new Response(JSON.stringify({
      message: 'An internal server error occurred',
      error: error.message
    }), {
      status: 500,
      headers: {
        'content-type': 'application/json'
      }
    });
  }
}

/** @type {import('@sveltejs/kit').HandleServerError} */
export function handleError({ error, event }) {
  // Log the error on the server
  console.error('SvelteKit server error:', error, 'URL:', event.url.pathname);
  
  // Return structured error for the client
  return {
    message: error.message || 'An unexpected server error occurred',
    code: error.code || 'SERVER_ERROR'
  };
}
