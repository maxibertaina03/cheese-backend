import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Elemento } from '../entities/Elemento';
import { Motivo } from '../entities/Motivo';
import { MovimientoElemento } from '../entities/MovimientoElemento';
import { MovimientoStock } from '../entities/MovimientoStock';
import { Particion } from '../entities/Particion';
import { Producto } from '../entities/Producto';
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
  ],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
