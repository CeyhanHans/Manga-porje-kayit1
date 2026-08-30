import io

t = io.open(r'C:\Users\user\Documents\Codex\2026-08-30\850-companion-last-session-md\work\remote-review\Manga-porje-kayit1\extension-source\src\content\content.ts', encoding='utf-8').read()
checks = {
    'TS1 getCachedOcr tanimli': 'function getCachedOcr' in t,
    'TS2 setCachedOcr tanimli': 'function setCachedOcr' in t,
    'TS3 eski ocrCache yok': 'const ocrCache' not in t,
    'TS4 processImage entegre': 'const cached = getCachedOcr(key);' in t,
    'TS5 dataset isareti': "dataset.mangaTrOverlayDone = '1'" in t,
    'TS6 queueImage kontrolu': "dataset.mangaTrOverlayDone === '1'" in t,
    'TS7 clearOverlays temizligi': 'delete image.dataset.mangaTrOverlayDone;' in t,
    'TS8 AGENT_GOREV5 isaretleri': 'AGENT_GOREV5_BAŞLANGIÇ' in t and 'AGENT_GOREV5_BİTİŞ' in t,
    'TS9 TTL sabiti': 'OCR_CACHE_TTL_MS = 5 * 60 * 1000' in t,
    'TS10 MAX_SIZE sabiti': 'OCR_CACHE_MAX_SIZE = 50' in t,
    'TS11 data:URL engeli': "url.startsWith('data:image/')" in t,
}
ok = True
for k, v in checks.items():
    print(('PASS' if v else 'FAIL'), k)
    ok = ok and v
raise SystemExit(0 if ok else 1)
