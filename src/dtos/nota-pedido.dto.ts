import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
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

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  unidadId?: number;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  elementoId?: number;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;
}

export class CreateNotaPedidoDto {
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
  @Type(() => NotaPedidoItemDto)
  items!: NotaPedidoItemDto[];
}

export class NotaPedidoIdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}
