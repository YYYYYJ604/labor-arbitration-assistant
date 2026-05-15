import { NextResponse } from 'next/server';
import { aiClient } from '@/lib/aiClient';
import { useMultimodalImageInput } from '@/lib/aiAnalyzeConfig';
import { parseAiJsonObject } from '@/lib/parseAiJsonObject';
import { createSupabaseRouteClient } from '@/lib/supabaseRoute';
import { getUserFromToken } from '@/lib/getUserFromToken';
import {
  extractPdfPlainText,
  isImageUrl,
  isPdfUrl,
  mimeFromEvidenceUrl,
  readEvidenceFileBuffer,
} from '@/lib/extractEvidenceText';

export const runtime = 'nodejs';

const STRUCTURE_PROMPT = [
  'Output exactly one JSON object (no markdown fences, no extra text). Keys must be:',
  '{"involvesOvertime":boolean,"involvesUnpaidWages":boolean,"timeline":string[],',
  '"keyEvidencePoints":string[],"summary":string}.',
  'Use empty arrays when unknown.',
  'All human-readable strings inside JSON (summary, timeline items, keyEvidencePoints items) MUST be in Simplified Chinese.',
].join(' ');

async function runTextAnalysis(userContent: string, fileLabel: string) {
  const prompt = [
    'You assist with China labor-dispute evidence review.',
    STRUCTURE_PROMPT,
    'Evidence file:',
    fileLabel,
    'Body text / notes (may be empty):',
    '---',
    userContent || '(no body text)',
    '---',
  ].join('\n');

  const model = process.env.AI_MODEL || 'deepseek-chat';
  const response = await aiClient.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });
  const text = response.choices[0]?.message?.content ?? '';
  return parseAiJsonObject(text);
}

/** 当前接口无法读图：仅根据文件名给小白可执行的取证与补强建议 */
async function runImageAnalysisWithoutVision(fileLabel: string) {
  const hint = [
    'Context: User uploaded an IMAGE (screenshot/photo) as labor arbitration evidence in China.',
    'Your API cannot read image pixels; you ONLY know the filename. Do NOT claim you read the chat content.',
    STRUCTURE_PROMPT,
    'Set involvesOvertime / involvesUnpaidWages to false unless the filename strongly suggests otherwise (use false if unsure).',
    'timeline: give 2-5 short Chinese steps like "整理聊天时间线" if unknown dates.',
    'keyEvidencePoints: 4-8 bullets in Simplified Chinese: what additional evidence to collect (written contract, pay slips/bank statements, attendance, social insurance records, termination notices, overtime approval, HR emails, notarized chat exports, employer business license info, etc.).',
    'summary: in Simplified Chinese, friendly for non-lawyers:',
    '- explain limitation (cannot OCR the image here);',
    '- tell how to make chat screenshots stronger (export full chat to PDF, show both sides names, dates, money amounts, keep original phone);',
    '- remind this is not legal advice.',
  ].join('\n');

  return runTextAnalysis(hint, fileLabel);
}

async function runVisionAnalysis(
  userContent: string,
  fileLabel: string,
  mime: string,
  base64: string,
) {
  const prompt = [
    'You assist with China labor-dispute evidence review. Use the image plus notes.',
    STRUCTURE_PROMPT,
    'Evidence file:',
    fileLabel,
    'Notes:',
    userContent || '(none)',
  ].join('\n');

  const visionModel =
    process.env.AI_VISION_MODEL || process.env.AI_MODEL || 'gpt-4o-mini';

  const response = await aiClient.chat.completions.create({
    model: visionModel,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mime};base64,${base64}`,
            },
          },
        ],
      },
    ],
    temperature: 0.2,
  });
  const text = response.choices[0]?.message?.content ?? '';
  return parseAiJsonObject(text);
}

export async function POST(req: Request) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let evidenceId: string | undefined;
  try {
    const body = (await req.json()) as { evidenceId?: string; id?: string };
    evidenceId = body.evidenceId ?? body.id;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!evidenceId) {
    return NextResponse.json({ error: 'Missing evidenceId' }, { status: 400 });
  }

  const supabase = createSupabaseRouteClient(req);

  const { data: row, error: fetchError } = await supabase
    .from('evidences')
    .select('id, file_url')
    .eq('id', evidenceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error('analyze fetch:', fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!row?.file_url) {
    return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
  }

  const fileUrl = row.file_url as string;
  const fileLabel = fileUrl.split('/').pop() ?? fileUrl;
  let analysis: Record<string, unknown>;

  try {
    if (isPdfUrl(fileUrl)) {
      const pdfText = await extractPdfPlainText(fileUrl);
      const content =
        pdfText ||
        [
          '(No extractable PDF text. Infer conservatively from filename;',
          'state limited basis in summary.)',
        ].join(' ');
      analysis = await runTextAnalysis(content, fileLabel);
    } else if (isImageUrl(fileUrl)) {
      const buf = await readEvidenceFileBuffer(fileUrl);
      if (!buf) {
        return NextResponse.json(
          { error: 'Cannot read evidence file' },
          { status: 400 },
        );
      }
      const mime = mimeFromEvidenceUrl(fileUrl);

      if (useMultimodalImageInput()) {
        const base64 = buf.toString('base64');
        try {
          analysis = await runVisionAnalysis('', fileLabel, mime, base64);
        } catch (visionErr) {
          console.warn('vision analyze fallback:', visionErr);
          analysis = await runImageAnalysisWithoutVision(fileLabel);
        }
      } else {
        analysis = await runImageAnalysisWithoutVision(fileLabel);
      }
    } else {
      analysis = await runTextAnalysis(
        '',
        [
          fileLabel,
          '(Unknown extension; generic evidence guidance;',
          'note unclear material type in summary.)',
        ].join(' '),
      );
    }
  } catch (err) {
    console.error('analyze AI:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 },
    );
  }

  const { error: updateError } = await supabase
    .from('evidences')
    .update({ analysis_result: analysis })
    .eq('id', evidenceId)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('analyze update:', updateError);
    return NextResponse.json(
      { error: `Save failed: ${updateError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(analysis);
}
