import { Global, Module } from '@nestjs/common';
import { HomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';

@Global()
@Module({ controllers: [HomepageController], providers: [HomepageService], exports: [HomepageService] })
export class HomepageModule {}
