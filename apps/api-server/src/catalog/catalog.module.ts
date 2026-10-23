import { Global, Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogQueryService } from './catalog-query.service';
import { CatalogService } from './catalog.service';

@Global()
@Module({
  controllers: [CatalogController],
  providers: [CatalogService, CatalogQueryService],
  exports: [CatalogService, CatalogQueryService],
})
export class CatalogModule {}
