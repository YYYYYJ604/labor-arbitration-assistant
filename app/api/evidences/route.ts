import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRoute';
import { getUserFromToken } from '@/lib/getUserFromToken';

export async function GET(req: Request) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const supabase = createSupabaseRouteClient(req);

  try {
    const { data, error } = await supabase
      .from('evidences')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .abortSignal(AbortSignal.timeout(10_000));

    if (error) throw error;
    const result = Array.isArray(data) ? data : [];
    return NextResponse.json(result);
  } catch (err) {
    console.error('证据查询失败:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}