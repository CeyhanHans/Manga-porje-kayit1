export type Polygon = readonly [number, number][];

export interface TranslationRegion {
  id: string;
  polygon: Polygon;
  text: string;
  confidence: number;
}

export interface TranslationResultV1 {
  schemaVersion: '2026-08-17.v1';
  image: { width: number; height: number };
  regions: TranslationRegion[];
}

export type ExtensionMessage =
  | { type: 'START_SELECTION' }
  | { type: 'CLEAR_OVERLAY' };

