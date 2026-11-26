// Portfolio addition: a star field shaped like a line of text, in the same `StarField` format as
// field.ts, so the example's simulation, intro, drag rotation, hover repel and flares all run unchanged.
//
// The text is drawn once on a hidden 2D canvas in the page's own font; every star is placed on an inked
// pixel of it. Its layers are `isStatic`: the stars hold their place (no stroke flow, no core spin), so the
// example's converging intro gathers them out of the sky and settles them into the letters.

import {
  STAR_FLOATS,
  mulberry32,
  paletteColor,
  PALETTE,
  repelMass,
  writeStar,
  type LayerInfo,
  type StarField,
} from './field';

export interface TextFieldOptions {
  /** Lines of text, drawn centred one under the other. */
  readonly lines: readonly string[];
  /** CSS font-family the letters are drawn in. */
  readonly fontFamily: string;
  readonly fontWeight?: number;
  /** World-space width the widest line spans. */
  readonly width: number;
  /** World-space y of the text's centre (the camera's y, so it sits mid-frame). */
  readonly centerY: number;
  /** Stars that form the letters. */
  readonly stars?: number;
  readonly starSize?: number;
  /** Flare-carrying groups, split left to right across the text. */
  readonly groups?: number;
}

export interface TextStarField extends StarField {
  /** World-space size of the text block, so the view can zoom out until it fits. */
  readonly bounds: { readonly width: number; readonly height: number };
}

const FONT_PX = 220;

/** Inked pixels of the text, as [x, y] in canvas pixels, plus the drawn block's size. */
function rasterize(lines: readonly string[], font: string) {
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('Spiral Galaxy text needs a 2D canvas');
  probe.font = font;
  const lineHeight = FONT_PX * 1.08;
  const widths = lines.map((line) => probe.measureText(line).width);
  const width = Math.ceil(Math.max(...widths)) + 8;
  const height = Math.ceil(lineHeight * lines.length) + 8;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Spiral Galaxy text needs a 2D canvas');
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, width / 2, 4 + lineHeight * (i + 0.5)));

  const alpha = ctx.getImageData(0, 0, width, height).data;
  const inked: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[(y * width + x) * 4 + 3]! > 140) inked.push(x, y);
    }
  }
  if (inked.length === 0) throw new Error('Spiral Galaxy text drew no pixels');
  return { inked, width, height };
}

export function generateTextField(options: TextFieldOptions): TextStarField {
  const starCount = Math.max(200, Math.round(options.stars ?? 5200));
  const starSize = options.starSize ?? 1.35;
  const groups = Math.max(1, Math.min(options.groups ?? 5, 8));
  const font = `${options.fontWeight ?? 500} ${FONT_PX}px ${options.fontFamily}`;
  const { inked, width, height } = rasterize(options.lines, font);
  const scale = options.width / width;
  const pixels = inked.length / 2;

  // Same share of sky stars the example keeps after its intro.
  const backgroundCount = Math.ceil((0.12 * starCount) / 0.88);
  const total = starCount + backgroundCount;
  // Each group's sky share is rounded, so leave room for one extra star per group.
  const writer = { data: new Float32Array((total + groups) * STAR_FLOATS), index: 0 };
  const rand = mulberry32(0x6c657473);
  const colorRand = mulberry32(0x776f726b);

  // Letter stars, bucketed left to right; the middle bucket goes first so it carries the primary flare.
  const placed: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < starCount; i += 1) {
    const p = Math.floor(rand() * pixels);
    const px = inked[2 * p]! + rand() - 0.5;
    const py = inked[2 * p + 1]! + rand() - 0.5;
    placed.push({
      x: (px - width / 2) * scale,
      y: options.centerY + (height / 2 - py) * scale,
      z: (rand() + rand() - 1) * 0.18,
    });
  }
  const minX = -options.width / 2;
  const bucketOf = (x: number) => Math.min(groups - 1, Math.max(0, Math.floor(((x - minX) / options.width) * groups)));
  const middle = Math.floor(groups / 2);
  const order = [middle, ...Array.from({ length: groups }, (_, i) => i).filter((i) => i !== middle)];

  const layers: LayerInfo[] = [];
  order.forEach((bucket, layerIndex) => {
    const members = placed.filter((s) => bucketOf(s.x) === bucket);
    const sky = Math.round((backgroundCount * members.length) / starCount);
    let heroIndex = writer.index;
    let best = -Infinity;
    const first = writer.index;
    const count = members.length + sky;
    for (let i = 0; i < count; i += 1) {
      const isSky = i >= members.length;
      const s = members[i] ?? { x: 0, y: options.centerY, z: 0 };
      const bright = !isSky && rand() < 0.03;
      const scale = (bright ? 0.75 + 0.9 * rand() : 0.12 + rand() ** 2.4 * 0.62) * starSize;
      const brightness = bright ? 1.9 + 1.3 * rand() : 0.62 + 0.72 * rand();
      const index = writeStar(writer, {
        position: [s.x, s.y, s.z],
        layer: layerIndex,
        progress: rand(),
        across: 0,
        depth: 0,
        brightness,
        scale,
        opacity: 0.84 + 0.14 * rand(),
        twinklePhase: rand() * Math.PI * 2,
        twinkleRate: 0.65 + 0.7 * rand(),
        color: paletteColor(colorRand(), PALETTE),
        hero: 0,
        background: isSky ? 1 : 0,
      });
      if (!isSky && scale * brightness > best) {
        best = scale * brightness;
        heroIndex = index;
      }
    }
    // The brightest letter star of each group drives one of the example's flares.
    const h = heroIndex * STAR_FLOATS;
    writer.data[h + 8] = Math.max(writer.data[h + 8]!, 1.9 * starSize);
    writer.data[h + 7] = Math.max(writer.data[h + 7]!, 3);
    writer.data[h + 15] = 1;
    writer.data[h + 17] = repelMass(0.35 + 3.8 * writer.data[h + 8]!);
    layers.push({
      index: layerIndex,
      isCore: false,
      isStatic: true,
      strong: true,
      speed: 0,
      lag: 0.12 + 0.08 * layerIndex,
      sampleBase: 0,
      heroIndex,
      starCount: writer.index - first,
    });
  });

  return {
    count: writer.index,
    stars: writer.data.subarray(0, writer.index * STAR_FLOATS) as Float32Array<ArrayBuffer>,
    // Static layers never sample a path; one zeroed sample keeps the storage binding non-empty.
    paths: new Float32Array(4),
    layers,
    coreLayer: -1,
    bounds: { width: options.width, height: height * scale },
  };
}
