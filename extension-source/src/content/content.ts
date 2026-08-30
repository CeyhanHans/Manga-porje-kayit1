/* AGENT_GOREV5_BAŞLANGIÇ */
type OcrCacheEntry = { regions: any[]; timestamp: number };
const MangaTrOcrCache = new Map<string, OcrCacheEntry>();
const OCR_CACHE_TTL_MS = 5 * 60 * 1000; // 5 dakika
const OCR_CACHE_MAX_SIZE = 50;

function getCachedOcr(url: string): OcrCacheEntry['regions'] | null {
  const entry = MangaTrOcrCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > OCR_CACHE_TTL_MS) {
    MangaTrOcrCache.delete(url);
    return null;
  }
  console.log('[MangaTR CACHE HIT]', url);
  return entry.regions;
}

function setCachedOcr(url: string, regions: any[]): void {
  if (url.startsWith('data:image/')) return; // data: URL'li görseller önbelleğe alınmaz
  if (MangaTrOcrCache.size >= OCR_CACHE_MAX_SIZE) {
    MangaTrOcrCache.delete(MangaTrOcrCache.keys().next().value as string);
  }
  MangaTrOcrCache.set(url, { regions, timestamp: Date.now() });
}
/* AGENT_GOREV5_BİTİŞ */

/* AGENT_GOREV1_BAŞLANGIÇ */
namespace MangaTrContent {
declare const chrome: any;
declare const browser: any;
declare const MangaTrCapture: { computeVisibleImageCrop: (imageRect: { left: number; top: number; width: number; height: number }, viewport: { width: number; height: number }, screenshot: { width: number; height: number }, natural: { width: number; height: number }) => { source: { x: number; y: number; width: number; height: number }; mapping: { naturalLeft: number; naturalTop: number; naturalPerPixelX: number; naturalPerPixelY: number } } | null };

const api = typeof browser !== 'undefined' ? browser : chrome;
type ExtensionMessage = { type: 'START_PAGE_TRANSLATION' } | { type: 'CLEAR_OVERLAY' };
type OcrBox = { text: string; confidence: number; left: number; top: number; width: number; height: number; lineCount?: number };
type OverlayState = { image: HTMLImageElement; boxes: OcrBox[]; node: HTMLElement; busy: boolean; queued: boolean; processed: boolean };

const ROOT_ID = 'manga-tr-overlay-root';
const STYLE_ID = 'manga-tr-style';
let enabled = false;
let frame = 0;
let pageObserver: MutationObserver | null = null;
let controller: AbortController | null = null;
let ocrFramePromise: Promise<HTMLIFrameElement> | null = null;
let ocrRequestId = 0;
const pendingOcr = new Map<string, { resolve: (boxes: OcrBox[]) => void; reject: (error: Error) => void }>();
const overlays = new Map<HTMLImageElement, OverlayState>();
const ocrQueue: OverlayState[] = [];
let queueRunning = false;
let activeOcrCount = 0;
const MAX_CONCURRENT_OCR = 3;
let ocrObserver: IntersectionObserver | null = null;
let captureScrollLock = false;
/* AGENT_GOREV5_BAŞLANGIÇ: eski TTL'siz/sınırsız ocrCache kaldırıldı, global MangaTrOcrCache kullanılıyor */
const translationCache = new Map<string, string>();

document.documentElement.dataset.mangaTrReady = 'true';

function extensionUrl(path: string) { return api.runtime.getURL(path); }
function extensionOrigin() { return extensionUrl('').replace(/\/$/, ''); }

function addStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* AGENT_GOREV3_BAŞLANGIÇ */
    #${ROOT_ID} { position:absolute; left:0; top:0; width:100%; min-height:100%; z-index:2147483647; pointer-events:none; }
    .manga-tr-region { position:absolute; display:flex; align-items:center; justify-content:center; box-sizing:border-box; padding:4px; border:0; outline:0; border-radius:5px; background:rgba(255,255,255,.98) !important; color:#111; font-family:"Arial Narrow","Roboto Condensed",Arial,sans-serif; font-weight:700; letter-spacing:0; line-height:1.06; text-align:center; text-shadow:none; white-space:pre-wrap; word-break:break-word; overflow:hidden; }
    /* AGENT_GOREV3_BİTİŞ */
    .manga-tr-close { position:fixed; pointer-events:auto; width:32px; height:32px; border:0; border-radius:16px; background:#211b3c; color:#fff; font-size:20px; cursor:pointer; box-shadow:0 2px 8px #0006; }
    .manga-tr-ocr-status { position:fixed; right:10px; bottom:10px; max-width:280px; padding:7px 10px; border-radius:7px; background:#211b3cdd; color:#fff; font:12px system-ui,sans-serif; }
  `;
  document.head.append(style);
}

function root(): HTMLElement {
  let node = document.getElementById(ROOT_ID);
  if (!node) {
    node = document.createElement('div');
    node.id = ROOT_ID;
    const close = document.createElement('button');
    close.className = 'manga-tr-close';
    close.textContent = '×';
    close.title = 'Overlay’i kapat';
    close.setAttribute('aria-label', 'Çeviri overlayini kapat');
    close.addEventListener('click', clearOverlays);
    node.append(close);
    document.documentElement.append(node);
  }
  return node;
}

function status(text: string) {
  const container = root();
  let node = container.querySelector<HTMLElement>('.manga-tr-ocr-status');
  if (!node) { node = document.createElement('div'); node.className = 'manga-tr-ocr-status'; container.append(node); }
  node.textContent = text;
}

function isMangaImage(image: HTMLImageElement): boolean {
  const rect = image.getBoundingClientRect();
  return image.isConnected && image.naturalWidth >= 300 && image.naturalHeight >= 300 && rect.width >= 220 && rect.height >= 220;
}

function isNearViewport(image: HTMLImageElement): boolean {
  const rect = image.getBoundingClientRect();
  const margin = innerHeight * 1.25;
  return rect.bottom > -margin && rect.top < innerHeight + margin;
}

function imageCacheKey(image: HTMLImageElement) {
  return `${image.currentSrc || image.src}|${image.naturalWidth}x${image.naturalHeight}`;
}

function getOcrFrame() {
  if (!ocrFramePromise) {
    ocrFramePromise = new Promise<HTMLIFrameElement>((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.src = extensionUrl('ocr-frame.html');
      frame.style.display = 'none';
      let settled = false;
      const ready = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener('message', onReady);
        resolve(frame);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener('message', onReady);
        frame.remove();
        ocrFramePromise = null;
        reject(error);
      };
      const timer = window.setTimeout(() => fail(new Error('Yerel OCR iframe’i hazır olmadı.')), 10000);
      const onReady = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || event.origin !== extensionOrigin()) return;
        if (event.data?.type !== 'MANGA_TR_OCR_READY') return;
        ready();
      };
      window.addEventListener('message', onReady);
      frame.onload = ready;
      frame.onerror = () => fail(new Error('Yerel OCR iframe’i başlatılamadı.'));
      document.documentElement.append(frame);
    });
  }
  return ocrFramePromise;
}

window.addEventListener('message', (event) => {
  const message = event.data;
  if (message?.type === 'MANGA_TR_OCR_READY') return;
  if (!message?.id || !String(message.type).startsWith('MANGA_TR_OCR_')) return;
  if (event.origin !== extensionOrigin()) return;
  const pending = pendingOcr.get(message.id);
  if (!pending) return;
  pendingOcr.delete(message.id);
  if (message.type === 'MANGA_TR_OCR_ERROR') pending.reject(new Error(message.message || 'Yerel OCR başarısız.'));
  else pending.resolve(message.boxes ?? []);
});

async function recognizeDataUrlLocally(dataUrl: string): Promise<OcrBox[]> {
  const frame = await getOcrFrame();
  const id = `ocr-${++ocrRequestId}`;
  const result = new Promise<OcrBox[]>((resolve, reject) => pendingOcr.set(id, { resolve, reject }));
  frame.contentWindow?.postMessage({ type: 'MANGA_TR_OCR', id, dataUrl }, extensionOrigin());
  const timeout = new Promise<OcrBox[]>((_, reject) => setTimeout(() => {
    pendingOcr.delete(id);
    reject(new Error('Yerel OCR zaman aşımına uğradı.'));
  }, 45000));
  return Promise.race([result, timeout]);
}

async function pageManagedDataUrl(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:image/')) return imageUrl;
  if (!imageUrl.startsWith('blob:')) return '';
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Blob görseli okunamadı (${response.status}).`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Blob görseli data URL’ye dönüştürülemedi.'));
    reader.readAsDataURL(blob);
  });
}

function waitForViewportPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 650))));
}

