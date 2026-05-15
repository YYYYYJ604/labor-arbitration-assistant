import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * 在 Route Handler 中创建 Supabase 客户端，并转发请求里的 Authorization。
 * 这样 PostgREST 会以 JWT 对应用户执行，RLS（如 auth.uid() = user_id）才能通过。
 */
export function createSupabaseRouteClient(req: Request): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  const authHeader = req.headers.get('authorization');
  return createClient(url, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}
