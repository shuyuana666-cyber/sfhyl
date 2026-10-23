import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type CaptchaProvider = "disabled" | "turnstile" | "hcaptcha";

interface CaptchaVerificationResponse {
  success?: boolean;
}

const verifyUrls: Record<Exclude<CaptchaProvider, "disabled">, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  hcaptcha: "https://hcaptcha.com/siteverify",
};

@Injectable()
export class CaptchaService {
  constructor(private readonly config: ConfigService) {}

  async verify(token: string | undefined, remoteIp: string | null): Promise<void> {
    const provider = this.config.get<CaptchaProvider>(
      "CAPTCHA_PROVIDER",
      "disabled",
    );
    if (provider === "disabled") return;

    const responseToken = token?.trim();
    if (!responseToken)
      throw new BadRequestException("Captcha verification is required.");

    const secret = this.config.get<string>("CAPTCHA_SECRET", "");
    if (!secret)
      throw new ServiceUnavailableException("Captcha service is unavailable.");

    const body = new URLSearchParams({ secret, response: responseToken });
    if (remoteIp) body.set("remoteip", remoteIp);
    const url =
      this.config.get<string>("CAPTCHA_VERIFY_URL", "") || verifyUrls[provider];

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(
          this.config.get<number>("CAPTCHA_VERIFY_TIMEOUT_MS", 8000),
        ),
      });
    } catch {
      throw new ServiceUnavailableException("Captcha service is unavailable.");
    }
    if (!response.ok)
      throw new ServiceUnavailableException("Captcha service is unavailable.");

    let result: CaptchaVerificationResponse;
    try {
      result = (await response.json()) as CaptchaVerificationResponse;
    } catch {
      throw new ServiceUnavailableException("Captcha service is unavailable.");
    }
    if (!result.success)
      throw new BadRequestException("Captcha verification failed.");
  }
}
