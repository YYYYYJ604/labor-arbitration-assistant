import { readFile } from 'fs/promises';
import path from 'path';

const MAX_TEXT = 12_000;

/** 仅允许本地 public/uploads 下的路径，防止路径穿越 */
export function uploadsFilePathFromUrl(fileUrl: string): string | null {
  if (!fileUrl.startsWith('/uploads/')) return null;
  const base = path.basename(fileUrl);
  if (!base || base === '.' || base === '..') return null;
  const resolved = path.join(process.cwd(), 'public', 'uploads', base);
  const uploadsRoot = path.join(process.cwd(), 'public', 'uploads');
  if (!resolved.startsWith(uploadsRoot)) return null;
  return resolved;
}

export async function readEvidenceFileBuffer(fileUrl: string): Promise<Buffer | null> {
  const p = uploadsFilePathFromUrl(fileUrl);
  if (!p) return null;
  try {
    return await readFile(p);
  } catch {
    return null;
  }
}

export function mimeFromEvidenceUrl(fileUrl: string): string {
  const lower = fileUrl.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

export function isPdfUrl(fileUrl: string): boolean {
  return fileUrl.toLowerCase().endsWith('.pdf');
}

export function isImageUrl(fileUrl: string): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(fileUrl);
}

export async function extractPdfPlainText(fileUrl: string): Promise<string> {
  const buf = await readEvidenceFileBuffer(fileUrl);
  if (!buf) return '';
  try {
    const pdfParse = (await import('pdf-parse')).default as (
      b: Buffer,
    ) => Promise<{ text?: string }>;
    const { text } = await pdfParse(buf);
    return (text ?? '').trim().slice(0, MAX_TEXT);
  } catch {
    return '';
  }
}
