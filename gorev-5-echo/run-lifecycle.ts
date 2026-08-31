/* DUZELTME_GOREV5_BAŞLANGIÇ: run yaşam döngüsü (progress/completion) — saf modül.
   Her başlatmada benzersiz runId üretir; progress mesajları her görselde bir kez,
   completion yalnızca kuyruk boş + aktif iş=0 + tüm başlangıç görselleri nihai
   duruma geçtiğinde bir kez çıkar. Eski run'dan gelen mesajlar yeni run'ı
   bozamaz. runStats üzerine kurulur — categorize edilmiş sonuç sayımı zaten
   run-stats'ta tutuluyor. */
export type RunMessage =
  | { type: 'PROCESSING_PROGRESS'; runId: string; done: number; total: number; counts: Record<string, number>; cached: number }
  | { type: 'PROCESSING_COMPLETE'; runId: string; cancelled: boolean; counts: Record<string, number>; cached: number }
  | { type: 'RUN_CANCELLED'; runId: string };

type RunState = {
  runId: string;
  startedTotal: number;
  active: number;
  cancelled: boolean;
  completionEmitted: boolean;
  listeners: Set<(message: RunMessage) => void>;
};

export function createRunState(runId: string, startedTotal: number): RunState {
  return { runId, startedTotal: Math.max(0, Math.floor(startedTotal)), active: 0, cancelled: false, completionEmitted: false, listeners: new Set() };
}

export function subscribe(state: RunState, listener: (message: RunMessage) => void): () => void {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

function emit(state: RunState, message: RunMessage) {
  for (const listener of state.listeners) {
    try { listener(message); } catch { /* listener hatası kuyruğu durdurmaz */ }
  }
}

/* Sıradaki görseli aktif işe alır — runId eşleşmesi zorunlu (eski run'dan gelen
   çağrılar sessizce yok sayılır). Çağıran taraf her başlatmada aktif sayacını
   sıfırlar; bu fonksiyon yalnızca kuyruk yöneticisinin tuttuğu sayacı günceller. */
export function startWork(state: RunState, expectedRunId: string): boolean {
  if (state.cancelled || state.completionEmitted) return false;
  if (state.runId !== expectedRunId) return false;
  state.active += 1;
  return true;
}

export function cancel(state: RunState, expectedRunId: string): boolean {
  if (state.runId !== expectedRunId) return false;
  if (state.cancelled || state.completionEmitted) return false;
  state.cancelled = true;
  state.active = 0;
  emit(state, { type: 'RUN_CANCELLED', runId: state.runId });
  return true;
}

/* Görsel nihai kategorisine geçtiğinde çağrılır. done = toplam tamamlanan görsel
   (5 kategorinin toplamı, run-stats.doneTotal ile aynı). 6 zorunlu test senaryosu
   bu fonksiyonu çağıranın aktif=0 + done>=startedTotal koşulunu birlikte sağladığını
   doğrular — böylece completion bir kez tetiklenir. */
export function finishWork(state: RunState, expectedRunId: string, done: number, counts: Record<string, number>, cached: number): RunMessage | null {
  if (state.runId !== expectedRunId) return null;
  if (state.cancelled) return null;
  state.active = Math.max(0, state.active - 1);
  const progress: RunMessage = { type: 'PROCESSING_PROGRESS', runId: state.runId, done, total: state.startedTotal, counts: { ...counts }, cached };
  emit(state, progress);
  if (state.completionEmitted) return null;
  const ready = state.active === 0 && done >= state.startedTotal;
  if (!ready) return null;
  state.completionEmitted = true;
  const complete: RunMessage = { type: 'PROCESSING_COMPLETE', runId: state.runId, cancelled: false, counts: { ...counts }, cached };
  emit(state, complete);
  return complete;
}

/* Kuyruk iptal edildiğinde completion mesajı atılır ama cancelled=true ile.
   Popup ✓ göstermez. */
export function finishCancelled(state: RunState, expectedRunId: string, counts: Record<string, number>, cached: number): RunMessage | null {
  if (state.runId !== expectedRunId) return null;
  if (state.completionEmitted) return null;
  if (!state.cancelled) return null;
  state.completionEmitted = true;
  const complete: RunMessage = { type: 'PROCESSING_COMPLETE', runId: state.runId, cancelled: true, counts: { ...counts }, cached };
  emit(state, complete);
  return complete;
}

/* Listener 6 zorunlu test senaryosunu çalıştıran yardımcı: mesajları
   kayıt altına alır. Test, orderedRecords'in tam istediği desen olup
   olmadığını sınar. */
export function recordListener(records: RunMessage[]): (message: RunMessage) => void {
  return (message) => { records.push(message); };
}
/* DUZELTME_GOREV5_BİTİŞ */
