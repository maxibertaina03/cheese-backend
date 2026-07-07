import { Transform, Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
}
