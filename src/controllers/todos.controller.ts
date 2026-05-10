import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TodosService } from '../services/todos.service';
import { CreateTodoDto } from '../dto/todos/create-todo.dto';
import { UpdateTodoDto } from '../dto/todos/update-todo.dto';
import {
  ListTodosQueryDto,
  TodoResponseDto,
  toTodoResponse,
} from '../dto/todos/todo-response.dto';

@ApiTags('todos')
@Controller('todos')
export class TodosController {
  constructor(private readonly service: TodosService) {}

  @Get()
  @ApiOperation({ summary: 'List todos (filter by categoryId / isCompleted)' })
  async findAll(@Query() query: ListTodosQueryDto): Promise<TodoResponseDto[]> {
    const models = await this.service.findAll({
      categoryId: query.categoryId,
      isCompleted: query.isCompleted,
    });
    return models.map(toTodoResponse);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get todo by id (with categories)' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TodoResponseDto> {
    const model = await this.service.findById(id);
    return toTodoResponse(model);
  }

  @Post()
  @ApiOperation({ summary: 'Create todo (optionally link categories)' })
  async create(@Body() dto: CreateTodoDto): Promise<TodoResponseDto> {
    const model = await this.service.create(dto);
    return toTodoResponse(model);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update todo (omit categoryIds to keep, [] to clear)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTodoDto,
  ): Promise<TodoResponseDto> {
    const model = await this.service.update(id, dto);
    return toTodoResponse(model);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete todo' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.delete(id);
  }
}
