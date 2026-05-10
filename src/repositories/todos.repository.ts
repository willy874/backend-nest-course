import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { todos } from '../schemas/todos.schema';
import { todosCategories } from '../schemas/todos-categories.schema';
import { CategoryModel, TodoModel } from '../models';

export interface TodoWriteInput {
  title: string;
  description?: string | null;
  isCompleted?: boolean;
  dueDate?: Date | null;
}

export interface FindAllOptions {
  categoryId?: string;
  isCompleted?: boolean;
}

@Injectable()
export class TodosRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(options: FindAllOptions = {}): Promise<TodoModel[]> {
    const rows = await this.db.query.todos.findMany({
      where: (t, { eq: eqOp, and: andOp }) => {
        const conditions = [];
        if (options.isCompleted !== undefined) {
          conditions.push(eqOp(t.isCompleted, options.isCompleted));
        }
        return conditions.length ? andOp(...conditions) : undefined;
      },
      with: {
        todosCategories: {
          with: { category: true },
        },
      },
      orderBy: (t, { desc }) => desc(t.createdAt),
    });

    let mapped = rows.map((row) =>
      TodoModel.fromRow(
        row,
        row.todosCategories.map((tc) => CategoryModel.fromRow(tc.category)),
      ),
    );

    if (options.categoryId) {
      mapped = mapped.filter((t) => t.categories.some((c) => c.id === options.categoryId));
    }

    return mapped;
  }

  async findById(id: string): Promise<TodoModel | null> {
    const row = await this.db.query.todos.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, id),
      with: { todosCategories: { with: { category: true } } },
    });
    if (!row) return null;
    return TodoModel.fromRow(
      row,
      row.todosCategories.map((tc) => CategoryModel.fromRow(tc.category)),
    );
  }

  async create(input: TodoWriteInput, categoryIds: string[]): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(todos)
        .values({
          title: input.title,
          description: input.description ?? null,
          isCompleted: input.isCompleted ?? false,
          dueDate: input.dueDate ?? null,
        })
        .returning();

      if (categoryIds.length > 0) {
        await tx.insert(todosCategories).values(
          categoryIds.map((categoryId) => ({
            todoId: row.id,
            categoryId,
          })),
        );
      }

      return row.id;
    });
  }

  async update(
    id: string,
    input: Partial<TodoWriteInput>,
    categoryIds?: string[],
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(todos)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(todos.id, id))
        .returning();

      if (!row) return false;

      if (categoryIds !== undefined) {
        await tx.delete(todosCategories).where(eq(todosCategories.todoId, id));
        if (categoryIds.length > 0) {
          await tx
            .insert(todosCategories)
            .values(categoryIds.map((categoryId) => ({ todoId: id, categoryId })));
        }
      }

      return true;
    });
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(todos).where(eq(todos.id, id)).returning();
    return rows.length > 0;
  }

  async hasCategoryLink(todoId: string, categoryId: string): Promise<boolean> {
    const [row] = await this.db
      .select()
      .from(todosCategories)
      .where(
        and(eq(todosCategories.todoId, todoId), eq(todosCategories.categoryId, categoryId)),
      )
      .limit(1);
    return !!row;
  }
}
