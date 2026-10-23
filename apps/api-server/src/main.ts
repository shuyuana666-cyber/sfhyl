import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { JsonLoggerService } from './common/logging/json-logger.service';
import { parseCorsOrigins } from './config/environment';
import { LocalStorageProvider } from './infrastructure/storage/local-storage.provider';
import { APP_VERSION } from './version';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(JsonLoggerService);
  app.useLogger(logger);
  app.enableShutdownHooks();

  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const localRoot = app.get(LocalStorageProvider).getRoot();
  // Existing LOCAL media remain readable while new uploads use MinIO.
  app.useStaticAssets(localRoot, { prefix: '/uploads/' });
  if (config.get<string>('STORAGE_DRIVER', 'local') === 'local') {
    // Keep existing page media URLs working after switching their objects to disk.
    app.useStaticAssets(localRoot, { prefix: '/media/' });
  }
  app.enableCors({
    origin: parseCorsOrigins(config.get<string>('CORS_ORIGINS', '')),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Device-Id'],
    exposedHeaders: ['X-Request-Id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: false,
      stopAtFirstError: false,
    }),
  );

  const prefix = config.get<string>('API_PREFIX', 'api/v1').replace(/^\/+|\/+$/g, '');
  app.setGlobalPrefix(prefix, {
    exclude: ['health', 'health/live', 'health/ready'],
  });

  if (config.get<boolean>('SWAGGER_ENABLED', true)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SFHYL.CN Operations API')
      .setDescription('Vehicle, content, media, and administration API')
      .setVersion(APP_VERSION)
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  const port = config.get<number>('PORT', 3002);
  const host = config.get<string>('HOST', '127.0.0.1');
  await app.listen(port, host);
  logger.log({ event: 'application_started', address: `${host}:${port}`, prefix }, 'Bootstrap');
}

void bootstrap();
