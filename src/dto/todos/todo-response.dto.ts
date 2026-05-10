import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { TodoModel } from '../../models';
import { categoryResponseSchema, toCategoryResponse } from '../categories/category-response.dto';

export const todoResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  isCompleted: z.boolean(),
  dueDate: z.coerce.date().nullable(),
  categories: z.array(categoryResponseSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export class TodoResponseDto extends createZodDto(todoResponseSchema) {}

export function toTodoResponse(model: TodoModel): z.infer<typeof todoResponseSchema> {
  return {
    id: model.id,
    title: model.title,
    description: model.description,
    isCompleted: model.isCompleted,
    dueDate: model.dueDate,
    categories: model.categories.map(toCategoryResponse),
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
}

export const listTodosQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  isCompleted: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export class ListTodosQueryDto extends createZodDto(listTodosQuerySchema) {}
