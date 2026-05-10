import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { DatabaseModule } from './database/database.module';
import { validateEnv } from './config/env.schema';
import { TodosController } from './controllers/todos.controller';
import { CategoriesController } from './controllers/categories.controller';
import { TodosService } from './services/todos.service';
import { CategoriesService } from './services/categories.service';
import { TodosRepository } from './repositories/todos.repository';
import { CategoriesRepository } from './repositories/categories.repository';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    DatabaseModule,
  ],
  controllers: [TodosController, CategoriesController],
  providers: [
    TodosService,
    CategoriesService,
    TodosRepository,
    CategoriesRepository,
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
