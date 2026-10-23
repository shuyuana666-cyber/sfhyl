import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Inquiry } from '@prisma/client';
import { JsonLoggerService } from '../common/logging/json-logger.service';

@Injectable()
export class InquiryNotificationService {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: JsonLoggerService,
  ) {}

  async notify(inquiry: Inquiry): Promise<void> {
    const emailEnabled = this.config.get<boolean>('INQUIRY_NOTIFICATION_EMAIL_ENABLED', false);
    const whatsappEnabled = this.config.get<boolean>('INQUIRY_NOTIFICATION_WHATSAPP_ENABLED', false);
    if (!emailEnabled && !whatsappEnabled) return;

    this.logger.warn(
      {
        event: 'inquiry_notification_adapter_not_configured',
        inquiryId: inquiry.id.toString(),
        emailEnabled,
        whatsappEnabled,
      },
      'InquiryNotification',
    );
  }
}
