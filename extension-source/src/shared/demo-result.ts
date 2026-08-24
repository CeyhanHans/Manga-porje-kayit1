import type { TranslationResultV1 } from './types.js';

export const demoResult: TranslationResultV1 = {
  schemaVersion: '2026-08-17.v1',
  image: { width: 1000, height: 1400 },
  regions: [
    { id: 'demo-1', polygon: [[110, 130], [560, 130], [560, 350], [110, 350]], text: 'Merhaba! Bu bir Türkçe demo çevirisidir.', confidence: 0.98 },
    { id: 'demo-2', polygon: [[450, 790], [880, 790], [880, 1030], [450, 1030]], text: 'Gerçek OCR ve çeviri henüz bağlı değil.', confidence: 0.95 }
  ]
};

