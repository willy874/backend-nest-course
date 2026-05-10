import { createZodDto } from 'nestjs-zod';
import { createTodoSchema } from './create-todo.dto';

export const updateTodoSchema = createTodoSchema.partial();

export class UpdateTodoDto extends createZodDto(updateTodoSchema) {}
