namespace MangaTrPopup {
declare const chrome: any;
declare const browser: any;
const api = typeof browser !== 'undefined' ? browser : chrome;
if (new URLSearchParams(location.search).get('reload') === '1') api.runtime.reload();
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const keyInput = document.querySelector<HTMLInputElement>('#deepl-key')!;
const startButton = document.querySelector<HTMLButtonElement>('#start')!;

/* DUZELTME_GOREV3_BAŞLANGIÇ: yüklü build kimliğini göster (commit kısa SHA + UTC zaman).
   chrome://extensions kartındaki version_name ve dist/chromium/build-info.json ile
   eşleşmeli; eşleşmiyorsa yanlış/eski klasör yükleniyor demektir. */
async function showBuildId() {
  const node = document.querySelector<HTMLElement>('#build');
  if (!node) return;
  try {
    const info = await (await fetch(api.runtime.getURL('build-info.json'))).json();
    node.textContent = `Build: ${info.buildId ?? 'bilinmiyor'}`;
  } catch {
    node.textContent = 'Build kimliği okunamadı (build-info.json yok — eski build).';
  }
}
/* DUZELTME_GOREV3_BİTİŞ */

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
  if (response?.error) { status.textContent = response.error; return; }
  keyInput.value = '';
  await refreshTranslatorStatus();
}

async function send(type: 'START_PAGE_TRANSLATION' | 'CLEAR_OVERLAY') {
  status.textContent = 'Hazırlanıyor…';
  try { await api.runtime.sendMessage({ type }); status.textContent = type === 'START_PAGE_TRANSLATION' ? 'Sayfadaki manga görselleri işleniyor.' : 'Overlay kapatıldı.'; }
  catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Manga Türkçe Overlay işlemi başlatılamadı:', error);
    status.textContent = `İşlem başlatılamadı: ${detail}`;
  }
}
/* DUZELTME_GOREV4_BAŞLANGIÇ: sayfa içi çalışmanın sonuç istatistiği — aktif sekmedeki content
   script'ten okunur (background değişikliği gerekmez). Kategori + adet gösterilir; ham hata
   yığını gösterilmez. Popup açık kaldığı sürece 2 saniyede bir tazelenir. */
const statsNode = document.querySelector<HTMLElement>('#stats');
const CATEGORY_LABELS: Record<string, string> = {
  translated: 'Çevrildi',
  skippedNoText: 'Metin yok (atlandı)',
  filteredNoise: 'Gürültü elendi',
  untranslated: 'Çevrilmedi',
  failedTechnical: 'Teknik hata',
};

function renderRunStats(stats: any) {
  if (!statsNode || !stats) return;
  const counts = stats.counts ?? {};
  const rows: string[] = [];
  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    if (counts[key]) rows.push(`${label}: ${counts[key]}`);
  }
  if (!rows.length) { statsNode.textContent = ''; return; }
  const done = Object.values(counts).reduce((sum: number, value: any) => sum + Number(value ?? 0), 0);
  const technical = stats.technical ?? {};
  const technicalLines = Object.entries(technical).map(([code, count]) => `${code}: ${count}`);
  statsNode.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = `İşlem sayacı (${done}/${stats.startedTotal ?? done})`;
  statsNode.append(title);
  const list = document.createElement('div');
  list.textContent = rows.join(' · ') + (stats.cached ? ` · Önbellekten: ${stats.cached}` : '');
  statsNode.append(list);
  if (technicalLines.length) {
    const errors = document.createElement('div');
    errors.className = 'err';
    errors.textContent = `Hata kırılımı — ${technicalLines.join(', ')}`;
    statsNode.append(errors);
  }
}

/* DUZELTME_GOREV5_BAŞLANGIÇ: tamamlanma mesajı alanı — yalnızca content script'in
   PROCESSING_COMPLETE mesajında ✓ görünür; iptalde "iptal edildi", işlem sırasında gizli. */
const completeNode = document.querySelector<HTMLElement>('#complete');
function setComplete(text: string, kind: 'ok' | 'cancel' | 'hide') {
  if (!completeNode) return;
  completeNode.textContent = text;
  completeNode.classList.remove('ok', 'cancel', 'hide');
  completeNode.classList.add(kind);
}
/* DUZELTME_GOREV5_BİTİŞ */

async function refreshRunStats() {
  if (!statsNode) return;
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { statsNode.textContent = ''; return; }
    const response = await api.tabs.sendMessage(tab.id, { type: 'GET_RUN_STATS' });
    renderRunStats(response?.stats);
    /* DUZELTME_GOREV5_BAŞLANGIÇ: yaşam durumu ayrı mesajla sorulur; sıfır görsel = completion yok */
    const lifecycle = await api.tabs.sendMessage(tab.id, { type: 'GET_RUN_LIFECYCLE' });
    applyLifecycle(lifecycle);
    /* DUZELTME_GOREV5_BİTİŞ */
  } catch {
    statsNode.textContent = '';
    setComplete('', 'hide');
  }
}

/* DUZELTME_GOREV5_BAŞLANGIÇ: content script'in yaşam bilgisini popup'a taşır.
   cancellation: kullanıcı overlay'i kapattı — ✓ yok.
   completion: PROCESSING_COMPLETE bir kez geldi, ✓ göster.
   inProgress: hiç ✓ yok. idle: boş. */
function applyLifecycle(lifecycle: any) {
  if (!lifecycle) { setComplete('', 'hide'); return; }
  if (lifecycle.completed && lifecycle.cancelled) setComplete('Çalışma iptal edildi.', 'cancel');
  else if (lifecycle.completed && lifecycle.runStartedTotal === 0) setComplete('Sayfada manga görseli bulunamadı.', 'hide');
  else if (lifecycle.completed) setComplete('✓ Tamamlandı.', 'ok');
  else setComplete('', 'hide');
}
/* DUZELTME_GOREV5_BİTİŞ */
setInterval(() => void refreshRunStats(), 2000);
/* DUZELTME_GOREV4_BİTİŞ */

document.querySelector('#save-key')!.addEventListener('click', () => void saveDeepLKey().catch((error) => { status.textContent = error instanceof Error ? error.message : String(error); }));
startButton.addEventListener('click', () => void send('START_PAGE_TRANSLATION'));
document.querySelector('#clear')!.addEventListener('click', () => void send('CLEAR_OVERLAY'));
void refreshTranslatorStatus().catch(() => { status.textContent = 'DeepL durumu okunamadı.'; startButton.disabled = true; });
void showBuildId();
void refreshRunStats();
}

