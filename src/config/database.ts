// ============================================
// ARCHIVO: src/config/database.ts (ACTUALIZADO CON ELEMENTOS)
// ============================================
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { TipoQueso } from '../entities/TipoQueso';
import { Producto } from '../entities/Producto';
import { Unidad } from '../entities/Unidad';
import { Particion } from '../entities/Particion';
import { Usuario } from '../entities/Usuario';
import { Motivo } from '../entities/Motivo';
import { Elemento } from '../entities/Elemento'; // 🆕 NUEVO
import { MovimientoElemento } from '../entities/MovimientoElemento'; // 🆕 NUEVO
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
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
    Elemento, // 🆕 NUEVO
    MovimientoElemento // 🆕 NUEVO
  ],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});