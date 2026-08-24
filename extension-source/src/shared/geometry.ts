export interface Size { width: number; height: number; }
export interface Rect { left: number; top: number; width: number; height: number; }

export function contentRect(box: Rect, source: Size, fit: string): Rect {
  if (!source.width || !source.height) return box;
  const containScale = Math.min(box.width / source.width, box.height / source.height);
  const coverScale = Math.max(box.width / source.width, box.height / source.height);
  const scale = fit === 'cover' ? coverScale : fit === 'none' ? 1 : fit === 'fill' ? undefined : fit === 'scale-down' ? Math.min(1, containScale) : containScale;
  const width = scale === undefined ? box.width : source.width * scale;
  const height = scale === undefined ? box.height : source.height * scale;
  return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height };
}

export function polygonBounds(points: readonly [number, number][]): Rect {
  const xs = points.map(([x]) => x); const ys = points.map(([, y]) => y);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

export function mapSourceRect(bounds: Rect, source: Size, rendered: Rect): Rect {
  return { left: rendered.left + bounds.left / source.width * rendered.width, top: rendered.top + bounds.top / source.height * rendered.height, width: bounds.width / source.width * rendered.width, height: bounds.height / source.height * rendered.height };
}

