import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const nullToUndefined = ({ value }: { value: unknown }) =>
  value === null ? undefined : value;

export class UpsertEmpresaDto {
  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  razonSocial?: string;

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cuit?: string;

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

  @Transform(nullToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  condicionIva?: string;
}
