async function handle({ event, resolve }) {
  try {
    return await resolve(event);
  } catch (error) {
    console.error("Server-side error:", error);
    return new Response(JSON.stringify({
      message: "An internal server error occurred",
      error: error.message
    }), {
      status: 500,
      headers: {
        "content-type": "application/json"
      }
    });
  }
}
function handleError({ error, event }) {
  console.error("SvelteKit server error:", error, "URL:", event.url.pathname);
  return {
    message: error.message || "An unexpected server error occurred",
    code: error.code || "SERVER_ERROR"
  };
}
export {
  handle,
  handleError
};
