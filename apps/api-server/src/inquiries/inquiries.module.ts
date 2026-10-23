import { Module } from "@nestjs/common";
import { CaptchaService } from "./captcha.service";
import { InquiriesController } from "./inquiries.controller";
import { InquiryNotificationService } from "./inquiry-notification.service";
import { InquiriesService } from "./inquiries.service";
import { PublicInquiryService } from "./public-inquiry.service";

@Module({
  controllers: [InquiriesController],
  providers: [
    InquiriesService,
    PublicInquiryService,
    InquiryNotificationService,
    CaptchaService,
  ],
  exports: [InquiriesService, PublicInquiryService],
})
export class InquiriesModule {}
