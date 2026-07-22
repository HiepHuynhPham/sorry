export async function getClient() {
  const config = window.APP_CONFIG || {};
  const missing = !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || config.SUPABASE_URL === "SUPABASE_URL";
  if (missing) {
    console.info("Supabase chưa được cấu hình. Hãy sao chép config.example.js thành config.js và điền URL cùng anon key công khai.");
    return null;
  }
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.52.0/+esm");
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}
