import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class VentasQueryDto {
  @IsDateString()
  fechaInicio!: string;

  @IsDateString()
  fechaFin!: string;
}

export class TopProductosQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
