import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { todos } from './todos.schema';
import { categories } from './categories.schema';

export const todosCategories = pgTable(
  'todos_categories',
  {
    todoId: uuid('todo_id')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.todoId, t.categoryId] }),
  }),
);

export const todosCategoriesRelations = relations(todosCategories, ({ one }) => ({
  todo: one(todos, {
    fields: [todosCategories.todoId],
    references: [todos.id],
  }),
  category: one(categories, {
    fields: [todosCategories.categoryId],
    references: [categories.id],
  }),
}));
