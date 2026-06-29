import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Güvenlik header'ları (X-Frame-Options, X-Content-Type-Options, HSTS, vb.)
  // CSP'yi kapatıyoruz: varsayılan CSP, Swagger UI'nin CDN'den yüklediği
  // statik dosyaları engelliyor.
  app.use(helmet({ contentSecurityPolicy: false }));

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
  // Prod'da kapalı: kimlik doğrulaması olmadan tüm API şemasını (endpoint'ler,
  // DTO'lar) dışarıya ifşa etmemek için. Geliştirmede her zaman açık.
  const swaggerEnabled = process.env.NODE_ENV !== 'production';
  if (swaggerEnabled) {
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
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 İKYS Backend çalışıyor: http://localhost:${port}`);
  if (swaggerEnabled) {
    logger.log(`📚 API Dokümantasyonu: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
