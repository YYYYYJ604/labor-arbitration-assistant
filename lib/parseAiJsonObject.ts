/**
 * 从模型回复中尽量解析出单个 JSON 对象（兼容 Markdown 围栏、前后废话）。
 */
export function parseAiJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const tryParse = (s: string) => {
    const parsed = JSON.parse(s) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not a JSON object');
    }
    return parsed as Record<string, unknown>;
  };

  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(trimmed);
  if (fence) {
    try {
      return tryParse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }

  try {
    return tryParse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return tryParse(trimmed.slice(start, end + 1));
    }
    throw new Error('AI response is not a JSON object');
  }
}
