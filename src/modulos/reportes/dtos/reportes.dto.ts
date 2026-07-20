import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}

export class VentasQueryDto {
  @IsDateString()
  fechaInicio!: string;

  @IsDateString()
  fechaFin!: string;
}

export class TopProductosQueryDto extends DashboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ExportReportQueryDto extends DashboardQueryDto {}

export class ExportInventarioPdfQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tipoQuesoId?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  searchObservaciones?: string;
}

export class ExportHistorialPdfQueryDto extends ExportInventarioPdfQueryDto {
  @IsOptional()
  @IsIn(['todos', 'activos', 'agotados'])
  estado?: 'todos' | 'activos' | 'agotados';

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}
