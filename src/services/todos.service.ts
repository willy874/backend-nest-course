import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TodosRepository } from '../repositories/todos.repository';
import { CategoriesRepository } from '../repositories/categories.repository';
import type { TodoModel } from '../models';
import type { CreateTodoDto } from '../dto/todos/create-todo.dto';
import type { UpdateTodoDto } from '../dto/todos/update-todo.dto';

@Injectable()
export class TodosService {
  constructor(
    private readonly todosRepo: TodosRepository,
    private readonly categoriesRepo: CategoriesRepository,
  ) {}

  findAll(filter: { categoryId?: string; isCompleted?: boolean }): Promise<TodoModel[]> {
    return this.todosRepo.findAll(filter);
  }

  async findById(id: string): Promise<TodoModel> {
    const model = await this.todosRepo.findById(id);
    if (!model) throw new NotFoundException(`Todo ${id} not found`);
    return model;
  }

  async create(dto: CreateTodoDto): Promise<TodoModel> {
    const categoryIds = dto.categoryIds ?? [];
    await this.assertCategoriesExist(categoryIds);

    const id = await this.todosRepo.create(
      {
        title: dto.title,
        description: dto.description ?? null,
        isCompleted: dto.isCompleted ?? false,
        dueDate: dto.dueDate ?? null,
      },
      categoryIds,
    );

    return this.findById(id);
  }

  async update(id: string, dto: UpdateTodoDto): Promise<TodoModel> {
    if (dto.categoryIds !== undefined) {
      await this.assertCategoriesExist(dto.categoryIds);
    }

    const { categoryIds, ...rest } = dto;
    const ok = await this.todosRepo.update(id, rest, categoryIds);
    if (!ok) throw new NotFoundException(`Todo ${id} not found`);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const ok = await this.todosRepo.delete(id);
    if (!ok) throw new NotFoundException(`Todo ${id} not found`);
  }

  private async assertCategoriesExist(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.categoriesRepo.findManyByIds(ids);
    if (found.length !== ids.length) {
      const foundIds = new Set(found.map((c) => c.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Categories not found: ${missing.join(', ')}`);
    }
  }
}
