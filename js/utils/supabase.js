// Supabase client initialization
const SUPABASE_URL = "https://mbambqhpvpftwjalrvtf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYW1icWhwdnBmdHdqYWxydnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NDkxNDgsImV4cCI6MjA3OTAyNTE0OH0.2jg3Ar7CU5vJSNqw-XbYuwIOagrMCsyMRfIQdzLc8nw";

// Initialize Supabase client (Supabase JS v2 attaches a factory to window.supabase)
(() => {
  const supabaseFactory = window.supabase;
  if (!supabaseFactory || typeof supabaseFactory.createClient !== "function") {
    console.error(
      "[supabase] Supabase factory not found. Ensure https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 loads before js/utils/supabase.js"
    );
    return;
  }

  // Preserve the factory for debugging / future initialization if needed.
  window.supabaseFactory = supabaseFactory;

  const supabaseClient = supabaseFactory.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  // Stable, explicit client reference.
  window.supabaseClient = supabaseClient;

  // Back-compat: existing code references `supabase` (global). Overwrite the window property
  // to point at the client so scripts can call supabase.auth / supabase.from / supabase.storage.
  window.supabase = supabaseClient;
})();
