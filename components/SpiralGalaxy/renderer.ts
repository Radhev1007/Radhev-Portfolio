// vgpu "Spiral Galaxy" example (npx vgpu examples pull spiral-galaxy, revision af8ab210).
// Portfolio change: the lil-gui settings panel is removed; the look keeps the example's defaults
// (lens flare, dirty glass and hover repel all on). With `text`, the stars settle into the words instead of
// the spiral (textField.ts), the view zooms out when the words would not fit, and the navy ambient glow is
// off so the band stays the page's black. Everything else is the
// example's own code.
import { clock, frameLoop, init, surface, type Gpu, type Surface } from 'vgpu';

import { createAnimation, type Animation } from './animation';
import { generateField, type StarField } from './field';
import { generateTextField } from './textField';
import { installFieldInput, type FieldInput } from './input';
import {
  bakeDirt,
  createEffects,
  createResources,
  createTargets,
  DEFAULT_LOOK,
  destroyTargets,
  prewarm,
  renderChain,
  setBindings,
  setLook,
  worldSize,
  stepSimulation,
  type Effects,
  type Resources,
  type Targets,
} from './pipeline';

interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  /** Portfolio addition: the stars form this text. On narrow canvases `narrowLines` is used instead. */
  readonly text?: { readonly lines: readonly string[]; readonly narrowLines?: readonly string[] };
}

interface RenderSize {
  width: number;
  height: number;
  dpr: number;
}

interface Settings {
  lensFlare: boolean;
  dirtyGlass: boolean;
  hoverRepel: boolean;
}

const MAX_DPR = 1.6;

function bestEffort(cleanup: () => void): void {
  try {
    cleanup();
  } catch {
    // Teardown must run to completion even when one step throws.
  }
}

