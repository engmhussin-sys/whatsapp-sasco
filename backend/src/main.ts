import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false });

  // ---- Static file serving for locally-stored uploads (voice messages, attachments) --
  // NOTE: Phase 1 dev default only. Swap StorageModule's provider to an
  // S3/GCS-backed implementation for production and remove this.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // ---- Security hardening -------------------------------------------------
  app.use(helmet());
  // NOTE: '*' is intentionally never used as a fallback here — the CORS spec
  // forbids a wildcard origin when `credentials: true` is set (browsers
  // silently reject it), so an unset CORS_ORIGIN falls back to explicit
  // local dev origins instead. Production (Railway) MUST set CORS_ORIGIN
  // explicitly — see .env.example and docs/deployment-guide.md.
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3001', 'http://localhost:3000'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');

  // ---- Validation -----------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ---- Global error shape + audit logging -----------------------------------
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new AuditInterceptor());

  // ---- API documentation ------------------------------------------------
  const config = new DocumentBuilder()
    .setTitle('WorkForce Connect AI API')
    .setDescription('Phase 1 MVP - Multi-tenant workforce messaging platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`WorkForce Connect AI API running on port ${port}`);
}
bootstrap();
