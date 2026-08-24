export type RawOcrLine = {
  text?: string;
  confidence?: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
};

export type CleanOcrLine = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type OcrLineGroup = {
  lines: CleanOcrLine[];
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

const safeCorrections: Record<string, string> = {
  believcd: 'believed',
  remembcr: 'remember',
  tunnei: 'tunnel',
  phenornenon: 'phenomenon',
  peop1e: 'people',
};

export function cleanOcrText(text: string): string {
  const cleaned = text
    .replace(/\\[nr]/gi, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[|¦_=~<>\[\]{}]+/g, ' ')
    .replace(/[^A-Za-z0-9'’.,!?;:()\- ]+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned
    .split(/\s+/)
    .filter((token) => {
      const letters = token.replace(/[^A-Za-z]/g, '');
      return letters.length > 1 || /^(a|i)$/i.test(letters);
    })
    .map((token) => safeCorrections[token.toLowerCase()] ?? token)
    .join(' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

function horizontalGap(a: OcrLineGroup['bbox'], b: CleanOcrLine['bbox']) {
  return Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
}

function addLine(group: OcrLineGroup, line: CleanOcrLine) {
  group.lines.push(line);
  group.bbox.x0 = Math.min(group.bbox.x0, line.bbox.x0);
  group.bbox.y0 = Math.min(group.bbox.y0, line.bbox.y0);
  group.bbox.x1 = Math.max(group.bbox.x1, line.bbox.x1);
  group.bbox.y1 = Math.max(group.bbox.y1, line.bbox.y1);
}

export function cleanAndGroupOcrLines(lines: RawOcrLine[]): OcrLineGroup[] {
  const usable: CleanOcrLine[] = lines
    .filter((line) => (line.confidence ?? 0) >= 45 && line.bbox)
    .map((line) => ({
      text: cleanOcrText(line.text ?? ''),
      confidence: line.confidence ?? 0,
      bbox: line.bbox!,
    }))
    .filter((line) => /[A-Za-z]{2}/.test(line.text) && line.bbox.x1 > line.bbox.x0 && line.bbox.y1 > line.bbox.y0)
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);

  const groups: OcrLineGroup[] = [];
  for (const line of usable) {
    const lineHeight = line.bbox.y1 - line.bbox.y0;
    let best: OcrLineGroup | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const group of groups) {
      const averageHeight = group.lines.reduce((sum, item) => sum + item.bbox.y1 - item.bbox.y0, 0) / group.lines.length;
      const verticalGap = line.bbox.y0 - group.bbox.y1;
      const maxVerticalGap = Math.max(12, Math.max(lineHeight, averageHeight) * 1.35);
      const maxHorizontalGap = Math.max(16, Math.min(group.bbox.x1 - group.bbox.x0, line.bbox.x1 - line.bbox.x0) * 0.28);
      const xGap = horizontalGap(group.bbox, line.bbox);
      if (verticalGap < -Math.max(lineHeight, averageHeight) || verticalGap > maxVerticalGap || xGap > maxHorizontalGap) continue;
      const distance = Math.abs(verticalGap) + xGap;
      if (distance < bestDistance) { best = group; bestDistance = distance; }
    }
    if (best) addLine(best, line);
    else groups.push({ lines: [line], bbox: { ...line.bbox } });
  }
  return groups.map((group) => ({ ...group, lines: group.lines.sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0) }));
}

