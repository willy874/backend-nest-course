import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { categories } from '../schemas/categories.schema';
import { CategoryModel } from '../models';

export interface CategoryWriteInput {
  name: string;
  color?: string | null;
}

@Injectable()
export class CategoriesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(): Promise<CategoryModel[]> {
    const rows = await this.db.select().from(categories);
    return rows.map(CategoryModel.fromRow);
  }

  async findById(id: string): Promise<CategoryModel | null> {
    const [row] = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return row ? CategoryModel.fromRow(row) : null;
  }

  async findManyByIds(ids: string[]): Promise<CategoryModel[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.query.categories.findMany({
      where: (c, { inArray }) => inArray(c.id, ids),
    });
    return rows.map(CategoryModel.fromRow);
  }

  async create(input: CategoryWriteInput): Promise<CategoryModel> {
    const [row] = await this.db
      .insert(categories)
      .values({ name: input.name, color: input.color ?? null })
      .returning();
    return CategoryModel.fromRow(row);
  }

  async update(id: string, input: Partial<CategoryWriteInput>): Promise<CategoryModel | null> {
    const [row] = await this.db
      .update(categories)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return row ? CategoryModel.fromRow(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(categories).where(eq(categories.id, id)).returning();
    return rows.length > 0;
  }
}
