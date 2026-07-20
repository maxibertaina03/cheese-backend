import { Response } from 'express';
import { AppDataSource } from '../../../config/database';
import { AuthRequest } from '../../../middlewares/auth';
import { limpiarTransaccionesFacturacion } from '../services/limpiar.service';

export class MantenimientoController {
  // Borra todas las transacciones de facturación (deja clientes/proveedores/empresa/
  // productos e inventario físico). Solo admin.
  static async limpiarTransacciones(_req: AuthRequest, res: Response) {
    try {
      await limpiarTransaccionesFacturacion(AppDataSource);
      res.json({ message: 'Transacciones de facturación eliminadas correctamente' });
    } catch (error: any) {
      console.error('❌ Error al limpiar facturación:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
