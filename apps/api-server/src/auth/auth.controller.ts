import { Body, Controller, Get, Headers, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user';
import { requestMeta } from '../common/utils/request-meta';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Administrator login' })
  login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<unknown> {
    return this.authService.login(dto, requestMeta(request), deviceId?.slice(0, 128));
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token' })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<unknown> {
    return this.authService.refresh(dto.refreshToken, requestMeta(request), deviceId?.slice(0, 128));
  }

  @ApiBearerAuth()
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto, @CurrentUser() user: AuthenticatedUser): Promise<{ revoked: true }> {
    await this.authService.logout(dto.refreshToken, user.id);
    return { revoked: true };
  }

  @ApiBearerAuth()
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<{ revoked: true }> {
    await this.authService.logoutAll(user.id);
    return { revoked: true };
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Record<string, unknown> {
    return this.authService.me(user);
  }

  @ApiBearerAuth()
  @Put('password')
  async password(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ changed: true }> {
    await this.authService.changePassword(user.id, dto);
    return { changed: true };
  }
}
