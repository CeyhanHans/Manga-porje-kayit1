import { createWorker, OEM, PSM } from 'tesseract.js';
import { cleanAndGroupOcrLines, type RawOcrLine } from '../shared/ocr-cleanup.js';

declare const chrome: any;
declare const browser: any;

type OcrBox = { text: string; confidence: number; left: number; top: number; width: number; height: number; lineCount?: number };
type OcrParagraph = { lines?: RawOcrLine[] };
type OcrBlock = { paragraphs?: OcrParagraph[] };

const api = typeof browser !== 'undefined' ? browser : chrome;
let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    const base = api.runtime.getURL('');
    workerPromise = createWorker('eng', 1, {
      workerPath: `${base}ocr-worker.min.js`,
      corePath: `${base}ocr-core`,
      langPath: `${base}ocr-lang`,
      // Keep the worker on the extension-origin OCR frame, avoiding page-origin restrictions.
      workerBlobURL: false,
      logger: () => undefined
    }).then(async (worker) => {
      /* AGENT_GOREV9_BAŞLANGIÇ */
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_ocr_engine_mode: OEM.LSTM_ONLY,
        preserve_interword_spaces: '0',
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?'-:;() ",
        user_defined_dpi: '300',
      });
      /* AGENT_GOREV9_BİTİŞ */
      return worker;
    });
  }
  return workerPromise;
}

export async function recognizeDataUrl(dataUrl: string): Promise<OcrBox[]> {
  const worker = await getWorker();
  const source = new Image();
  source.src = dataUrl;
  await source.decode();
  const canvas = document.createElement('canvas');
  const scale = Math.min(1.6, 2200 / Math.max(source.naturalWidth, source.naturalHeight));
  canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('OCR canvası oluşturulamadı.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const result = await worker.recognize(canvas, {}, { blocks: true });
  const lines = (result.data.blocks ?? []).flatMap((block: OcrBlock) =>
    (block.paragraphs ?? []).flatMap((paragraph: OcrParagraph) => paragraph.lines ?? [])
  );
  const groups = cleanAndGroupOcrLines(lines);
  return groups.map((group) => {
    const rawText = group.lines.map((line) => line.text).join(' ');
    return {
      text: rawText,
      confidence: Math.min(...group.lines.map((line) => line.confidence)),
      left: group.bbox.x0 / scale,
      top: group.bbox.y0 / scale,
      width: (group.bbox.x1 - group.bbox.x0) / scale,
      height: (group.bbox.y1 - group.bbox.y0) / scale,
      lineCount: group.lines.length
    };
  });
}

export async function recognizeImage(image: HTMLImageElement): Promise<OcrBox[]> {
  const imageUrl = image.currentSrc || image.src;
  if (imageUrl.startsWith('data:image/')) return recognizeDataUrl(imageUrl);
  const fetched = await api.runtime.sendMessage({ type: 'FETCH_IMAGE', url: imageUrl });
  if (!fetched?.dataUrl) throw new Error('OCR görsel verisi alınamadı.');
  return recognizeDataUrl(fetched.dataUrl);
}

