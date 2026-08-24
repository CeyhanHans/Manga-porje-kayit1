import test from 'node:test';
import assert from 'node:assert/strict';
import { computeVisibleImageCrop } from '../build/src/shared/capture-mapping.js';

test('visible screenshot crop maps back to natural image coordinates', () => {
  const crop = computeVisibleImageCrop(
    { left: 100, top: -200, width: 800, height: 1280 },
    { width: 1920, height: 953 },
    { width: 1920, height: 953 },
    { width: 800, height: 1280 },
  );
  assert.ok(crop);
  assert.deepEqual(crop.source, { x: 100, y: 0, width: 800, height: 953 });
  assert.equal(crop.mapping.naturalTop, 200);
  assert.equal(crop.mapping.naturalPerPixelX, 1);
  assert.equal(crop.mapping.naturalPerPixelY, 1);
});

test('off-screen image does not produce a screenshot crop', () => {
  assert.equal(computeVisibleImageCrop(
    { left: 100, top: 1200, width: 800, height: 1280 },
    { width: 1920, height: 953 },
    { width: 1920, height: 953 },
    { width: 800, height: 1280 },
  ), null);
});

