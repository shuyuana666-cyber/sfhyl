import { Module } from '@nestjs/common';
import { FileValidationService } from './file-validation.service';
import { MediaController } from './media.controller';
import { MediaProcessingService } from './media-processing.service';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaProcessingService, FileValidationService],
})
export class MediaModule {}
