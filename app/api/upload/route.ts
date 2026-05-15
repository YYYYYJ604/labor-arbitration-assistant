import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { createSupabaseRouteClient } from '@/lib/supabaseRoute';
import { getUserFromToken } from '@/lib/getUserFromToken';

export async function POST(req: Request) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: '缺少文件' }, { status: 400 });
    }

    // 保存文件到磁盘（文件名防路径穿越）
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    // 仅去掉路径非法字符，保留中文、数字、常见标点（便于用户用中文命名）
    const rawBase = path.basename(file.name);
    const safeBase =
      rawBase.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim() ||
      'file';
    const fileName = `${Date.now()}-${safeBase}`;
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);
    const fileUrl = `/uploads/${fileName}`;

    const supabase = createSupabaseRouteClient(req);
    const { data, error } = await supabase
      .from('evidences')
      .insert({ user_id: user.id, file_url: fileUrl })
      .select()
      .single();

    if (error) {
      console.error('evidences insert:', error);
      return NextResponse.json(
        { error: `数据库写入失败: ${error.message}` },
        { status: 500 },
      );
    }
    return NextResponse.json({ url: fileUrl, id: data.id });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : '上传失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}