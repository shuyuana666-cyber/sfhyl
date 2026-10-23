import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { ContentModule } from '../content/content.module';
import { ExchangeRatesService } from './exchange-rates.service';

@Module({
  imports: [ContentModule],
  controllers: [PublicController],
  providers: [ExchangeRatesService],
})
export class PublicModule {}
