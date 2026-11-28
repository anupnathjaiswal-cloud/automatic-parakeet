import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a category
  async create(dto: CreateCategoryDto) {
    const existingCategory = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });

    if (existingCategory) {
      throw new ConflictException('Category slug already exists');
    }

    if (dto.parentId) {
      await this.validateParentCategory(dto.parentId);
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder,
      },
    });
  }

  // Get all active categories with their active children
  async findAll() {
    return this.prisma.category.findMany({
      where: {
        isActive: true,
      },
      include: {
        children: {
          where: {
            isActive: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // Get a category by ID
  async findOne(id: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        isActive: true,
      },
      include: {
        parent: true,
        children: {
          where: {
            isActive: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  // Get a category by slug
  async findBySlug(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        slug,
        isActive: true,
      },
      include: {
        parent: true,
        children: {
          where: {
            isActive: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  // Update a category
  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category || !category.isActive) {
      throw new NotFoundException('Category not found');
    }

    if (dto.slug && dto.slug !== category.slug) {
      const existingCategory = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
      });

      if (existingCategory) {
        throw new ConflictException('Category slug already exists');
      }
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }

      if (dto.parentId !== null) {
        await this.validateParentCategory(dto.parentId);
        await this.validateNoCircularHierarchy(id, dto.parentId);
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder,
      },
    });
  }

  // Soft-delete (deactivate) a category
  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category || !category.isActive) {
      throw new NotFoundException('Category not found');
    }

    const activeChildren = await this.prisma.category.count({
      where: {
        parentId: id,
        isActive: true,
      },
    });

    if (activeChildren > 0) {
      throw new ConflictException(
        'Deactivate or reassign child categories first',
      );
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  // Validate parent category
  private async validateParentCategory(parentId: string) {
    const parent = await this.prisma.category.findFirst({
      where: {
        id: parentId,
        isActive: true,
      },
    });

    if (!parent) {
      throw new BadRequestException(
        'Parent category does not exist or is inactive',
      );
    }
  }

  // Prevent circular category hierarchy
  private async validateNoCircularHierarchy(
    categoryId: string,
    newParentId: string,
  ) {
    let currentParentId: string | null = newParentId;

    while (currentParentId !== null) {
      if (currentParentId === categoryId) {
        throw new BadRequestException(
          'Circular category hierarchy is not allowed',
        );
      }

      const parent: { parentId: string | null } | null =
        await this.prisma.category.findUnique({
          where: {
            id: currentParentId,
          },
          select: {
            parentId: true,
          },
        });

      currentParentId = parent?.parentId ?? null;
    }
  }
}
