import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CaptchaService } from "./captcha.service";

function service(values: Record<string, unknown>): CaptchaService {
  return new CaptchaService({
    get: <T>(key: string, fallback?: T): T =>
      (values[key] === undefined ? fallback : values[key]) as T,
  } as ConfigService);
}

describe("CaptchaService", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("does not require a token while disabled", async () => {
    globalThis.fetch = jest.fn();
    await expect(service({ CAPTCHA_PROVIDER: "disabled" }).verify(undefined, null)).resolves.toBeUndefined();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects a missing token when a provider is enabled", async () => {
    await expect(
      service({ CAPTCHA_PROVIDER: "turnstile", CAPTCHA_SECRET: "secret" }).verify(undefined, null),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("posts the token to the selected provider", async () => {
    const fetchMock = jest
      .fn<Promise<Response>, [input: RequestInfo | URL, init?: RequestInit]>()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);
    globalThis.fetch = fetchMock;
    await expect(
      service({
        CAPTCHA_PROVIDER: "hcaptcha",
        CAPTCHA_SECRET: "secret",
        CAPTCHA_VERIFY_TIMEOUT_MS: 1000,
      }).verify("token-value", "127.0.0.1"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hcaptcha.com/siteverify",
      expect.objectContaining({ method: "POST" }),
    );
    const body = fetchMock.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(URLSearchParams);
    if (!(body instanceof URLSearchParams)) throw new Error("Expected form body");
    expect(body.toString()).toContain("response=token-value");
  });

  it("fails closed when verification fails", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    });
    await expect(
      service({ CAPTCHA_PROVIDER: "turnstile", CAPTCHA_SECRET: "secret" }).verify("bad", null),
    ).rejects.toBeInstanceOf(BadRequestException);
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false });
    await expect(
      service({ CAPTCHA_PROVIDER: "turnstile", CAPTCHA_SECRET: "secret" }).verify("bad", null),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
