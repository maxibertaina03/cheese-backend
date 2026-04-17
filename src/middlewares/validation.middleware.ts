import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { NextFunction, Request, Response } from 'express';

type ValidationSource = 'body' | 'query' | 'params';

const formatErrors = (errors: ValidationError[]): Array<{ field: string; errors: string[] }> => {
  return errors.flatMap((error) => {
    const currentErrors = Object.values(error.constraints || {});
    const nestedErrors = error.children?.length ? formatErrors(error.children) : [];

    if (!nestedErrors.length) {
      return [{ field: error.property, errors: currentErrors }];
    }

    return nestedErrors.map((nested) => ({
      field: `${error.property}.${nested.field}`,
      errors: nested.errors,
    }));
  });
};

export function validateDto<T extends object>(dtoClass: new () => T, source: ValidationSource = 'body') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rawPayload = req[source] && typeof req[source] === 'object'
      ? req[source]
      : {};

    const dtoObj = plainToInstance(dtoClass, rawPayload, {
      enableImplicitConversion: true,
    }) ?? new dtoClass();

    const errors = await validate(dtoObj, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validacion fallida',
        details: formatErrors(errors),
      });
    }

    req[source] = dtoObj as Request[ValidationSource];
    next();
  };
}
