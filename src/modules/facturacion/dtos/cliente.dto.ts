import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const nullToUndefined = ({ value }: { value: unknown }) =>
  value === null || value === '' ? undefined : value;

export class ClienteIdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}

export class CreateClienteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre!: string;

  @IsOptional()
  @IsIn(['DNI', 'CUIT'])
  tipoDocumento?: 'DNI' | 'CUIT';

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroDocumento?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(250)
  direccion?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigoPostal?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  localidad?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  provincia?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;
}

export class UpdateClienteDto {
  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsIn(['DNI', 'CUIT'])
  tipoDocumento?: 'DNI' | 'CUIT';

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroDocumento?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(250)
  direccion?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigoPostal?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  localidad?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  provincia?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
