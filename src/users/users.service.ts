import { Injectable, NotFoundException } from '@nestjs/common';

export interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class UsersService {
  private users: User[] = [];
  private nextId = 1;

  findAll(): User[] {
    return this.users;
  }

  findOne(id: number): User {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  create(data: { name: string; email: string }): User {
    const user = { id: this.nextId++, ...data };
    this.users.push(user);
    return user;
  }

  update(id: number, data: { name: string; email: string }): User {
    const user = this.findOne(id);
    Object.assign(user, data);
    return user;
  }

  remove(id: number): { message: string } {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) throw new NotFoundException(`User ${id} not found`);
    this.users.splice(index, 1);
    return { message: `User ${id} deleted` };
  }
}