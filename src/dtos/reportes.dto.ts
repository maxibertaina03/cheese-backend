import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

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
