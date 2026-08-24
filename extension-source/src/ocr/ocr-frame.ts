import { recognizeDataUrl } from './ocr.js';

window.addEventListener('message', async (event) => {
  if (event.data?.type !== 'MANGA_TR_OCR') return;
  try {
    const boxes = await recognizeDataUrl(event.data.dataUrl);
    (event.source as Window | null)?.postMessage({ type: 'MANGA_TR_OCR_RESULT', id: event.data.id, boxes }, '*');
  } catch (error) {
    (event.source as Window | null)?.postMessage({ type: 'MANGA_TR_OCR_ERROR', id: event.data.id, message: error instanceof Error ? error.message : String(error) }, '*');
  }
});

window.parent.postMessage({ type: 'MANGA_TR_OCR_READY' }, '*');

