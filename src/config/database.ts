import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Elemento } from '../modulos/elementos/entities/Elemento';
import { Indumentaria } from '../entities/Indumentaria';
import { Motivo } from '../entities/Motivo';
import { MovimientoElemento } from '../modulos/elementos/entities/MovimientoElemento';
import { MovimientoIndumentaria } from '../entities/MovimientoIndumentaria';
// Módulo Facturación (bounded context)
import { Cliente } from '../modulos/facturacion/entities/Cliente';
import { Empresa } from '../modulos/facturacion/entities/Empresa';
import { NotaPedido } from '../modulos/facturacion/entities/NotaPedido';
import { NotaPedidoItem } from '../modulos/facturacion/entities/NotaPedidoItem';
import { SecuenciaComprobante } from '../modulos/facturacion/entities/SecuenciaComprobante';
import { StockComercial } from '../modulos/facturacion/entities/StockComercial';
import { MovimientoStockComercial } from '../modulos/facturacion/entities/MovimientoStockComercial';
import { Recibo } from '../modulos/facturacion/entities/Recibo';
import { ReciboAplicacion } from '../modulos/facturacion/entities/ReciboAplicacion';
import { ReciboPago } from '../modulos/facturacion/entities/ReciboPago';
import { NotaCredito } from '../modulos/facturacion/entities/NotaCredito';
import { NotaCreditoItem } from '../modulos/facturacion/entities/NotaCreditoItem';
import { MovimientoStock } from '../modulos/elementos/entities/MovimientoStock';
import { Particion } from '../entities/Particion';
import { Producto } from '../entities/Producto';
import { Proveedor } from '../entities/Proveedor';
import { StockElemento } from '../modulos/elementos/entities/StockElemento';
import { TipoElemento } from '../modulos/elementos/entities/TipoElemento';
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
    ReciboPago,
    NotaCredito,
    NotaCreditoItem,
  ],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
