import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ContentStatus,
  InquirySource,
  InquiryStatus,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { JsonLoggerService } from "../common/logging/json-logger.service";
import { sanitizePlainText } from "../common/security/sanitize-plain-text";
import type { RequestMeta } from "../common/utils/request-meta";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { CaptchaService } from "./captcha.service";
import type { SubmitInquiryDto } from "./dto/submit-inquiry.dto";
import { InquiryNotificationService } from "./inquiry-notification.service";

const DEFAULT_DUPLICATE_WINDOW_MINUTES = 10;
const MILLISECONDS_PER_MINUTE = 60_000;

@Injectable()
export class PublicInquiryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: InquiryNotificationService,
    private readonly logger: JsonLoggerService,
    private readonly config: ConfigService,
    private readonly captcha: CaptchaService,
  ) {}

  async submit(
    dto: SubmitInquiryDto,
    meta: RequestMeta,
    referrer: string | null,
    customerId: bigint | null = null,
  ): Promise<{ submitted: true; reference: string }> {
    this.validateContact(dto);
    await this.captcha.verify(dto.captchaToken, meta.ipAddress);

    const vehicleId = dto.vehicleId ? BigInt(dto.vehicleId) : null;
    if (vehicleId) await this.validateVehicle(vehicleId);

    const clean = this.sanitizeSubmission(dto);
    const fingerprint = this.createFingerprint(clean, vehicleId, meta.ipAddress);
    await this.assertNotRecentlySubmitted(fingerprint);

    const inquiry = await this.prisma.inquiry.create({
      data: {
        vehicleId,
        customerId,
        ...clean,
        source: InquirySource.WEBSITE,
        status: InquiryStatus.NEW,
        fingerprint,
        clientIp: meta.ipAddress,
        userAgent: meta.userAgent,
        referrer: referrer?.slice(0, 2048) || null,
      },
    });

    void this.notifications.notify(inquiry).catch((error: unknown) => {
      this.logger.error(
        {
          event: "inquiry_notification_failed",
          inquiryId: inquiry.id.toString(),
          error: error instanceof Error ? error.message : String(error),
        },
        undefined,
        "InquiryNotification",
      );
    });

    return { submitted: true, reference: inquiry.id.toString() };
  }

  async customerInquiries(customerId: bigint): Promise<unknown> {
    return this.prisma.inquiry.findMany({
      where: { customerId, deletedAt: null },
      select: {
        id: true,
        name: true,
        message: true,
        status: true,
        createdAt: true,
        vehicle: {
          select: { stockNo: true, nameZh: true, nameEn: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  private validateContact(dto: SubmitInquiryDto): void {
    if (dto.website) throw new BadRequestException("询盘内容无效");
    if (!dto.email && !dto.phone && !dto.whatsapp) {
      throw new BadRequestException("邮箱、电话或 WhatsApp 至少填写一项");
    }
  }

  private async validateVehicle(vehicleId: bigint): Promise<void> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException("意向车辆不存在");
  }

  private sanitizeSubmission(dto: SubmitInquiryDto) {
    const clean = {
      name: sanitizePlainText(dto.name)!,
      country: sanitizePlainText(dto.country),
      companyName: sanitizePlainText(dto.companyName),
      phone: sanitizePlainText(dto.phone),
      whatsapp: sanitizePlainText(dto.whatsapp),
      email: dto.email?.trim().toLowerCase(),
      preferredLanguage: dto.preferredLanguage,
      message: sanitizePlainText(dto.message)!,
      sourcePage: sanitizePlainText(dto.sourcePage),
      utmSource: sanitizePlainText(dto.utmSource),
      utmMedium: sanitizePlainText(dto.utmMedium),
      utmCampaign: sanitizePlainText(dto.utmCampaign),
      utmTerm: sanitizePlainText(dto.utmTerm),
      utmContent: sanitizePlainText(dto.utmContent),
    };
    if (clean.name.length < 2 || clean.message.length < 5) {
      throw new BadRequestException("询盘内容无效");
    }
    return clean;
  }

  private createFingerprint(
    clean: ReturnType<PublicInquiryService["sanitizeSubmission"]>,
    vehicleId: bigint | null,
    ipAddress: string | null,
  ): string {
    return createHash("sha256")
      .update(
        [
          clean.email ?? "",
          clean.phone ?? "",
          clean.whatsapp ?? "",
          clean.message.toLowerCase(),
          vehicleId?.toString() ?? "",
          ipAddress ?? "",
        ].join("|"),
      )
      .digest("hex");
  }

  private async assertNotRecentlySubmitted(fingerprint: string): Promise<void> {
    const duplicateMinutes = this.config.get<number>(
      "INQUIRY_DUPLICATE_WINDOW_MINUTES",
      DEFAULT_DUPLICATE_WINDOW_MINUTES,
    );
    const duplicate = await this.prisma.inquiry.findFirst({
      where: {
        fingerprint,
        createdAt: {
          gte: new Date(Date.now() - duplicateMinutes * MILLISECONDS_PER_MINUTE),
        },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException("询盘已提交，请勿重复发送");
  }
}
