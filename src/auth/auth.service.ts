import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(name: string, email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('Bu email zaten kayıtlı');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({ name, email, password: hashedPassword });

    return { message: 'Kayıt başarılı', userId: user.id };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Email veya şifre hatalı');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Email veya şifre hatalı');

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { access_token: token };
  }
}