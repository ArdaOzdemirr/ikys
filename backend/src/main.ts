import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger - API dokümantasyonu
  const config = new DocumentBuilder()
    .setTitle('İKYS API')
    .setDescription('İnsan Kaynakları Yönetim Sistemi REST API - CMMI Uyumlu')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Kimlik doğrulama')
    .addTag('personnel', 'Personel yönetimi')
    .addTag('attendance', 'Çalışma saatleri')
    .addTag('leave', 'İzin yönetimi')
    .addTag('payroll', 'Bordro')
    .addTag('recruitment', 'İşe alım')
    .addTag('kvkk', 'KVKK & Loglama')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 İKYS Backend çalışıyor: http://localhost:${port}`);
  logger.log(`📚 API Dokümantasyonu: http://localhost:${port}/api/docs`);
}
bootstrap();
