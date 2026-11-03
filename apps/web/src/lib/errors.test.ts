import { ApiError, errorMessage, unwrap } from "./errors";

const response = (status: number) => new Response(null, { status });

describe("unwrap", () => {
  it("returns data when present", () => {
    expect(unwrap({ data: 1, response: response(200) })).toBe(1);
  });

  it("uses the problem detail as the message", () => {
    const call = () =>
      unwrap({
        error: {
          title: "Invalid request",
          status: 400,
          detail: "Stop lap is after the flag.",
          code: "invalid",
        },
        response: response(400),
      });
    expect(call).toThrow(new ApiError(400, "invalid", "Stop lap is after the flag."));
  });

  it("explains throttling", () => {
    expect(() => unwrap({ error: {}, response: response(429) })).toThrow(/Too many simulations/);
  });

  it("hides unexpected bodies behind a generic message", () => {
    expect(() => unwrap({ error: "boom", response: response(500) })).toThrow(
      "The API returned an unexpected response.",
    );
  });
});

describe("errorMessage", () => {
  it("never leaks non-API errors", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe("Could not reach the API.");
    expect(errorMessage(new ApiError(404, "not_found", "No session."))).toBe("No session.");
  });
});
