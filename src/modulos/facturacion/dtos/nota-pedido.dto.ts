import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const nullToUndefined = ({ value }: { value: unknown }) =>
  value === null || value === '' ? undefined : value;

export class NotaPedidoItemDto {
  @IsIn(['queso', 'elemento'])
  tipoItem!: 'queso' | 'elemento';

  // Para queso: id del producto (se descuenta del stock comercial por cantidad).
  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  productoId?: number;

  // Para elemento: id del elemento.
  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  elementoId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;

  // Descuento en $ aplicado a la línea (opcional). No puede ser negativo.
  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  descuento?: number;
}

export class CreateNotaPedidoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clienteId!: number;

  // Fecha del comprobante (YYYY-MM-DD). Opcional: si no viene, se usa la fecha actual.
  @Transform(nullToUndefined)
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NotaPedidoItemDto)
  items!: NotaPedidoItemDto[];
}

export class NotaPedidoIdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}
