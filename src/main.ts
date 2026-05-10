import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { patchNestJsSwagger } from 'nestjs-zod';
import { AppModule } from './app.module';
import type { EnvConfig } from './config/env.schema';

async function bootstrap() {
  patchNestJsSwagger();

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<EnvConfig, true>);
  const port = config.get('PORT', { infer: true });

  app.enableCors();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Backend Nest Course - Todo API')
    .setDescription('Teaching project: NestJS + Drizzle + Zod + Swagger (Todo with Categories M:N)')
    .setVersion('0.1.0')
    .addTag('todos')
    .addTag('categories')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  Logger.log(`🚀 App running on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap();
