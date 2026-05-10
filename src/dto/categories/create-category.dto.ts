import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex like #RRGGBB')
    .nullable()
    .optional(),
});

export class CreateCategoryDto extends createZodDto(createCategorySchema) {}
