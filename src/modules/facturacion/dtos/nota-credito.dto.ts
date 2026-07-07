import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const nullToUndefined = ({ value }: { value: unknown }) =>
  value === null || value === '' ? undefined : value;

export class NotaCreditoItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  notaPedidoItemId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class CreateNotaCreditoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  notaPedidoId!: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NotaCreditoItemDto)
  items!: NotaCreditoItemDto[];
}

export class NotaCreditoIdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}

export class NotaPedidoIdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  notaPedidoId!: number;
}
