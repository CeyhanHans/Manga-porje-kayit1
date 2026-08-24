import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanOcrText, cleanAndGroupOcrLines } from '../build/src/shared/ocr-cleanup.js';

test('OCR cleanup removes literal escapes and manga OCR debris', () => {
  assert.equal(cleanOcrText('\\n || I WAS _ ALONE <> IN MY ROOM \\n'), 'I WAS ALONE IN MY ROOM');
});

test('nearby OCR lines are grouped but distant lines stay separate', () => {
  const groups = cleanAndGroupOcrLines([
    { text: 'I WAS ALONE', confidence: 91, bbox: { x0: 100, y0: 100, x1: 220, y1: 120 } },
    { text: 'IN MY ROOM', confidence: 88, bbox: { x0: 105, y0: 126, x1: 215, y1: 146 } },
    { text: 'NEXT BUBBLE', confidence: 90, bbox: { x0: 400, y0: 400, x1: 540, y1: 422 } },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].lines.map((line) => line.text), ['I WAS ALONE', 'IN MY ROOM']);
});

test('low-confidence OCR garbage is rejected', () => {
  const groups = cleanAndGroupOcrLines([
    { text: 'ARN NR <>', confidence: 24, bbox: { x0: 0, y0: 0, x1: 80, y1: 20 } },
  ]);
  assert.equal(groups.length, 0);
});

