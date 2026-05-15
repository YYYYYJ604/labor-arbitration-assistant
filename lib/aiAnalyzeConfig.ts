/**
 * 是否对图片走多模态（OpenAI 兼容的 image_url）。
 * DeepSeek 等多数国内文本接口不支持，默认关闭；需显式开启。
 */
export function useMultimodalImageInput(): boolean {
  const v = process.env.AI_SUPPORTS_VISION?.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  const base = (process.env.AI_BASE_URL || '').toLowerCase();
  if (base.includes('deepseek')) return false;
  return false;
}