async function captureScreenshotImage(): Promise<HTMLImageElement> {
  let captured = await api.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
  if (String(captured?.error ?? '').includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
    await new Promise((resolve) => setTimeout(resolve, 850));
    captured = await api.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
  }
  if (captured?.error || !captured?.dataUrl) throw new Error(captured?.error || 'Sekme görüntüsü alınamadı.');
  const screenshot = new Image();
  screenshot.src = captured.dataUrl;
  await screenshot.decode();
  return screenshot;
}

async function recognizeScrolledScreenshot(image: HTMLImageElement): Promise<OcrBox[]> {
  if (!image.isConnected || image.naturalWidth <= 0 || image.naturalHeight <= 0) throw new Error('Görsel ekran yakalama için hazır değil.');
  const originalScroll = { x: scrollX, y: scrollY };
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tam görsel yakalama canvası oluşturulamadı.');

  let naturalY = 0;
  let captures = 0;
  captureScrollLock = true;
  try {
    while (naturalY < image.naturalHeight - 1) {
      let naturalX = 0;
      let completedRowBottom = image.naturalHeight;
      while (naturalX < image.naturalWidth - 1) {
        let crop: ReturnType<typeof MangaTrCapture.computeVisibleImageCrop> = null;
        let screenshot: HTMLImageElement | null = null;
        let rect = image.getBoundingClientRect();
        for (let reposition = 0; reposition < 10 && !crop; reposition += 1) {
          if (++captures > 120) throw new Error('Tam görsel ekran yakalama güvenlik sınırını aştı.');
          const before = image.getBoundingClientRect();
          if (before.width <= 0 || before.height <= 0) throw new Error('Görselin sayfadaki boyutu hesaplanamadı.');
          const documentLeft = before.left + scrollX;
          const documentTop = before.top + scrollY;
          const targetX = documentLeft + (naturalX / image.naturalWidth) * before.width - 16;
          const targetY = documentTop + (naturalY / image.naturalHeight) * before.height - 16;
          scrollTo({ left: Math.max(0, targetX), top: Math.max(0, targetY), behavior: 'instant' });
          await waitForViewportPaint();

          screenshot = await captureScreenshotImage();
          rect = image.getBoundingClientRect();
          const candidate = MangaTrCapture.computeVisibleImageCrop(
            { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
            { width: innerWidth, height: innerHeight },
            { width: screenshot.naturalWidth, height: screenshot.naturalHeight },
            { width: image.naturalWidth, height: image.naturalHeight },
          );
          if (candidate) {
            const candidateRight = candidate.mapping.naturalLeft + candidate.source.width * candidate.mapping.naturalPerPixelX;
            const candidateBottom = candidate.mapping.naturalTop + candidate.source.height * candidate.mapping.naturalPerPixelY;
            if (candidateRight > naturalX + 1 && candidateBottom > naturalY + 1) crop = candidate;
          }
        }
        if (!crop || !screenshot) {
          throw new Error(`Görsel ekran görüntüsünde görünür hale getirilemedi (rect=${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}; viewport=${innerWidth}x${innerHeight}; capture=${screenshot?.naturalWidth ?? 0}x${screenshot?.naturalHeight ?? 0}; scroll=${Math.round(scrollX)},${Math.round(scrollY)}).`);
        }

        const destinationLeft = crop.mapping.naturalLeft;
        const destinationTop = crop.mapping.naturalTop;
        const destinationWidth = crop.source.width * crop.mapping.naturalPerPixelX;
        const destinationHeight = crop.source.height * crop.mapping.naturalPerPixelY;
        context.drawImage(
          screenshot,
          crop.source.x,
          crop.source.y,
          crop.source.width,
          crop.source.height,
          destinationLeft,
          destinationTop,
          destinationWidth,
          destinationHeight,
        );

        const right = Math.min(image.naturalWidth, destinationLeft + destinationWidth);
        const bottom = Math.min(image.naturalHeight, destinationTop + destinationHeight);
        completedRowBottom = Math.min(completedRowBottom, bottom);
        if (right <= naturalX + 1) throw new Error('Görselin yatay ekran yakalaması ilerleyemedi.');
        naturalX = right >= image.naturalWidth - 1 ? image.naturalWidth : Math.max(naturalX + 1, right - 8);
      }
      if (completedRowBottom <= naturalY + 1) throw new Error('Görselin dikey ekran yakalaması ilerleyemedi.');
      naturalY = completedRowBottom >= image.naturalHeight - 1 ? image.naturalHeight : Math.max(naturalY + 1, completedRowBottom - 8);
    }
    return recognizeDataUrlLocally(canvas.toDataURL('image/png'));
  } finally {
    scrollTo({ left: originalScroll.x, top: originalScroll.y, behavior: 'instant' });
    await waitForViewportPaint();
    captureScrollLock = false;
  }
}

async function recognizeImageLocally(image: HTMLImageElement): Promise<OcrBox[]> {
  const imageUrl = image.currentSrc || image.src;
  try {
    let dataUrl = await pageManagedDataUrl(imageUrl);
    if (!dataUrl) {
      const fetched = await api.runtime.sendMessage({ type: 'FETCH_IMAGE', url: imageUrl });
      if (fetched?.error) throw new Error(fetched.error);
      dataUrl = fetched?.dataUrl ?? '';
    }
    if (!dataUrl.startsWith('data:image/')) throw new Error('OCR görsel verisi alınamadı veya görsel biçimi geçersiz.');
    return await recognizeDataUrlLocally(dataUrl);
  } catch (primaryError) {
    console.warn('Doğrudan görsel erişimi başarısız; ekran yakalama fallback’i deneniyor.', primaryError);
    return recognizeScrolledScreenshot(image);
  }
}

/* AGENT_2_BAŞLANGIÇ */
function mergeAdjacentBoxes(boxes: OcrBox[]): OcrBox[] {
  const sorted = [...boxes].sort((a, b) => a.top - b.top || a.left - b.left);
  const merged: OcrBox[] = [];
  for (const box of sorted) {
    const prev = merged[merged.length - 1];
    if (prev) {
      const prevBottom = prev.top + prev.height;
      const gap = box.top - prevBottom;
      const prevLineHeight = prev.height / Math.max(1, prev.lineCount ?? 1);
      const boxLineHeight = box.height / Math.max(1, box.lineCount ?? 1);
      const lineHeight = Math.max(prevLineHeight, boxLineHeight);
      const overlapLeft = Math.max(prev.left, box.left);
      const overlapRight = Math.min(prev.left + prev.width, box.left + box.width);
      const overlapWidth = overlapRight - overlapLeft;
      const minOverlap = Math.min(prev.width, box.width) * 0.45;
      if (gap >= -lineHeight * 0.4 && gap <= lineHeight * 1.6 && overlapWidth >= minOverlap) {
        const left = Math.min(prev.left, box.left);
        const top = Math.min(prev.top, box.top);
        const right = Math.max(prev.left + prev.width, box.left + box.width);
        const bottom = Math.max(prevBottom, box.top + box.height);
        merged[merged.length - 1] = {
          text: `${prev.text}\n${box.text}`,
          confidence: Math.min(prev.confidence, box.confidence),
          left,
          top,
          width: right - left,
          height: bottom - top,
          lineCount: (prev.lineCount ?? 1) + (box.lineCount ?? 1),
        };
        continue;
      }
    }
    merged.push({ ...box });
  }
  return merged;
}
/* AGENT_2_BİTİŞ */

async function translateBoxes(boxes: OcrBox[]): Promise<OcrBox[]> {
  /* AGENT_2_BAŞLANGIÇ */
  const sourceBoxes = mergeAdjacentBoxes(boxes);
  /* AGENT_2_BİTİŞ */
  const missing = Array.from(new Set(sourceBoxes.map((box) => box.text.trim()).filter((text) => text && !translationCache.has(text))));
  if (missing.length) {
    const response = await api.runtime.sendMessage({ type: 'TRANSLATE_TEXTS', texts: missing });
    if (response?.error) throw new Error(response.error);
    if (!Array.isArray(response?.translations) || response.translations.length !== missing.length) throw new Error('DeepL geçerli bir çeviri listesi döndürmedi.');
    missing.forEach((source, index) => translationCache.set(source, String(response.translations[index]).trim()));
  }
  return sourceBoxes.map((box) => ({ ...box, text: translationCache.get(box.text.trim()) ?? '' })).filter((box) => box.text);
}

function renderState(state: OverlayState) {
  const rect = state.image.getBoundingClientRect();
  state.node.replaceChildren();
  const visible = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  state.node.style.display = visible ? 'block' : 'none';
  if (!visible) return;
  const measure = document.createElement('canvas').getContext('2d');
  const fitText = (text: string, width: number, height: number, initialSize: number) => {
    /* AGENT_2_BAŞLANGIÇ */
    const segments = text.split('\n').map((segment) => segment.trim()).filter(Boolean);
    const words: string[] = [];
    for (const segment of segments) {
      const segmentWords = segment.split(/\s+/).filter(Boolean);
      segmentWords.forEach((word, index) => words.push(index === segmentWords.length - 1 ? `${word}\n` : word));
    }
    /* AGENT_2_BİTİŞ */
    let size = Math.max(10, Math.min(48, initialSize));
    let lines = [text];
    while (size >= 8) {
      if (measure) measure.font = `700 ${size}px Arial Narrow, Arial, sans-serif`;
      const next: string[] = [];
      let line = '';
      /* AGENT_2_BAŞLANGIÇ */
      for (const rawWord of words) {
        const word = rawWord.endsWith('\n') ? rawWord.slice(0, -1) : rawWord;
        const candidate = line ? `${line} ${word}` : word;
        if (measure && line && measure.measureText(candidate).width > width * 0.92) { next.push(line); line = word; }
        else line = candidate;
        if (rawWord.endsWith('\n')) { next.push(line); line = ''; }
      }
      /* AGENT_2_BİTİŞ */
      if (line) next.push(line);
      lines = next.length ? next : [text];
      const lineHeight = size * 1.06;
      if (lineHeight * lines.length <= height * 0.92) break;
      size -= 1;
    }
    return { text: lines.join('\n'), size: Math.max(8, size), lineHeight: Math.max(9, size * 1.06) };
  };
  for (const box of state.boxes) {
    const region = document.createElement('div');
    region.className = 'manga-tr-region';
    const scaleX = rect.width / state.image.naturalWidth;
    const scaleY = rect.height / state.image.naturalHeight;
    const sourceLineHeight = box.height / Math.max(1, box.lineCount ?? 1);
    const padX = Math.max(3, sourceLineHeight * 0.22);
    const padY = Math.max(2, sourceLineHeight * 0.16);
    const boxWidth = Math.max(24, Math.min(rect.width * 0.78, (box.width + padX * 2) * scaleX));
    const boxHeight = Math.max(18, Math.min(rect.height * 0.22, (box.height + padY * 2) * scaleY));
    const fit = fitText(box.text, boxWidth - 8, boxHeight - 4, sourceLineHeight * scaleY * 0.86);
    /* AGENT_GOREV3_BAŞLANGIÇ */
    const unclampedLeft = rect.left + scrollX + (box.left - padX) * scaleX;
    const unclampedTop = rect.top + scrollY + (box.top - padY) * scaleY;
    const documentRight = rect.right + scrollX;
    const documentBottom = rect.bottom + scrollY;
    Object.assign(region.style, {
      left: `${Math.max(rect.left + scrollX, Math.min(unclampedLeft, documentRight - boxWidth))}px`,
      top: `${Math.max(rect.top + scrollY, Math.min(unclampedTop, documentBottom - boxHeight))}px`,
      width: `${boxWidth}px`,
      height: `${boxHeight}px`,
      fontSize: `${fit.size}px`,
      lineHeight: `${fit.lineHeight}px`
    });
    /* AGENT_GOREV3_BİTİŞ */
    region.textContent = fit.text;
    state.node.append(region);
  }
}

function render() {
  if (!enabled) return;
  for (const state of overlays.values()) renderState(state);
  const close = root().querySelector<HTMLButtonElement>('.manga-tr-close');
  if (close) Object.assign(close.style, { left: `${Math.max(8, innerWidth - 44)}px`, top: '10px' });
}

function scheduleRender() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(render);
}

