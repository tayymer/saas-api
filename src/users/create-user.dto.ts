import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'İsim boş olamaz' })
  @MinLength(2, { message: 'İsim en az 2 karakter olmalı' })
  name: string;

  @IsEmail({}, { message: 'Geçerli bir email girin' })
  @IsNotEmpty({ message: 'Email boş olamaz' })
  email: string;
}