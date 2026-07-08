import { Transform, Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const nullToUndefined = ({ value }: { value: unknown }) =>
  value === null || value === '' ? undefined : value;

export class ProductoIdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productoId!: number;
}

export class IngresoStockComercialDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  cantidad!: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsDateString()
  fechaComprobante?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  comprobantePrefijo?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  comprobanteNumero?: string;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioCompra?: number;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  proveedorId?: number;
}
