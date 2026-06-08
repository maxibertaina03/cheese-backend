import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';

const nullToUndefined = ({ value }: { value: unknown }) =>
  value === null || value === '' ? undefined : value;

export class IdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}

export class CreateIndumentariaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockInicial!: number;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  stockMinimo?: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoria?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  talle?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  genero?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ubicacion?: string;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  proveedorId?: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class UpdateIndumentariaDto {
  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  stockMinimo?: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoria?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  talle?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  genero?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ubicacion?: string;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  proveedorId?: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class IngresoIndumentariaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  proveedorId?: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  documentoReferencia?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class EgresoIndumentariaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  destino!: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class AjusteIndumentariaDto {
  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  cantidad!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  motivo!: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
