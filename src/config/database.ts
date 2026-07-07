import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Elemento } from '../entities/Elemento';
import { Indumentaria } from '../entities/Indumentaria';
import { Motivo } from '../entities/Motivo';
import { MovimientoElemento } from '../entities/MovimientoElemento';
import { MovimientoIndumentaria } from '../entities/MovimientoIndumentaria';
// Módulo Facturación (bounded context)
import { Cliente } from '../modules/facturacion/entities/Cliente';
import { Empresa } from '../modules/facturacion/entities/Empresa';
import { NotaPedido } from '../modules/facturacion/entities/NotaPedido';
import { NotaPedidoItem } from '../modules/facturacion/entities/NotaPedidoItem';
import { SecuenciaComprobante } from '../modules/facturacion/entities/SecuenciaComprobante';
import { StockComercial } from '../modules/facturacion/entities/StockComercial';
import { MovimientoStockComercial } from '../modules/facturacion/entities/MovimientoStockComercial';
import { Recibo } from '../modules/facturacion/entities/Recibo';
import { ReciboAplicacion } from '../modules/facturacion/entities/ReciboAplicacion';
import { MovimientoStock } from '../entities/MovimientoStock';
import { Particion } from '../entities/Particion';
import { Producto } from '../entities/Producto';
import { Proveedor } from '../entities/Proveedor';
import { StockElemento } from '../entities/StockElemento';
import { TipoElemento } from '../entities/TipoElemento';
import { TipoQueso } from '../entities/TipoQueso';
import { Unidad } from '../entities/Unidad';
import { Usuario } from '../entities/Usuario';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'cheese_stock',
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
  entities: [
    TipoQueso,
    Producto,
    Unidad,
    Particion,
    Usuario,
    Motivo,
    Elemento,
    MovimientoElemento,
    TipoElemento,
    StockElemento,
    MovimientoStock,
    Proveedor,
    Indumentaria,
    MovimientoIndumentaria,
    Cliente,
    Empresa,
    SecuenciaComprobante,
    NotaPedido,
    NotaPedidoItem,
    StockComercial,
    MovimientoStockComercial,
    Recibo,
    ReciboAplicacion,
  ],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
