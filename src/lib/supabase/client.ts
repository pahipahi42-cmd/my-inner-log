import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Component から利用する Supabase クライアントを作成
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
