/**
 * Reads protein / fat / carbs per 100 g from a photo of a nutrition label, on the phone (Tesseract, no server).
 * The OCR engine and Russian language data are downloaded on first use and then cached by the browser.
 */
export interface LabelMacros { protein: number | null; fat: number | null; carbs: number | null; kcal: number | null; text: string }

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

export async function readLabel(file: File, onProgress?: (pct: number) => void): Promise<LabelMacros> {
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
