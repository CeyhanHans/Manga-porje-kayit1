import test from 'node:test';
import assert from 'node:assert/strict';
import { contentRect, mapSourceRect } from '../build/src/shared/geometry.js';

test('contain letterbox area is centered', () => {
  assert.deepEqual(contentRect({ left: 0, top: 0, width: 300, height: 300 }, { width: 100, height: 200 }, 'contain'), { left: 75, top: 0, width: 150, height: 300 });
});

test('cover keeps source mapping proportional', () => {
  const rendered = contentRect({ left: 10, top: 20, width: 300, height: 200 }, { width: 100, height: 100 }, 'cover');
  assert.deepEqual(mapSourceRect({ left: 25, top: 25, width: 50, height: 50 }, { width: 100, height: 100 }, rendered), { left: 85, top: 45, width: 150, height: 150 });
});

