import { ApiError, errorMessage, unwrap } from "./errors";
import { en, type MessageKey } from "./i18n/en";

const response = (status: number) => new Response(null, { status });
const t = (key: MessageKey) => en[key];

describe("unwrap", () => {
  it("returns data when present", () => {
    expect(unwrap({ data: 1, response: response(200) })).toBe(1);
  });

  it("keeps the problem detail", () => {
    const call = () =>
      unwrap({
        error: {
          title: "Invalid request",
          status: 400,
          detail: "Lap is after the flag.",
          code: "invalid",
        },
        response: response(400),
      });
    expect(call).toThrow(new ApiError(400, "invalid", "Lap is after the flag."));
  });
});

describe("errorMessage", () => {
  it("translates throttling, network and unexpected errors", () => {
    expect(() => unwrap({ error: {}, response: response(429) })).toThrow(ApiError);
    expect(errorMessage(new ApiError(429, "throttled", ""), t)).toBe(en["error.throttled"]);
    expect(errorMessage(new TypeError("Failed to fetch"), t)).toBe(en["error.network"]);
    expect(errorMessage(new ApiError(500, "unexpected", ""), t)).toBe(en["error.unexpected"]);
    expect(errorMessage(new ApiError(404, "not_found", "No session."), t)).toBe("No session.");
  });
});
