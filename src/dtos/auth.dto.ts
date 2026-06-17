import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

const MODULOS_VALIDOS = ['quesos', 'elementos', 'indumentaria', 'dashboard', 'historial'];

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'El username solo puede contener letras, numeros, punto, guion y guion bajo',
  })
  username!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsIn(['admin', 'usuario'])
  rol?: 'admin' | 'usuario';

  @IsOptional()
  @IsArray()
  @IsIn(MODULOS_VALIDOS, { each: true })
  permisos?: string[];
}

export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  password!: string;
}
