export type Rect = { left: number; top: number; width: number; height: number };

export type CaptureCrop = {
  source: { x: number; y: number; width: number; height: number };
  mapping: { naturalLeft: number; naturalTop: number; naturalPerPixelX: number; naturalPerPixelY: number };
};

export function computeVisibleImageCrop(
  imageRect: Rect,
  viewport: { width: number; height: number },
  screenshot: { width: number; height: number },
  natural: { width: number; height: number },
): CaptureCrop | null {
  if (imageRect.width <= 0 || imageRect.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return null;
  const visibleLeft = Math.max(0, imageRect.left);
  const visibleTop = Math.max(0, imageRect.top);
  const visibleRight = Math.min(viewport.width, imageRect.left + imageRect.width);
  const visibleBottom = Math.min(viewport.height, imageRect.top + imageRect.height);
  if (visibleRight - visibleLeft < 40 || visibleBottom - visibleTop < 40) return null;
  const screenshotScaleX = screenshot.width / viewport.width;
  const screenshotScaleY = screenshot.height / viewport.height;
  return {
    source: {
      x: visibleLeft * screenshotScaleX,
      y: visibleTop * screenshotScaleY,
      width: (visibleRight - visibleLeft) * screenshotScaleX,
      height: (visibleBottom - visibleTop) * screenshotScaleY,
    },
    mapping: {
      naturalLeft: (visibleLeft - imageRect.left) * natural.width / imageRect.width,
      naturalTop: (visibleTop - imageRect.top) * natural.height / imageRect.height,
      naturalPerPixelX: natural.width / imageRect.width / screenshotScaleX,
      naturalPerPixelY: natural.height / imageRect.height / screenshotScaleY,
    },
  };
}

