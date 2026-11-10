import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brush, Camera, Eraser, ImagePlus, Pointer, RotateCcw, Undo2, X } from 'lucide-react';
import type { Color } from '@app/shared';
import { Button } from '@/components/ui/button';
import { readableOn } from '@/lib/color-utils';
import { brush, feather, floodSelect, recolor, type Pixels } from '@/lib/recolor';
import { loadSegmenter, segmenterSupported, type Embedding, type Segmenter } from '@/lib/segmenter';
import { cn } from '@/lib/utils';

const MAX_SIDE = 1024;
const MAX_HISTORY = 12;

type Mode = 'tap' | 'add' | 'erase';

/** Smart selection (SlimSAM model) progress. */
type Smart =
  | { state: 'loading'; percent: number | null }
  | { state: 'analyzing' }
  | { state: 'ready' }
  | { state: 'failed' };

export interface VisualizerResult {
  original: Blob;
  snapshot: Blob;
  colorId: string;
}

/** Load a photo, honouring its EXIF rotation, scaled so the long side is at most MAX_SIDE. */
async function loadScaled(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85),
  );

/**
 * Full-screen photo visualizer: choose a photo, tap the wall, see the chosen color applied.
 * Photo mode works on every phone; a live camera preview is planned for a later phase.
 */
