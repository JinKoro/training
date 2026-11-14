/**
 * Reads kcal and protein / fat / carbs per 100 g from a photo of a nutrition label. First a vision model on the
 * server (Cloudflare Workers AI, free daily quota) — it understands the table and picks the per-100 g column; if that
 * fails (quota, offline), on the phone with Tesseract, whose engine and Russian data are cached after first use.
 */
import { api } from './api';

export interface LabelMacros {
  protein: number | null; fat: number | null; carbs: number | null; kcal: number | null; text: string;
  /** Read by the server model only (on-phone OCR gives just the numbers). category = our sub-category id. */
  name?: string | null; brand?: string | null; barcode?: string | null; category?: string | null;
}

/** Downscale and grayscale the photo: faster OCR and fewer misreads on glossy packaging. */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.filter = 'grayscale(1) contrast(1.4)';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

/** The photo as a JPEG data URL, longest side 1600 px: small enough to upload fast, sharp enough for small print. */
async function toDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.85);
}

/** onProgress: -1 while the server reads the photo, then 0..100 if it falls back to on-phone OCR. */
export async function readLabel(file: File, onProgress?: (pct: number) => void): Promise<LabelMacros> {
  onProgress?.(-1);
  try {
    const { label } = await api<{ label: Omit<LabelMacros, 'text'> | null }>('POST', '/products/label', { image: await toDataUrl(file) });
    if (label && [label.protein, label.fat, label.carbs, label.kcal, label.name].some((v) => v != null)) return { ...label, text: '' };
  } catch { /* fall back to on-phone OCR */ }
  onProgress?.(0);
  // On-phone OCR is the fallback only; if it can't run (memory, engine download), report "nothing read", not an error.
  try { return await readLabelOnPhone(file, onProgress); }
  catch { return { protein: null, fat: null, carbs: null, kcal: null, text: '' }; }
}

async function readLabelOnPhone(file: File, onProgress?: (pct: number) => void): Promise<LabelMacros> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('rus+eng', 1, {
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100)); },
  });
  try {
    const { data } = await worker.recognize(await prepare(file));
    return { ...parseLabel(data.text), text: data.text };
  } finally {
    await worker.terminate();
  }
}

/** Finds the first number after each keyword ("белки 12,5 г", "Жиры: 3", "углеводы-60"). Exported for tests. */
export function parseLabel(raw: string): Omit<LabelMacros, 'text'> {
  const t = raw.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ')
    // OCR often reads Latin look-alikes inside Russian words
    .replace(/[a-z]/g, (ch) => ({ a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н' } as Record<string, string>)[ch] ?? ch);
  const after = (re: RegExp) => {
    const m = t.match(new RegExp(`(?:${re.source})` + String.raw`[^0-9]{0,24}?(\d{1,3}(?:[.,]\d{1,2})?)`));
    if (!m) return null;
    const v = Number(m[1].replace(',', '.'));
    return Number.isFinite(v) && v <= 100 ? Math.round(v * 10) / 10 : null;
  };
  // "250 ккал" / "1046 кДж / 250 kcal" (kcal reads as «ксаl» after the look-alike swap); else "ккал: 250".
  const kc = t.match(/(?:^|[^\d.,])(\d{1,3}(?:[.,]\d{1,2})?)\s*к[кс]а[лl]/) ?? t.match(/к[кс]а[лl][^0-9]{0,12}?(\d{1,3}(?:[.,]\d{1,2})?)/);
  const kv = kc ? Number(kc[1].replace(',', '.')) : NaN;
  const kcal = Number.isFinite(kv) && kv <= 900 ? Math.round(kv * 10) / 10 : null;
  return { protein: after(/белк|белок/), fat: after(/жир/), carbs: after(/углевод/), kcal };
}
