import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { TipoQueso } from '../entities/TipoQueso';
import { Producto } from '../entities/Producto';
import { Unidad } from '../entities/Unidad';
import { Particion } from '../entities/Particion';
import { Usuario } from '../entities/Usuario';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'cheese_stock',
  synchronize: true,
  logging: false,
  entities: [TipoQueso, Producto, Unidad, Particion, Usuario],
});