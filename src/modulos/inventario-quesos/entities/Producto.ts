// ============================================
// ARCHIVO: src/entities/Producto.ts (ACTUALIZADO)
// ============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { TipoQueso } from './TipoQueso';
import { Unidad } from './Unidad';
import { Usuario } from '../../identidad/entities/Usuario';

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  nombre!: string;

  @Column({ length: 20, unique: true })
  plu!: string;

  @Column({ default: false })
  seVendePorUnidad!: boolean;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  precioPorKilo!: number | null;

  // 🆕 Precio de venta por unidad (para el módulo de facturación)
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  precioUnitario!: number | null;

  @ManyToOne(() => TipoQueso, (tipo) => tipo.productos, { nullable: false })
  tipoQueso!: TipoQueso;

  // 🆕 Auditoría de Usuarios
  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @ManyToOne(() => Usuario, { nullable: true })
  modificadoPor!: Usuario | null;

  @ManyToOne(() => Usuario, { nullable: true })
  eliminadoPor!: Usuario | null;

  @OneToMany(() => Unidad, (unidad) => unidad.producto)
  unidades!: Unidad[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // 🆕 Soft Delete
  @DeleteDateColumn()
  deletedAt!: Date | null;
}