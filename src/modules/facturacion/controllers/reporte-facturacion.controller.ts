import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth';
import { computeReporte } from '../services/reporte-facturacion.service';

export class ReporteFacturacionController {
  static async get(req: AuthRequest, res: Response) {
    try {
      const desde = typeof req.query.desde === 'string' ? req.query.desde : undefined;
      const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : undefined;
      const reporte = await computeReporte(desde, hasta);
      res.json(reporte);
    } catch (error: any) {
      console.error('❌ Error en reporte facturación:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
