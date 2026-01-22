// ============================================
// ARCHIVO: src/entities/Unidad.ts (ACTUALIZADA)
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
import { Producto } from './Producto';
import { Particion } from './Particion';
import { Usuario } from './Usuario';
import { Motivo } from './Motivo'

@Entity('unidades')
export class Unidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Producto, (producto) => producto.unidades, {
    nullable: false,
  })
  producto!: Producto;

  @Column('decimal', { precision: 10, scale: 2 })
  pesoInicial!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  pesoActual!: number;

  @Column({ default: true })
  activa!: boolean;

  @Column({ type: 'text', nullable: true })
  observacionesIngreso!: string | null;

  // 🆕 Auditoría de Usuarios
  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @ManyToOne(() => Usuario, { nullable: true })
  modificadoPor!: Usuario | null;

  @ManyToOne(() => Usuario, { nullable: true })
  eliminadoPor!: Usuario | null;

  @OneToMany(() => Particion, (particion) => particion.unidad)
  particiones!: Particion[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // 🆕 Soft Delete
  @DeleteDateColumn()
  deletedAt!: Date | null;
  
  @ManyToOne(() => Motivo, { nullable: false })
  motivo!: Motivo;

  @Column()
  motivoId!: number;
}