function filterEnglishOcrBoxes(boxes: OcrBox[]): OcrBox[] {
  return boxes.filter((box) => {
    const text = String(box.text ?? '').trim();
    const confidence = Number(box.confidence);
    const isAsciiWord = /^[A-Za-z0-9\s.,!?;:'"()\-]+$/.test(text);
    const isLongEnough = text.length >= 2;
    const hasReliableConfidence = Number.isFinite(confidence) && confidence >= 50;
    const hasRepeatedLetter = /(.)\1\1\1/i.test(text);
    if (!isAsciiWord || !isLongEnough || !hasReliableConfidence || hasRepeatedLetter) {
      console.warn('[MangaTR OCR FILTERED]', text, confidence);
      return false;
    }
    return true;
  });
}

async function processImage(image: HTMLImageElement, state: OverlayState) {
  if (state.busy || !enabled) return;
  state.queued = false;
  state.busy = true;
  try {
    status(`Yerel OCR çalışıyor: ${overlays.size - ocrQueue.length} / ${overlays.size} görsel`);
    const key = imageCacheKey(image);
    /* AGENT_GOREV5_BAŞLANGIÇ */
    const cached = getCachedOcr(key);
    const rawBoxes = filterEnglishOcrBoxes(cached ?? await recognizeImageLocally(image));
    if (!cached) setCachedOcr(key, rawBoxes);
    /* AGENT_GOREV5_BİTİŞ */
    if (!rawBoxes.length) throw new Error('Bu görselde güvenilir İngilizce metin bulunamadı.');
    status(`DeepL çeviriyor: ${rawBoxes.length} metin bölgesi`);
    state.boxes = await translateBoxes(rawBoxes);
    renderState(state);
    /* AGENT_GOREV5_BAŞLANGIÇ */
    state.image.dataset.mangaTrOverlayDone = '1';
    /* AGENT_GOREV5_BİTİŞ */
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('OCR/çeviri başarısız:', error);
    status(`Bu görsel işlenemedi: ${detail}`);
  } finally {
    state.busy = false;
    state.processed = true;
    activeOcrCount -= 1;
    queueRunning = activeOcrCount > 0;
    pumpQueue();
  }
}

function pumpQueue() {
  if (!enabled) return;
  while (activeOcrCount < MAX_CONCURRENT_OCR) {
    const next = ocrQueue.shift();
    if (!next) break;
    activeOcrCount += 1;
    queueRunning = true;
    void processImage(next.image, next);
  }
}
}
/* AGENT_GOREV1_BİTİŞ */

