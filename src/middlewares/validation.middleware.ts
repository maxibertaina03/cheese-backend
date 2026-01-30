// src/middlewares/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

export function validateDto(dtoClass: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dtoObj = plainToClass(dtoClass, req.body);
    const errors: ValidationError[] = await validate(dtoObj);

    if (errors.length > 0) {
      const messages = errors.map(error => ({
        field: error.property,
        errors: Object.values(error.constraints || {})
      }));

      return res.status(400).json({
        error: 'Validación fallida',
        details: messages
      });
    }

    req.body = dtoObj;
    next();
  };
}

// DTOs de ejemplo
import { IsString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';

export class CreateUnidadDto {
  @IsNumber()
  @Min(1)
  productoId!: number;

  @IsNumber()
  @Min(0.01)
  pesoInicial!: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  observacionesIngreso?: string;

  @IsNumber()
  @IsOptional()
  motivoId?: number;
}

export class CreateProductoDto {
  @IsString()
  @MaxLength(100)
  nombre!: string;

  @IsString()
  @MaxLength(5)
  plu!: string;

  @IsNumber()
  tipoQuesoId!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  precioPorKilo?: number;
}