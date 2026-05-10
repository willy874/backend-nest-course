import type { InferSelectModel } from 'drizzle-orm';
import { todos } from '../schemas/todos.schema';
import { CategoryModel } from './category.model';

type TodoRow = InferSelectModel<typeof todos>;

export interface TodoModel {
  id: string;
  title: string;
  description: string | null;
  isCompleted: boolean;
  dueDate: Date | null;
  categories: CategoryModel[];
  createdAt: Date;
  updatedAt: Date;
}

export const TodoModel = {
  fromRow(row: TodoRow, categories: CategoryModel[] = []): TodoModel {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      isCompleted: row.isCompleted,
      dueDate: row.dueDate,
      categories,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
};
