import { createZodDto } from 'nestjs-zod';
import { createCategorySchema } from './create-category.dto';

export const updateCategorySchema = createCategorySchema.partial();

export class UpdateCategoryDto extends createZodDto(updateCategorySchema) {}
