import { NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/getUserFromToken';
import { createSupabaseRouteClient } from '@/lib/supabaseRoute';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }   // 关键：params 是一个 Promise
) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await params;   // 必须 await 才能拿到 id

  const supabase = createSupabaseRouteClient(req);
  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', id)               // id 字符串，Supabase 自动转为 integer
    .eq('user_id', user.id);

  if (error) {
    console.error('chats delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}