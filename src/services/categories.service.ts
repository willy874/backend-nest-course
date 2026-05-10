import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesRepository } from '../repositories/categories.repository';
import type { CategoryModel } from '../models';
import type { CreateCategoryDto } from '../dto/categories/create-category.dto';
import type { UpdateCategoryDto } from '../dto/categories/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly repo: CategoriesRepository) {}

  findAll(): Promise<CategoryModel[]> {
    return this.repo.findAll();
  }

  async findById(id: string): Promise<CategoryModel> {
    const model = await this.repo.findById(id);
    if (!model) throw new NotFoundException(`Category ${id} not found`);
    return model;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryModel> {
    try {
      return await this.repo.create({ name: dto.name, color: dto.color ?? null });
    } catch (err) {
      if (err instanceof Error && /unique/i.test(err.message)) {
        throw new ConflictException(`Category name "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryModel> {
    const model = await this.repo.update(id, dto);
    if (!model) throw new NotFoundException(`Category ${id} not found`);
    return model;
  }

  async delete(id: string): Promise<void> {
    const ok = await this.repo.delete(id);
    if (!ok) throw new NotFoundException(`Category ${id} not found`);
  }
}
