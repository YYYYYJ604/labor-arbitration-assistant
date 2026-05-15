import { NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/getUserFromToken';
import { createSupabaseRouteClient } from '@/lib/supabaseRoute';

export async function GET(req: Request) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const supabase = createSupabaseRouteClient(req);
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true }); // 升序，旧消息在上

  if (error) {
    console.error('chats fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}