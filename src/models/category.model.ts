import type { InferSelectModel } from 'drizzle-orm';
import { categories } from '../schemas/categories.schema';

type CategoryRow = InferSelectModel<typeof categories>;

export interface CategoryModel {
  id: string;
  name: string;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const CategoryModel = {
  fromRow(row: CategoryRow): CategoryModel {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
};
