import { Transform, Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const nullToUndefined = ({ value }: { value: unknown }) =>
  value === null || value === '' ? undefined : value;

export class CreateUnidadDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productoId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  pesoInicial!: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacionesIngreso?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  motivoId!: number;
}

export class UpdateUnidadDto {
  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacionesIngreso?: string;
}

export class AddParticionDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  peso!: number;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacionesCorte?: string;

  @Transform(nullToUndefined)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  motivoId?: number;
}

export class UnidadIdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}