export function createRenderer({ canvas, text }: RendererOptions) {
  let disposed = false;
  let gpu: Gpu | undefined;
  let canvasSurface: Surface | undefined;
  let field: StarField | undefined;
  let textBounds: { width: number; height: number } | undefined;
  let animation: Animation | undefined;
  let resources: Resources | undefined;
  let effects: Effects | undefined;
  let targets: Targets | undefined;
  let input: FieldInput | undefined;
  let observer: ResizeObserver | undefined;
  let resizeFrame = 0;
  let pendingSize: RenderSize | undefined;
  let pixelRatio = 1;
  let lastDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  const settings: Settings = {
    lensFlare: DEFAULT_LOOK.lensFlare.enabled,
    dirtyGlass: DEFAULT_LOOK.dirtyGlass.enabled,
    hoverRepel: true,
  };

  /** Zoom out (never in) until the text block fits the frame with a margin. */
  const fitScale = (size: readonly [number, number]) => {
    if (!textBounds) return 1;
    const [w, h] = worldSize(size, 1);
    return Math.max(1, textBounds.width / (0.88 * w), textBounds.height / (0.7 * h));
  };

  const applySettings = () => {
    if (disposed || !effects || !animation) return;
    setLook(effects, { lensFlare: settings.lensFlare, dirtyGlass: settings.dirtyGlass });
    animation.setRepel(settings.hoverRepel);
  };

  const applyResize = () => {
    resizeFrame = 0;
    const size = pendingSize;
    pendingSize = undefined;
    if (disposed || !size || !gpu || !effects || !targets || !resources || !animation || !canvasSurface) return;

    const width = Math.max(1, Math.round(size.width * size.dpr));
    const height = Math.max(1, Math.round(size.height * size.dpr));
    if (targets.scene.size[0] === width && targets.scene.size[1] === height && pixelRatio === size.dpr) return;

    try {
      const previousTargets = targets;
      const nextTargets = createTargets(gpu, [width, height]);
      try {
        pixelRatio = size.dpr;
        setBindings(effects, nextTargets, resources, {
          pixelRatio,
          repelRadius: animation.repelRadius,
          worldScale: fitScale([width, height]),
        });
      } catch (error) {
        destroyTargets(nextTargets);
        throw error;
      }
      targets = nextTargets;
      destroyTargets(previousTargets);
      // Repel offsets are in screen space; a new size invalidates them.
      animation.resetMotion();
    } catch (error) {
      fail(error);
    }
  };

  const resize = (size: RenderSize) => {
    if (disposed || size.width <= 0 || size.height <= 0) return;
    pendingSize = size;
    if (!resizeFrame) resizeFrame = requestAnimationFrame(applyResize);
  };

  const measure = () => {
    const rect = canvas.getBoundingClientRect();
    resize({
      width: rect.width,
      height: rect.height,
      dpr: Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1)),
    });
  };

  const onWindowResize = () => {
    if (window.devicePixelRatio === lastDpr) return;
    lastDpr = window.devicePixelRatio;
    measure();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    for (const cleanup of [
      () => observer?.disconnect(),
      () => {
        if (typeof window !== 'undefined') window.removeEventListener('resize', onWindowResize);
      },
      () => input?.dispose(),
      () => gpu?.dispose(),
    ]) {
      bestEffort(cleanup);
    }
  };

  const initialize = async () => {
    if (disposed) return;

    // The star draw reads the simulation output from a vertex-stage storage
    // buffer; compatibility-mode devices grant none unless asked.
    const nextGpu = await init({ requiredLimits: { maxStorageBuffersInVertexStage: 1 } });
    if (disposed) {
      nextGpu.dispose();
      return;
    }

    gpu = nextGpu;
    canvasSurface = surface(gpu, canvas, { dpr: [1, MAX_DPR] });
    pixelRatio = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (text) {
      // Draw the letters in the page's own font once it has loaded.
      await document.fonts?.ready;
      // dispose() already released the device if it ran while the fonts loaded.
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      const frame: [number, number] = [Math.max(1, rect.width), Math.max(1, rect.height)];
      const narrow = frame[0] / frame[1] < 1.15;
      const textField = generateTextField({
        lines: narrow && text.narrowLines ? text.narrowLines : text.lines,
        fontFamily: getComputedStyle(canvas).fontFamily || 'sans-serif',
        width: worldSize(frame, 1)[0] * (narrow ? 0.86 : 0.8),
        centerY: DEFAULT_LOOK.cameraY,
      });
      textBounds = textField.bounds;
      field = textField;
    } else {
      field = generateField();
    }
    animation = createAnimation(field, { reducedMotion });
    settings.hoverRepel = animation.repelEnabled;
    resources = createResources(gpu, field);
    effects = createEffects(gpu, field, resources);
    // Portfolio change: no navy ambient glow behind the text, so the band matches the page's black.
    if (text) effects.composite.set({ params: { ambientOpacity: 0 } });
    targets = createTargets(gpu, canvasSurface.size);
    setBindings(effects, targets, resources, {
      pixelRatio,
      repelRadius: animation.repelRadius,
      worldScale: fitScale(canvasSurface.size),
    });
    await prewarm(effects, targets, resources, canvasSurface);
    if (disposed) return;
    bakeDirt(gpu, effects, resources);
    applySettings();

    input = installFieldInput(canvas, animation);
    observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(canvas);
    window.addEventListener('resize', onWindowResize);
    measure();

    const gpuClock = clock(gpu);
    frameLoop(gpu, (currentFrame) => {
      if (disposed || !effects || !targets || !resources || !field || !animation || !canvasSurface) return;
      stepSimulation(currentFrame, effects, resources, field, animation, gpuClock.deltaTime);
      renderChain(currentFrame, effects, targets, canvasSurface);
    });
  };

  function fail(error: unknown): never {
    dispose();
    throw error;
  }

  const ready = initialize().catch((error: unknown) => {
    if (disposed) return;
    fail(error);
  });

  return { ready, resize, dispose };
}
