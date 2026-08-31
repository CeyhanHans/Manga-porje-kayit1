namespace MangaTrPopup {
declare const chrome: any;
declare const browser: any;
const api = typeof browser !== 'undefined' ? browser : chrome;
if (new URLSearchParams(location.search).get('reload') === '1') api.runtime.reload();
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const keyInput = document.querySelector<HTMLInputElement>('#deepl-key')!;
const startButton = document.querySelector<HTMLButtonElement>('#start')!;
const stats = document.querySelector<HTMLParagraphElement>('#stats')!;
const errorDetail = document.querySelector<HTMLPreElement>('#error-detail')!;

function friendlyError(error: unknown) {
  const text = String(error ?? 'Bilinmeyen hata.');
  if (text.includes('403')) return 'DeepL API anahtarınız geçersiz veya kotanız dolmuş.';
  if (text.includes('biçimi geçersiz')) return 'Anahtar formatı yanlış. Format: xxxx:fx (ücretsiz) veya xxxx (pro)';
  return text;
}

async function refreshTranslatorStatus() {
  const response = await api.runtime.sendMessage({ type: 'GET_TRANSLATOR_STATUS' });
  const configured = Boolean(response?.configured);
  startButton.disabled = !configured;
  status.textContent = configured ? 'DeepL bağlı. Çeviriye hazır.' : 'Önce DeepL API anahtarını kaydedin.';
}

async function saveDeepLKey() {
  const key = keyInput.value.trim();
  if (!key) { status.textContent = 'DeepL API anahtarını girin.'; return; }
  status.textContent = 'DeepL bağlantısı test ediliyor…';
  const response = await api.runtime.sendMessage({ type: 'SET_DEEPL_KEY', key });
  if (response?.error) { status.textContent = friendlyError(response.error); errorDetail.textContent = String(response.error); return; }
  keyInput.value = '';
  await refreshTranslatorStatus();
}

async function send(type: 'START_PAGE_TRANSLATION' | 'CLEAR_OVERLAY') {
  status.textContent = 'Hazırlanıyor…';
  try { await api.runtime.sendMessage({ type }); status.textContent = type === 'START_PAGE_TRANSLATION' ? 'Sayfadaki manga görselleri işleniyor.' : 'Overlay kapatıldı.'; }
  catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Manga Türkçe Overlay işlemi başlatılamadı:', error);
    status.textContent = `İşlem başlatılamadı: ${friendlyError(detail)}`;
    errorDetail.textContent = detail;
  }
}
api.runtime.onMessage.addListener((message: any) => {
  if (message?.type !== 'PROCESSING_COMPLETE') return;
  stats.textContent = `✓ ${Number(message.processed) || 0} görsel işlendi | ${Number(message.failed) || 0} hata | ${Number(message.cached) || 0} önbellekten`;
});
document.querySelector('#save-key')!.addEventListener('click', () => void saveDeepLKey().catch((error) => { status.textContent = error instanceof Error ? error.message : String(error); }));
startButton.addEventListener('click', () => void send('START_PAGE_TRANSLATION'));
document.querySelector('#clear')!.addEventListener('click', () => void send('CLEAR_OVERLAY'));
void refreshTranslatorStatus().catch(() => { status.textContent = 'DeepL durumu okunamadı.'; startButton.disabled = true; });
}

