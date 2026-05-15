import { NextResponse } from 'next/server';
import { aiClient } from '@/lib/aiClient';
import { getUserFromToken } from '@/lib/getUserFromToken';
import { createSupabaseRouteClient } from '@/lib/supabaseRoute';

export async function POST(req: Request) {
  
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  try {
    const { message } = await req.json();
    if (!message) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    const prompt = `你是中国劳动法律助手，仅提供参考信息，不构成法律意见。回答必须包含：
1. 法律依据（简要）
2. 可能维权路径
3. 需要的证据类型

用户问题：${message}`;

    const response = await aiClient.chat.completions.create({
      model: process.env.AI_MODEL || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const reply = response.choices[0].message.content ?? '';

    const supabase = createSupabaseRouteClient(req);
    const { error: logError } = await supabase.from('chats').insert({
      user_id: user.id,
      message,
      response: reply,
    });
    if (logError) {
      console.error('chats insert:', logError);
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'AI 服务出错' }, { status: 500 });
  }
}