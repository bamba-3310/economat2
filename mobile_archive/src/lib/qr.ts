// QR payload format shared with the web app (src/lib/stock-engine.ts):
// labels encode `lecarre://lot/<CODE>` where CODE is the human lot code
// (LC-…), falling back to the numeric batch id for codeless lots.

const QR_PREFIX = "lecarre://lot/";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseLotQrValue(raw: string): { lotCode?: string; lotId?: number } {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  let payload = trimmed;
  if (trimmed.toLowerCase().startsWith(QR_PREFIX)) {
    payload = safeDecode(trimmed.slice(QR_PREFIX.length));
  }
  payload = payload.trim();
  if (!payload) return {};

  // Purely numeric payloads are treated as a batch id fallback.
  if (/^\d+$/.test(payload)) return { lotId: Number(payload), lotCode: payload };
  return { lotCode: payload };
}
