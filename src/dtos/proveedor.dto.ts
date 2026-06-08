import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const nullToUndefined = ({ value }: { value: unknown }) =>
  value === null || value === '' ? undefined : value;

export class IdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}

export class CreateProveedorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre!: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contacto?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(250)
  direccion?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class UpdateProveedorDto {
  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contacto?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(250)
  direccion?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
