import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  isCompleted: z.boolean().optional().default(false),
  dueDate: z.coerce.date().nullable().optional(),
  categoryIds: z.array(z.string().uuid()).optional().default([]),
});

export class CreateTodoDto extends createZodDto(createTodoSchema) {}
