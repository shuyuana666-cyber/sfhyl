import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { Public } from "../common/decorators/public.decorator";
import { requestMeta } from "../common/utils/request-meta";
import { SubmitInquiryDto } from "../inquiries/dto/submit-inquiry.dto";
import { PublicInquiryService } from "../inquiries/public-inquiry.service";
import {
  CustomerLoginDto,
  CustomerProfileDto,
  CustomerRefreshDto,
  CustomerRegisterDto,
} from "./dto/customer-auth.dto";
import { CustomerAuthService } from "./customer-auth.service";

@Public()
@Controller("public/auth")
export class CustomerAuthController {
  constructor(
    private readonly customers: CustomerAuthService,
    private readonly adminAuth: AuthService,
    private readonly publicInquiries: PublicInquiryService,
  ) {}

  @Post("register")
  register(@Body() dto: CustomerRegisterDto, @Req() request: Request) {
    return this.customers.register(dto, requestMeta(request));
  }

  @Post("login")
  async login(
    @Body() dto: CustomerLoginDto,
    @Req() request: Request,
    @Headers("x-device-id") deviceId?: string,
  ): Promise<unknown> {
    try {
      const tokens = await this.adminAuth.login(dto, requestMeta(request), deviceId?.slice(0, 128));
      return { accountType: "admin", tokens };
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) throw error;

      return {
        accountType: "customer",
        tokens: await this.customers.login(dto, requestMeta(request), deviceId?.slice(0, 128)),
      };
    }
  }

  @Post("refresh")
  refresh(
    @Body() dto: CustomerRefreshDto,
    @Req() request: Request,
    @Headers("x-device-id") deviceId?: string,
  ) {
    return this.customers.refresh(dto.refreshToken, requestMeta(request), deviceId?.slice(0, 128));
  }

  @Post("logout")
  async logout(
    @Body() dto: CustomerRefreshDto,
    @Headers("authorization") authorization?: string,
  ) {
    const customer = await this.customer(authorization);
    await this.customers.logout(customer.id, dto.refreshToken);
    return { revoked: true };
  }

  @Get("me")
  async me(@Headers("authorization") authorization?: string) {
    return this.customers.profile(await this.customer(authorization));
  }

  @Put("me")
  async update(
    @Body() dto: CustomerProfileDto,
    @Headers("authorization") authorization?: string,
  ) {
    const customer = await this.customer(authorization);
    return this.customers.profile(await this.customers.updateProfile(customer, dto));
  }

  @Get("inquiries")
  async myInquiries(@Headers("authorization") authorization?: string) {
    const customer = await this.customer(authorization);
    return this.publicInquiries.customerInquiries(customer.id);
  }

  @Post("inquiries")
  async submitInquiry(
    @Body() dto: SubmitInquiryDto,
    @Req() request: Request,
    @Headers("authorization") authorization?: string,
  ) {
    const customer = await this.customer(authorization);
    const referrer = request.header("referer")?.slice(0, 2048) ?? null;
    return this.publicInquiries.submit(
      dto,
      requestMeta(request),
      referrer,
      customer.id,
    );
  }

  private customer(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("请先登录。");
    return this.customers.customerFromAccess(token);
  }
}