function queueImage(image: HTMLImageElement) {
  if (captureScrollLock) return;
  const state = overlays.get(image);
  /* AGENT_GOREV5_BAŞLANGIÇ */
  if (!state || !isMangaImage(image) || !isNearViewport(image) || state.busy || state.queued || state.processed || image.dataset.mangaTrOverlayDone === '1') return;
  /* AGENT_GOREV5_BİTİŞ */
  state.queued = true;
  ocrQueue.push(state);
  pumpQueue();
}

function queueVisibleImages() {
  for (const state of overlays.values()) if (isNearViewport(state.image)) queueImage(state.image);
}

function observeImage(image: HTMLImageElement) {
  ocrObserver?.observe(image);
}

function ensureOverlays() {
  const container = root();
  for (const image of Array.from(document.images)) {
    if (!isMangaImage(image) || overlays.has(image)) continue;
    const node = document.createElement('div');
    const state: OverlayState = { image, boxes: [], node, busy: false, queued: false, processed: false };
    overlays.set(image, state);
    container.append(node);
    observeImage(image);
  }
  queueVisibleImages();
  for (const [image, state] of overlays) {
    if (isMangaImage(image)) continue;
    state.node.remove();
    overlays.delete(image);
  }
}

function startPageTranslation() {
  clearOverlays();
  enabled = true;
  addStyle();
  ocrObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) queueImage(entry.target as HTMLImageElement);
  }, { rootMargin: '200px', threshold: 0.1 });
  ensureOverlays();
  controller = new AbortController();
  window.addEventListener('resize', scheduleRender, { passive: true, signal: controller.signal });
  window.addEventListener('scroll', scheduleRender, { passive: true, capture: true, signal: controller.signal });
  window.addEventListener('scroll', queueVisibleImages, { passive: true, capture: true, signal: controller.signal });
  document.addEventListener('load', scheduleRender, { capture: true, signal: controller.signal });
  pageObserver = new MutationObserver(() => { ensureOverlays(); scheduleRender(); });
  pageObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset', 'style', 'class', 'width', 'height'] });
  render();
}

