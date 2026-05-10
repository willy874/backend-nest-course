import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { CategoryModel } from '../../models';

export const categoryResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export class CategoryResponseDto extends createZodDto(categoryResponseSchema) {}

export function toCategoryResponse(model: CategoryModel): z.infer<typeof categoryResponseSchema> {
  return {
    id: model.id,
    name: model.name,
    color: model.color,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
}
