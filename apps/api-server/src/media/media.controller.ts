import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diskStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { requestMeta } from '../common/utils/request-meta';
import { CreateFolderDto } from './dto/create-folder.dto';
import { MediaQueryDto } from './dto/media-query.dto';
import { MediaUploadQueryDto } from './dto/media-upload-query.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { MediaService } from './media.service';
import { UpdateFolderDto, UpdateMediaDto } from './dto/update-media.dto';
import { MediaBatchActionDto } from './dto/media-batch-action.dto';

const uploadTempDirectory = join(tmpdir(), 'sfhyl-api-uploads');
const uploadOptions = {
  storage: diskStorage({
    destination: (_request, _file, callback) => {
      void mkdir(uploadTempDirectory, { recursive: true, mode: 0o700 })
        .then(() => callback(null, uploadTempDirectory))
        .catch((error: Error) => callback(error, uploadTempDirectory));
    },
    filename: (_request, _file, callback) => callback(null, randomUUID()),
  }),
  limits: {
    fileSize: 500 * 1024 * 1024,
    fieldNameSize: 100,
    fieldSize: 64 * 1024,
    fields: 10,
    files: 20,
    parts: 30,
    fieldNestingDepth: 2,
    fieldArrayIndexLimit: 20,
  },
};

@ApiTags('admin/media')
@ApiBearerAuth()
@Controller('admin/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @RequirePermissions('media:upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadMediaDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    if (!file) throw new BadRequestException('请选择上传文件');
    return this.media.upload(file, dto, actor.id, requestMeta(request));
  }

  @Post('upload-multiple')
  @RequirePermissions('media:upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 20, uploadOptions))
  uploadMany(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() dto: UploadMediaDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown[]> {
    return this.media.uploadMany(files ?? [], dto, actor.id, requestMeta(request));
  }

  @Get()
  @RequirePermissions('media:view')
  list(@Query() query: MediaQueryDto): Promise<unknown> {
    return this.media.list(query);
  }

  @Get('uploads')
  @RequirePermissions('media:view')
  listUploads(@Query() query: MediaUploadQueryDto): Promise<unknown> {
    return this.media.listUploads(query);
  }

  @Delete('uploads')
  @RequirePermissions('media:delete')
  clearUploads(@CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<{ affected: number }> {
    return this.media.clearUploads(actor.id, requestMeta(request));
  }

  @Post('batch-action')
  @RequirePermissions()
  batchAction(
    @Body() dto: MediaBatchActionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ affected: number }> {
    const permission = dto.action === 'MOVE' ? 'media:upload' : 'media:delete';
    if (!actor.permissions.includes(permission)) throw new ForbiddenException('权限不足');
    return this.media.batchAction(dto, actor.id, requestMeta(request));
  }

  @Get('folders')
  @RequirePermissions('media:view')
  folders(): Promise<unknown> {
    return this.media.folders();
  }

  @Post('folders')
  @RequirePermissions('media:upload')
  createFolder(
    @Body() dto: CreateFolderDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.media.createFolder(dto, actor.id, requestMeta(request));
  }

  @Patch('folders/:id')
  @RequirePermissions('media:upload')
  updateFolder(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: UpdateFolderDto, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<unknown> {
    return this.media.updateFolder(id, dto, actor.id, requestMeta(request));
  }

  @Delete('folders/:id')
  @RequirePermissions('media:delete')
  async removeFolder(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<{ deleted: true }> {
    await this.media.removeFolder(id, actor.id, requestMeta(request));
    return { deleted: true };
  }

  @Patch(':id')
  @RequirePermissions('media:upload')
  update(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: UpdateMediaDto, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<unknown> {
    return this.media.update(id, dto, actor.id, requestMeta(request));
  }

  @Post(':id/restore')
  @RequirePermissions('media:delete')
  restore(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<unknown> {
    return this.media.restore(id, actor.id, requestMeta(request));
  }

  @Delete(':id/permanent')
  @RequirePermissions('media:delete')
  async permanentlyRemove(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<{ deleted: true }> {
    await this.media.permanentlyRemove(id, actor.id, requestMeta(request));
    return { deleted: true };
  }

  @Delete(':id')
  @RequirePermissions('media:delete')
  async remove(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ deleted: true }> {
    await this.media.remove(id, actor.id, requestMeta(request));
    return { deleted: true };
  }
}
