import { PDFDocument } from 'pdf-lib';

const MAX_EDGE = 8000;

/** 将位图统一为 PNG 字节并控制最大边长，避免超大截图撑爆画布 */
async function toPngBytes(file: File): Promise<{ data: Uint8Array; w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height, 1));
  const w = Math.max(1, Math.floor(bmp.width * scale));
  const h = Math.max(1, Math.floor(bmp.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  ctx.drawImage(bmp, 0, 0, bmp.width, bmp.height, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片编码失败'))), 'image/png');
  });
  const data = new Uint8Array(await blob.arrayBuffer());
  return { data, w, h };
}

/**
 * 浏览器端：单张图片 → 单页 PDF，便于服务端从 PDF 提取文字。
 */
export async function imageFileToPdfFile(file: File): Promise<File> {
  const pdfDoc = await PDFDocument.create();

  if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
    const jpg = await file.arrayBuffer();
    const img = await pdfDoc.embedJpg(jpg);
    const page = pdfDoc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  } else {
    const { data, w, h } = await toPngBytes(file);
    const img = await pdfDoc.embedPng(data);
    const page = pdfDoc.addPage([w, h]);
    page.drawImage(img, { x: 0, y: 0, width: w, height: h });
  }

  const out = await pdfDoc.save();
  const stem = file.name.replace(/\.[^/.]+$/, '').trim() || '证据材料';
  const copy = Uint8Array.from(out);
  return new File([copy], `${stem}.pdf`, { type: 'application/pdf' });
}
