import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

const nullToUndefined = ({ value }: { value: unknown }) =>
  value === null || value === '' ? undefined : value;

export class CreateElementoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cantidadTotal!: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario?: number;

  @IsOptional()
  @IsBoolean()
  esVendible?: boolean;
}

export class UpdateElementoDto {
  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario?: number;

  @IsOptional()
  @IsBoolean()
  esVendible?: boolean;
}

// Datos de venta del elemento (pestaña Precios de Facturación): solo precio y
// si se vende. No permite tocar nombre/descripción.
export class UpdateElementoVentaDto {
  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario?: number;

  @IsOptional()
  @IsBoolean()
  esVendible?: boolean;
}

export class MovimientoElementoDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  cantidad!: number;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  motivoId?: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class ElementoIdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}
