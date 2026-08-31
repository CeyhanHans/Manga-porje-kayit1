namespace MangaTrChromiumBackground {
declare const chrome: any;

type ExtensionMessage =
  | { type: 'START_PAGE_TRANSLATION' }
  | { type: 'CLEAR_OVERLAY' }
  | { type: 'FETCH_IMAGE'; url: string }
  | { type: 'CAPTURE_VISIBLE_TAB' }
  | { type: 'TRANSLATE_TEXTS'; texts: string[] }
  | { type: 'SET_DEEPL_KEY'; key: string }
  | { type: 'GET_TRANSLATOR_STATUS' };

const DEEPL_ENDPOINT = 'https://api-free.deepl.com/v2/translate';
const IMAGE_REFERRER_RULE_ID = 740001;

async function translateTexts(texts: string[], explicitKey?: string) {
  const key = explicitKey || (await chrome.storage.local.get('deeplApiKey')).deeplApiKey;
  if (!key) throw new Error('DeepL API anahtarı ayarlanmamış. Uzantı popup’ından anahtarı kaydedin.');
  const cleanTexts = texts.map((text) => String(text).trim()).filter(Boolean).slice(0, 50);
  if (!cleanTexts.length) return { translations: [] };
  const response = await fetch(DEEPL_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleanTexts, source_lang: 'EN', target_lang: 'TR' }),
  });
  if (!response.ok) {
    if (response.status === 403) throw new Error('DeepL API anahtarınız geçersiz veya kotanız dolmuş olabilir.');
    if (response.status === 456) throw new Error('DeepL aylık karakter kotanız doldu. Yeni ay başında sıfırlanır.');
    throw new Error(`DeepL çeviri isteği başarısız (${response.status}).`);
  }
  const payload = await response.json();
  const translations = Array.isArray(payload?.translations) ? payload.translations.map((item: any) => String(item?.text ?? '')) : [];
  if (translations.length !== cleanTexts.length) throw new Error('DeepL eksik çeviri sonucu döndürdü.');
  return { translations };
}

async function setDeepLKey(key: string) {
  const trimmed = String(key ?? '').trim();
  if (!/^[A-Za-z0-9-]+(?::fx)?$/.test(trimmed)) throw new Error('DeepL API anahtarı biçimi geçersiz.');
  await translateTexts(['Connection test.'], trimmed);
  await chrome.storage.local.set({ deeplApiKey: trimmed });
  return { configured: true };
}

async function fetchImage(url: string, pageUrl?: string) {
  if (url.startsWith('data:image/')) return { dataUrl: url };
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error(`OCR görsel URL protokolü desteklenmiyor (${parsed.protocol}).`);
  const validReferrer = pageUrl && /^https?:\/\//i.test(pageUrl) ? pageUrl : undefined;
  let referrerRuleInstalled = false;
  if (validReferrer && chrome.declarativeNetRequest?.updateSessionRules) {
    try {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [IMAGE_REFERRER_RULE_ID],
        addRules: [{
          id: IMAGE_REFERRER_RULE_ID,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [
              { header: 'Referer', operation: 'set', value: validReferrer },
              { header: 'Origin', operation: 'remove' },
            ],
          },
          condition: { requestDomains: [parsed.hostname], resourceTypes: ['xmlhttprequest', 'image', 'media', 'other'] },
        }],
      });
      referrerRuleInstalled = true;
    } catch (error) {
      console.warn('Görsel referer kuralı kurulamadı; normal istek denenecek.', error);
    }
  }
  let response: Response;
  try {
    response = await fetch(parsed.href, {
      credentials: 'omit',
      cache: 'no-store',
      referrer: validReferrer,
      referrerPolicy: 'strict-origin-when-cross-origin',
      headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
    });
  } finally {
    if (referrerRuleInstalled) await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [IMAGE_REFERRER_RULE_ID] }).catch(() => undefined);
  }
  if (!response.ok) throw new Error(response.status === 403 ? 'Görsel sunucusu erişimi reddetti (403).' : `OCR görseli alınamadı (${response.status}).`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Sunucu görsel yerine farklı bir içerik döndürdü.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  return { dataUrl: `data:${blob.type || 'image/png'};base64,${btoa(binary)}`, transport: 'background-fetch' };
}

async function sendToActiveTab(message: ExtensionMessage): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('Aktif sekme bulunamadı.');

  if (message.type === 'CLEAR_OVERLAY') {
    await chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id, message);
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender: any, sendResponse: (response: any) => void) => {
  if (message.type === 'FETCH_IMAGE') {
    fetchImage(message.url, sender?.tab?.url)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
    return true;
  }
  if (message.type === 'CAPTURE_VISIBLE_TAB') {
    if (!sender?.tab?.active || typeof sender.tab.windowId !== 'number') { sendResponse({ error: 'OCR ekran yakalama fallback’i yalnızca aktif sekmede çalışabilir.' }); return; }
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' })
      .then((dataUrl: string) => sendResponse({ dataUrl }))
      .catch((error: any) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
    return true;
  }
  if (message.type === 'TRANSLATE_TEXTS') {
    translateTexts(message.texts)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
    return true;
  }
  if (message.type === 'SET_DEEPL_KEY') {
    setDeepLKey(message.key)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
    return true;
  }
  if (message.type === 'GET_TRANSLATOR_STATUS') {
    chrome.storage.local.get('deeplApiKey')
      .then((value: any) => sendResponse({ configured: Boolean(value.deeplApiKey) }))
      .catch(() => sendResponse({ configured: false }));
    return true;
  }
  if (message.type !== 'START_PAGE_TRANSLATION' && message.type !== 'CLEAR_OVERLAY') return;
  return sendToActiveTab(message);
});
}