export function Visualizer({
  colors,
  initialColorId,
  onDone,
  onCancel,
}: {
  colors: Color[];
  initialColorId: string | null;
  onDone: (result: VisualizerResult) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('request');
  const { t: tc } = useTranslation();
  const [base, setBase] = useState<{ canvas: HTMLCanvasElement; pixels: Pixels } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorId, setColorId] = useState<string | null>(initialColorId ?? colors[0]?.id ?? null);
  const [mode, setMode] = useState<Mode>('tap');
  const [tolerance, setTolerance] = useState(35);
  const [comparing, setComparing] = useState(false);
  const [version, setVersion] = useState(0); // bumps when the mask changes
  const [stats, setStats] = useState({ hasMask: false, canUndo: false });
  // "smart" = the SlimSAM model (needs a download and a moment to analyze the photo);
  // "quick" = the instant color-based selection, which is also the fallback.
  const [engine, setEngine] = useState<'smart' | 'quick'>(segmenterSupported() ? 'smart' : 'quick');
  const [smart, setSmart] = useState<Smart>({ state: 'loading', percent: null });
  const [selecting, setSelecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const segmenter = useRef<Segmenter | null>(null);
  const embedding = useRef<Embedding | null>(null);
  /** Bumped to cancel an analysis that is still running (new photo, switched to quick, closed). */
  const run = useRef(0);
  const view = useRef<HTMLCanvasElement>(null);
  const mask = useRef<Uint8Array | null>(null);
  const history = useRef<Uint8Array[]>([]);
  const stroke = useRef<{ active: boolean; moved: boolean; x: number; y: number }>({
    active: false,
    moved: false,
    x: 0,
    y: 0,
  });

  const color = useMemo(() => colors.find((c) => c.id === colorId) ?? null, [colors, colorId]);
  const { hasMask, canUndo } = stats;

  /** Call after changing the mask or history: redraws and refreshes the button states. */
  const commit = useCallback(() => {
    setVersion((v) => v + 1);
    setStats({
      hasMask: mask.current?.some((v) => v > 0) === true,
      canUndo: history.current.length > 0,
    });
  }, []);

  useEffect(
    () => () => {
      run.current++;
      embedding.current?.dispose();
    },
    [],
  );

  /** Load the model (first time only) and analyze the photo, so later taps are fast. */
  const startSmart = useCallback(async (canvas: HTMLCanvasElement) => {
    const id = ++run.current;
    setNotice(null);
    setSmart({ state: 'loading', percent: null });
    try {
      const seg = await loadSegmenter((percent) => {
        if (run.current === id) setSmart({ state: 'loading', percent });
      });
      if (run.current !== id) return;
      segmenter.current = seg;
      setSmart({ state: 'analyzing' });
      const emb = await seg.embed(canvas);
      if (run.current !== id) {
        emb.dispose();
        return;
      }
      embedding.current?.dispose();
      embedding.current = emb;
      setSmart({ state: 'ready' });
    } catch (err) {
      if (run.current !== id) return;
      console.error('Smart selection unavailable', err);
      setSmart({ state: 'failed' });
      setEngine('quick');
    }
  }, []);

  const useQuick = () => {
    run.current++; // stop waiting for the model
    setNotice(null);
    setEngine('quick');
  };

  const useSmart = () => {
    setEngine('smart');
    if (base) void startSmart(base.canvas);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const canvas = await loadScaled(file);
      const ctx = canvas.getContext('2d')!;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      mask.current = new Uint8Array(canvas.width * canvas.height);
      history.current = [];
      setBase({ canvas, pixels: { data: img.data, width: canvas.width, height: canvas.height } });
      commit();
      embedding.current?.dispose();
      embedding.current = null;
      if (engine === 'smart') void startSmart(canvas);
    } catch {
      setError(t('visualizer.loadFailed'));
    } finally {
      setBusy(false);
    }
  };

  // Draw: the original photo, or the photo with the soft-edged mask painted in the chosen color.
  useEffect(() => {
    const canvas = view.current;
    if (!canvas || !base || !mask.current) return;
    const { width: w, height: h } = base.pixels;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const hasSelection = mask.current.some((v) => v > 0);
    if (comparing || !color || !hasSelection) {
      ctx.drawImage(base.canvas, 0, 0);
      // Show the current selection as a light overlay until a color is applied.
      if (!comparing && hasSelection) {
        const sel = ctx.getImageData(0, 0, w, h);
        for (let i = 0; i < mask.current.length; i++) {
          if (mask.current[i]) {
            sel.data[i * 4] = sel.data[i * 4]! * 0.5 + 120;
            sel.data[i * 4 + 2] = sel.data[i * 4 + 2]! * 0.5 + 120;
          }
        }
        ctx.putImageData(sel, 0, 0);
      }
      return;
    }
    const soft = feather(mask.current, w, h, Math.max(1, Math.round(w / 500)));
    const out = recolor(base.pixels, soft, color.hex);
    ctx.putImageData(new ImageData(out.data as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  }, [base, color, comparing, version]);

  const pushHistory = () => {
    if (!mask.current) return;
    history.current.push(mask.current.slice());
    if (history.current.length > MAX_HISTORY) history.current.shift();
  };

  /** Pointer position in image pixels. */
  const toImage = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const c = e.currentTarget;
    return {
      x: Math.floor(((e.clientX - rect.left) / rect.width) * c.width),
      y: Math.floor(((e.clientY - rect.top) / rect.height) * c.height),
    };
  }, []);

  const paint = (x: number, y: number) => {
    if (!base || !mask.current) return;
    const { width: w, height: h } = base.pixels;
    brush(mask.current, w, h, x, y, Math.max(6, w * 0.025), mode === 'erase' ? 0 : 255);
    commit();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!base || !mask.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toImage(e);
    stroke.current = { active: true, moved: false, ...p };
    if (mode !== 'tap') {
      pushHistory();
      paint(p.x, p.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!stroke.current.active) return;
    const p = toImage(e);
    stroke.current.moved = true;
    if (mode !== 'tap') paint(p.x, p.y);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!stroke.current.active || !base || !mask.current) return;
    stroke.current.active = false;
    if (mode === 'tap' && !stroke.current.moved) {
      const p = toImage(e);
      if (engine === 'smart') {
        void smartTap(p.x, p.y);
        return;
      }
      const region = floodSelect(base.pixels, p.x, p.y, tolerance);
      pushHistory();
      for (let i = 0; i < region.length; i++) if (region[i]) mask.current[i] = 255;
      commit();
    }
  };

  /** Tap with the model: outline the tapped object and add it to the selection. */
  const smartTap = async (x: number, y: number) => {
    const seg = segmenter.current;
    const emb = embedding.current;
    if (smart.state !== 'ready' || !seg || !emb) {
      setNotice(t('visualizer.smart.waiting'));
      return;
    }
    setNotice(null);
    setSelecting(true);
    try {
      const region = await seg.select(emb, x, y);
      if (!mask.current) return;
      pushHistory();
      for (let i = 0; i < region.length; i++) if (region[i]) mask.current[i] = 255;
      commit();
    } catch (err) {
      console.error('Smart selection failed', err);
      setSmart({ state: 'failed' });
      setEngine('quick');
    } finally {
      setSelecting(false);
    }
  };

  const undo = () => {
    const prev = history.current.pop();
    if (prev) {
      mask.current = prev;
      commit();
    }
  };

  const reset = () => {
    if (!base) return;
    pushHistory();
    mask.current = new Uint8Array(base.pixels.width * base.pixels.height);
    commit();
  };

  const finish = async () => {
    if (!base || !view.current || !color) return;
    setBusy(true);
    try {
      // Make sure the visible canvas shows the painted result, not the "compare" view.
      setComparing(false);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const [original, snapshot] = await Promise.all([toBlob(base.canvas), toBlob(view.current)]);
      onDone({ original, snapshot, colorId: color.id });
    } catch {
      setError(t('visualizer.loadFailed'));
    } finally {
      setBusy(false);
    }
  };

  const modes: { key: Mode; icon: typeof Pointer; label: string }[] = [
    { key: 'tap', icon: Pointer, label: t('visualizer.tap') },
    { key: 'add', icon: Brush, label: t('visualizer.brushAdd') },
    { key: 'erase', icon: Eraser, label: t('visualizer.brushErase') },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('visualizer.title')}
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
    >
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-title">{t('visualizer.title')}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label={t('visualizer.cancel')}
          >
            <X />
          </Button>
        </div>

        {!base ? (
          <div className="flex flex-1 flex-col justify-center gap-4">
            <p className="text-body text-muted-foreground">{t('visualizer.disclaimer')}</p>
            <label className="inline-flex h-tap cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground">
              <Camera className="size-5" aria-hidden />
              {t('visualizer.take')}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
            <label className="inline-flex h-tap cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-card px-6 font-semibold">
              <ImagePlus className="size-5" aria-hidden />
              {t('visualizer.upload')}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
            {busy && (
              <p className="text-body-sm text-muted-foreground">{t('visualizer.working')}</p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-md bg-danger-soft px-4 py-3 text-body-sm text-danger"
              >
                {error}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-line bg-surface-200">
              <canvas
                ref={view}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => (stroke.current.active = false)}
                aria-label={t('visualizer.tapHint')}
                className={cn(
                  'block h-auto w-full select-none',
                  mode === 'tap'
                    ? 'cursor-pointer touch-manipulation'
                    : 'cursor-crosshair touch-none',
                )}
              />
            </div>
            <p className="text-body-sm text-muted-foreground" aria-live="polite">
              {notice ??
                (selecting
                  ? t('visualizer.smart.selecting')
                  : engine === 'smart' && smart.state === 'loading'
                    ? smart.percent != null && smart.percent > 0
                      ? t('visualizer.smart.loadingPercent', { percent: smart.percent })
                      : t('visualizer.smart.loading')
                    : engine === 'smart' && smart.state === 'analyzing'
                      ? t('visualizer.smart.analyzing')
                      : engine === 'quick' && smart.state === 'failed'
                        ? t('visualizer.smart.failed')
                        : hasMask
                          ? t('visualizer.tapMore')
                          : t('visualizer.tapHint'))}
            </p>
            {engine === 'smart' && (smart.state === 'loading' || smart.state === 'analyzing') && (
              <Button type="button" variant="outline" className="self-start" onClick={useQuick}>
                {t('visualizer.smart.useQuick')}
              </Button>
            )}
            {engine === 'quick' && segmenterSupported() && smart.state !== 'failed' && (
              <Button type="button" variant="ghost" className="self-start" onClick={useSmart}>
                {t('visualizer.smart.useSmart')}
              </Button>
            )}

            <div
              role="radiogroup"
              aria-label={t('visualizer.tap')}
              className="grid grid-cols-3 gap-2"
            >
              {modes.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={mode === key}
                  onClick={() => setMode(key)}
                  className={cn(
                    'inline-flex h-tap items-center justify-center gap-2 rounded-full border px-3 text-label',
                    mode === key ? 'border-transparent bg-brand-soft text-ink' : 'border-line',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            {mode === 'tap' && engine === 'quick' && (
              <label className="flex flex-col gap-1 text-label">
                {t('visualizer.tolerance')}
                <input
                  type="range"
                  min={5}
                  max={80}
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="w-full accent-[var(--brand-text)]"
                />
              </label>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={undo} disabled={!canUndo}>
                <Undo2 />
                {t('visualizer.undo')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} disabled={!hasMask}>
                <RotateCcw />
                {t('visualizer.reset')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!hasMask}
                onPointerDown={() => setComparing(true)}
                onPointerUp={() => setComparing(false)}
                onPointerLeave={() => setComparing(false)}
                onPointerCancel={() => setComparing(false)}
              >
                {t('visualizer.hold')}
              </Button>
            </div>

            <section aria-label={t('visualizer.color')} className="flex flex-col gap-2">
              <p className="text-label">
                {t('visualizer.color')}
                {color && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {[color.name, color.code].filter(Boolean).join(' · ')}
                  </span>
                )}
              </p>
              {colors.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">{t('colors.none')}</p>
              ) : (
                <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
                  {colors.map((c) => (
                    <li key={c.id} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setColorId(c.id)}
                        aria-pressed={c.id === colorId}
                        aria-label={[c.name, c.code].filter(Boolean).join(' ')}
                        className={cn(
                          'size-12 rounded-full border-2 text-caption',
                          c.id === colorId
                            ? 'border-ink ring-2 ring-ink ring-offset-2 ring-offset-background'
                            : 'border-line',
                        )}
                        style={{ backgroundColor: c.hex, color: readableOn(c.hex) }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-caption text-muted-foreground">{t('visualizer.disclaimer')}</p>
            {error && (
              <p
                role="alert"
                className="rounded-md bg-danger-soft px-4 py-3 text-body-sm text-danger"
              >
                {error}
              </p>
            )}
            <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-line bg-background px-4 py-3">
              <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                {tc('back')}
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => void finish()}
                disabled={!hasMask || !color || busy}
              >
                {t('visualizer.useThis')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
