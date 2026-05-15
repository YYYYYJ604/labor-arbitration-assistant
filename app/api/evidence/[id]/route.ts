import { NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { createSupabaseRouteClient } from '@/lib/supabaseRoute';
import { getUserFromToken } from '@/lib/getUserFromToken';
import { uploadsFilePathFromUrl } from '@/lib/extractEvidenceText';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 });
  }

  const supabase = createSupabaseRouteClient(req);
  const { data, error } = await supabase
    .from('evidences')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('evidence GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: '未找到该证据' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 });
  }

  const supabase = createSupabaseRouteClient(req);
  const { data: row, error: fetchError } = await supabase
    .from('evidences')
    .select('id, file_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error('evidence DELETE fetch:', fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!row?.file_url) {
    return NextResponse.json({ error: '未找到该证据' }, { status: 404 });
  }

  const diskPath = uploadsFilePathFromUrl(row.file_url as string);
  if (diskPath) {
    try {
      await unlink(diskPath);
    } catch {
      /* 文件可能已手动删除，忽略 */
    }
  }

  const { error: delError } = await supabase
    .from('evidences')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (delError) {
    console.error('evidence DELETE:', delError);
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
