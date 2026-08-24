namespace MangaTrBackground {
declare const chrome: any;
declare const browser: any;
const api = typeof browser !== 'undefined' ? browser : chrome;
type ExtensionMessage = { type: 'START_SELECTION' } | { type: 'CLEAR_OVERLAY' };

api.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type !== 'START_SELECTION' && message.type !== 'CLEAR_OVERLAY') return;
  return api.tabs.query({ active: true, currentWindow: true }).then(([tab]: any[]) => {
    if (!tab?.id) throw new Error('Aktif sekme bulunamadı.');
    if (message.type === 'CLEAR_OVERLAY') return api.tabs.sendMessage(tab.id, message).catch(() => undefined);
    return api.tabs.sendMessage(tab.id, message).catch(() => {
      throw new Error('Bu sayfada içerik scripti hazır değil. Sayfayı yenileyip tekrar deneyin.');
    });
  });
});
}

