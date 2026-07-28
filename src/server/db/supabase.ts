import { createClient } from "@supabase/supabase-js";
import { loadEnv, serverEnvSchema } from "@/server/db/env";

/** Admin client — uses SERVICE_ROLE_KEY. Only for ingestion scripts / admin ops. */
export function createSupabaseAdminClient() {
  const env = loadEnv(serverEnvSchema);

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** Read-only client — uses ANON_KEY (least privilege). Falls back to service role if ANON_KEY not set. */
export function createSupabaseReadClient() {
  const env = loadEnv(serverEnvSchema);
  const key = env.SUPABASE_ANON_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

  if (!env.SUPABASE_ANON_KEY) {
    console.warn("[supabase] SUPABASE_ANON_KEY not set — falling back to SERVICE_ROLE_KEY for reads");
  }

  return createClient(env.SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}