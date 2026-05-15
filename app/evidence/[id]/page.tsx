'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type EvidenceRow = {
  id: string;
  file_url: string;
  analysis_result: Record<string, unknown> | null;
  created_at?: string;
};

const ANALYZE_ERROR_ZH: Record<string, string> = {
  Unauthorized: '未登录或会话已过期',
  'Evidence not found': '证据不存在',
  'Cannot read evidence file': '无法读取证据文件',
  'Missing evidenceId': '请求无效',
  'Invalid JSON body': '请求无效',
  'Analysis failed': '分析失败',
};

function displayApiError(message: string) {
  if (ANALYZE_ERROR_ZH[message]) return ANALYZE_ERROR_ZH[message];
  if (/^Save failed:/i.test(message)) {
    return `保存失败：${message.replace(/^Save failed:\s*/i, '')}`;
  }
  return message;
}

function formatAnalysis(result: Record<string, unknown> | null) {
  if (!result) return null;
  const lines: { label: string; value: string }[] = [];
  const bool = (v: unknown) =>
    v === true ? '是' : v === false ? '否' : String(v ?? '—');

  if ('involvesOvertime' in result) {
    lines.push({ label: '是否涉及加班', value: bool(result.involvesOvertime) });
  }
  if ('involvesUnpaidWages' in result) {
    lines.push({ label: '是否涉及欠薪', value: bool(result.involvesUnpaidWages) });
  }
  if (Array.isArray(result.timeline)) {
    lines.push({
      label: '时间线',
      value:
        (result.timeline as unknown[])
          .map((x) => String(x))
          .filter(Boolean)
          .join('；') || '—',
    });
  }
  if (Array.isArray(result.keyEvidencePoints)) {
    lines.push({
      label: '关键证据点',
      value:
        (result.keyEvidencePoints as unknown[])
          .map((x) => String(x))
          .filter(Boolean)
          .join('；') || '—',
    });
  }
  if (typeof result.summary === 'string' && result.summary) {
    lines.push({ label: '摘要', value: result.summary });
  }
  return lines.length > 0 ? lines : null;
}

export default function EvidenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<EvidenceRow | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    const res = await fetch(`/api/evidence/${id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || `加载失败 (${res.status})`);
      setRow(null);
      setLoading(false);
      return;
    }
    setRow(data as EvidenceRow);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAnalyze = async () => {
    if (!id) return;
    setAnalyzing(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ evidenceId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(displayApiError(String(data.error || '')) || `分析失败 (${res.status})`);
        return;
      }
      await load();
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('确定删除这条证据吗？文件将一并删除且不可恢复。')) return;
    setDeleting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const res = await fetch(`/api/evidence/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : `删除失败（${res.status}）`);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('删除失败，请检查网络');
    } finally {
      setDeleting(false);
    }
  };

  const displayName = row?.file_url?.split('/').pop() ?? '证据';
  const isImage =
    row?.file_url &&
    /\.(png|jpe?g|gif|webp)$/i.test(row.file_url);
  const isPdf = row?.file_url?.toLowerCase().endsWith('.pdf');

  const formatted = formatAnalysis(row?.analysis_result ?? null);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/dashboard"
            className="text-sm text-stone-600 hover:text-stone-900"
          >
            ← 返回工作台
          </Link>
          <h1 className="text-lg font-medium">证据详情</h1>
          <span className="w-20" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {loading && (
          <p className="text-center text-stone-500">加载中…</p>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {!loading && row && (
          <>
            <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium text-stone-900">{displayName}</h2>
                  {row.created_at && (
                    <p className="mt-1 text-xs text-stone-500">
                      上传时间：{new Date(row.created_at).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void runAnalyze()}
                    disabled={analyzing}
                    className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-800 disabled:opacity-50"
                  >
                    {analyzing ? '分析中…' : row.analysis_result ? '重新 AI 分析' : '运行 AI 分析'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting || analyzing}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting ? '删除中…' : '删除证据'}
                  </button>
                  <a
                    href={row.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    在新窗口打开原文件
                  </a>
                </div>
              </div>

              {isImage && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 leading-relaxed">
                  <strong>温馨提示：</strong>您上传的是<strong>图片</strong>。当前助手<strong>无法把截图里的字逐字读出来</strong>，下面的分析会侧重「材料怎么整理、还缺什么更有说服力」。若希望结合<strong>聊天原文</strong>来写材料，请把记录<strong>导出成 PDF</strong>再上传，或上传带文字说明的 PDF。
                </div>
              )}
              <div className="overflow-hidden rounded-lg border border-stone-100 bg-stone-50">
                {isImage && (
                  <Image
                    src={row.file_url}
                    alt={displayName}
                    width={1200}
                    height={900}
                    unoptimized
                    className="max-h-[480px] w-full object-contain"
                  />
                )}
                {isPdf && (
                  <iframe
                    title="PDF 预览"
                    src={row.file_url}
                    className="h-[min(70vh,560px)] w-full"
                  />
                )}
                {!isImage && !isPdf && (
                  <div className="p-6 text-center text-sm text-stone-500">
                    无法内嵌预览此类型，请使用「在新窗口打开原文件」。
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-stone-500">
                AI 分析结果
              </h3>
              {!row.analysis_result && (
                <p className="text-sm text-stone-500">
                  尚未分析。点击「运行 AI 分析」根据文件内容生成结构化结论（不构成法律意见）。
                </p>
              )}
              {formatted && (
                <dl className="space-y-3 text-sm">
                  {formatted.map(({ label, value }) => (
                    <div key={label}>
                      <dt className="font-medium text-stone-700">{label}</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-stone-600">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {row.analysis_result && !formatted && (
                <pre className="overflow-x-auto rounded-lg bg-stone-50 p-3 text-xs text-stone-800">
                  {JSON.stringify(row.analysis_result, null, 2)}
                </pre>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
