// What this machine can run, decided before the renderer is made.
//
// `probeDevice()` makes a throwaway WebGL2 context and reads the graphics chip's name, then returns:
//   - ok: false when WebGL2 is missing or the browser is drawing in software (SwiftShader, llvmpipe, Microsoft
//     Basic Render): the game would be a slideshow, so the page shows a fallback screen instead
//   - tier: the quality to start on when the player has not picked one ('low' | 'medium' | 'high')
//
// The tier is a first guess. While driving, main.js steps quality down further if frames stay slow.

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|mesa offscreen/i;
// chips that run the full look comfortably
const STRONG = /apple m\d|apple gpu|geforce (rtx|gtx (9|1\d)\d\d)|rtx|radeon (rx|pro)|quadro|arc a\d/i;
// integrated chips: fine for medium on a newer laptop, low on an older or small one
const INTEGRATED = /intel|uhd|hd graphics|iris|radeon(\(tm\))? graphics|vega \d|mali|adreno|powervr|apple a\d/i;

function chipName(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
}

export function probeDevice() {
  let gl = null;
  try {
    const c = document.createElement('canvas');
    gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
  } catch { gl = null; }
  if (!gl) return { ok: false, reason: 'nowebgl', tier: 'low', chip: '' };

  const chip = chipName(gl);
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
  gl.getExtension('WEBGL_lose_context')?.loseContext();

  if (SOFTWARE.test(chip)) return { ok: false, reason: 'software', tier: 'low', chip };

  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;   // Chrome only; others report nothing, so assume a normal machine
  let tier;
  if (mem <= 2 || maxTex < 4096) tier = 'low';
  else if (STRONG.test(chip)) tier = 'high';
  else if (/iris xe|iris\(r\) xe|arc/i.test(chip)) tier = cores >= 8 ? 'medium' : 'low';
  else if (INTEGRATED.test(chip)) tier = cores >= 8 && mem >= 8 ? 'medium' : 'low';
  else tier = 'medium';   // unknown or masked name: the middle, and let the frame-time check move it
  return { ok: true, tier, chip };
}

export const QUALITY_STEPS = ['low', 'medium', 'high', 'ultra'];
export const lowerQuality = (q) => QUALITY_STEPS[Math.max(0, QUALITY_STEPS.indexOf(q) - 1)];
