import { hasWebGL, resetWebGLCheck } from "./webgl";

describe("hasWebGL", () => {
  beforeEach(() => {
    resetWebGLCheck();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWebGLCheck();
  });

  it("answers from a WebGL context and remembers it", () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({} as RenderingContext);

    expect(hasWebGL()).toBe(true);
    expect(hasWebGL()).toBe(true);
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it("says no when the browser has no context or throws", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(hasWebGL()).toBe(false);

    resetWebGLCheck();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(hasWebGL()).toBe(false);
  });
});
