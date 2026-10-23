import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InquiriesModule } from "../inquiries/inquiries.module";
import { CustomerAuthController } from "./customer-auth.controller";
import { CustomerAuthService } from "./customer-auth.service";
@Module({ imports: [AuthModule, InquiriesModule], controllers: [CustomerAuthController], providers: [CustomerAuthService], exports: [CustomerAuthService] }) export class CustomerAuthModule {}
