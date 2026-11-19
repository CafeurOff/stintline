/**
 * Whether this browser can draw WebGL. Asked once: creating contexts is costly and some
 * browsers cap how many can exist.
 */
let cached: boolean | null = null;

export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    cached = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    cached = false;
  }
  return cached;
}

/** Tests only: forget the answer. */
export function resetWebGLCheck(): void {
  cached = null;
}
