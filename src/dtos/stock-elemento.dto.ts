import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
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

export class CreateTipoElementoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre!: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unidadMedida?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoria?: string;

  @IsOptional()
  @IsBoolean()
  llevaStock?: boolean;
}

export class UpdateTipoElementoDto {
  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unidadMedida?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoria?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CreateStockElementoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tipoId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  stockInicial!: number;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  stockMinimo?: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ubicacion?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class UpdateStockElementoDto {
  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  stockMinimo?: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ubicacion?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class IngresoStockDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  cantidad!: number;

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

export class EgresoStockDto extends IngresoStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  motivoId!: number;
}

export class AjusteStockDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
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