function clearOverlays() {
  enabled = false;
  cancelAnimationFrame(frame);
  controller?.abort();
  controller = null;
  pageObserver?.disconnect();
  pageObserver = null;
  ocrObserver?.disconnect();
  ocrObserver = null;
  ocrQueue.length = 0;
  activeOcrCount = 0;
  queueRunning = false;
  captureScrollLock = false;
  for (const pending of pendingOcr.values()) pending.reject(new Error('OCR iptal edildi.'));
  pendingOcr.clear();
  document.querySelector<HTMLIFrameElement>('iframe[src$="/ocr-frame.html"]')?.remove();
  ocrFramePromise = null;
  /* AGENT_GOREV5_BAŞLANGIÇ: overlay kapatınca DOM işaretini temizle; OCR önbelleği (MangaTrOcrCache) bilerek korunur —
     kullanıcı çeviriyi tekrar açarsa cache hit ile OCR'sız hızlı render olur */
  for (const image of overlays.keys()) delete image.dataset.mangaTrOverlayDone;
  /* AGENT_GOREV5_BİTİŞ */
  for (const state of overlays.values()) state.node.remove();
  overlays.clear();
  document.getElementById(ROOT_ID)?.remove();
}

api.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === 'START_PAGE_TRANSLATION') startPageTranslation();
  if (message.type === 'CLEAR_OVERLAY') clearOverlays();
});
}
