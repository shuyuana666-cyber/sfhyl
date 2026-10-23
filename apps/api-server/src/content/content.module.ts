import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { HomepageDefaultImporterService } from './homepage-default-importer.service';
import { HomepageContentService } from './homepage-content.service';

@Module({
  controllers: [ContentController],
  providers: [
    ContentService,
    HomepageDefaultImporterService,
    HomepageContentService,
  ],
  exports: [HomepageContentService],
})
export class ContentModule {}
