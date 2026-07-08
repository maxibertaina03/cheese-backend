import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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

export class ReciboAplicacionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  notaPedidoId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto!: number;
}

export class ReciboPagoDto {
  @IsIn(['efectivo', 'transferencia'])
  medio!: 'efectivo' | 'transferencia';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto!: number;
}

export class CreateReciboDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clienteId!: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReciboAplicacionDto)
  aplicaciones!: ReciboAplicacionDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReciboPagoDto)
  pagos!: ReciboPagoDto[];
}

export class ReciboIdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}
