import { Injectable, NotFoundException } from '@nestjs/common';

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

@Injectable()
export class UsersService {
  private users: User[] = [];
  private nextId = 1;

  findAll(): Omit<User, 'password'>[] {
    return this.users.map(({ password, ...user }) => user);
  }

  findOne(id: number): Omit<User, 'password'> {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    const { password, ...rest } = user;
    return rest;
  }

  findByEmail(email: string): User | undefined {
    return this.users.find((u) => u.email === email);
  }

  create(data: { name: string; email: string; password?: string }): User {
    const user: User = {
      id: this.nextId++,
      name: data.name,
      email: data.email,
      password: data.password || '',
    };
    this.users.push(user);
    return user;
  }

  update(id: number, data: { name: string; email: string }): Omit<User, 'password'> {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    Object.assign(user, data);
    const { password, ...rest } = user;
    return rest;
  }

  remove(id: number): { message: string } {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) throw new NotFoundException(`User ${id} not found`);
    this.users.splice(index, 1);
    return { message: `User ${id} deleted` };
  }
}