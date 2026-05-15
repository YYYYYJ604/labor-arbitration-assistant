import { NextResponse } from 'next/server';
import { aiClient } from '@/lib/aiClient';
import { createSupabaseRouteClient } from '@/lib/supabaseRoute';
import { getUserFromToken } from '@/lib/getUserFromToken';

type EvidenceRow = {
  file_url: string;
  analysis_result: Record<string, unknown> | null;
};

function fileDisplayName(fileUrl: string): string {
  const seg = fileUrl.split('/').pop() ?? fileUrl;
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

function formatEvidenceBlock(rows: EvidenceRow[] | null): string {
  if (!rows?.length) return '（当前没有已上传的证据文件。）';
  return rows
    .map((e, idx) => {
      const name = fileDisplayName(e.file_url);
      const lines = [`${idx + 1}. 文件：${name}`];
      const ar = e.analysis_result;
      if (ar && typeof ar === 'object') {
        if (typeof ar.summary === 'string' && ar.summary.trim()) {
          lines.push(`   分析摘要：${ar.summary.trim()}`);
        }
        if (Array.isArray(ar.keyEvidencePoints) && ar.keyEvidencePoints.length) {
          const pts = (ar.keyEvidencePoints as unknown[])
            .map((x) => String(x).trim())
            .filter(Boolean)
            .slice(0, 6);
          if (pts.length) lines.push(`   关键证据点：${pts.join('；')}`);
        }
      } else {
        lines.push('   （尚未做 AI 证据分析，可在证据详情页运行分析后再生成文书。）');
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

export async function POST(req: Request) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const supabase = createSupabaseRouteClient(req);
    const { data: evidences } = await supabase
      .from('evidences')
      .select('file_url, analysis_result')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const { data: chats } = await supabase
      .from('chats')
      .select('message, response')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15);

    const evidenceBlock = formatEvidenceBlock((evidences ?? []) as EvidenceRow[]);
    const orderedChats = [...(chats ?? [])].reverse();
    const chatBlock =
      orderedChats.length > 0
        ? orderedChats
            .map(
              (c, i) =>
                `【对话 ${i + 1}】\n问：${c.message}\n答：${c.response}`,
            )
            .join('\n\n')
        : '（暂无已保存的「AI 问答」记录。请先在「AI 问答」里说明：入职时间、岗位、工资标准、争议经过、是否解除劳动关系等，再生成文书效果更好。）';

    const prompt = `你是劳动法律文书辅助专家，输出面向普通劳动者、可读性强的中文长文。

请严格按下面**标题与顺序**输出（使用 Markdown 二级、三级标题），除正式申请书外，前面要有**材料梳理与行动建议**，让用户一眼看到手里有什么、还缺什么。

## 一、现有材料与对话整理（总览）

### 1. 已上传证据清单
根据下列系统记录，逐条列出用户已上传的文件名（用用户能看懂的名称）；若带有「分析摘要」请用一两句话归纳，**不要编造文件里不存在的事实**。若某条写明了尚未分析，请在清单里如实说明。

${evidenceBlock}

### 2. 与助手对话中的要点
根据下列「用户提问」和「助手回答」，归纳用户自述的争议类型、时间节点、金额、用人单位行为等；若信息不足，列出**待用户补充**的关键问题清单。

${chatBlock}

## 二、建议继续收集的证据（提高仲裁说服力）
请用分条清单（写给不懂法律的人），说明：
- 还缺哪些常见证据（如书面劳动合同、工资条/银行流水、考勤、加班审批、解除通知、社保记录、证人等）；
- 每一项**为什么**对本案可能更有帮助；
- **可操作的获取途径**（如向银行打印流水、向公司索要书面材料、公证聊天记录等）。
不得虚构用户已经持有的材料。

## 三、劳动仲裁申请书（范本）
包含：申请人信息【待填写】、被申请人信息【待填写】、请求事项、事实与理由（结合上文可确认的事实；不确定处用【待补充】）、证据清单（与第一节清单对应编号）。
语气符合劳动仲裁申请书习惯，并再次提醒：本内容为辅助生成，不构成正式法律意见。

写作要求：
- 全文使用规范书面语，避免生硬的内部术语。
- 若证据或对话信息很少，应在第一节、第二节明确提示用户先补充材料或先使用 AI 问答。`;

    const response = await aiClient.chat.completions.create({
      model: process.env.AI_MODEL || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });

    const content = response.choices[0].message.content;
    return NextResponse.json({ content });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '生成失败' }, { status: 500 });
  }
}
