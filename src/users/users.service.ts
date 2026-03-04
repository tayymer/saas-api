import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    const { password, ...rest } = user;
    return rest;
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: { name: string; email: string; password?: string }) {
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.password || '',
      },
    });
  }

  async update(id: number, data: { name: string; email: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    const updated = await this.prisma.user.update({ where: { id }, data });
    const { password, ...rest } = updated;
    return rest;
  }

  async remove(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    await this.prisma.user.delete({ where: { id } });
    return { message: `User ${id} deleted` };
  }
}