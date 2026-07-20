// ============================================
// ARCHIVO: src/entities/Particion.ts (ACTUALIZADA)
// ============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Unidad } from './Unidad';
import { Usuario } from '../../identidad/entities/Usuario';
import { Motivo } from './Motivo';

@Entity('particiones')
export class Particion {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Unidad, (unidad) => unidad.particiones, {
    nullable: false,
  })
  unidad!: Unidad;

  @Column('decimal', { precision: 10, scale: 2 })
  peso!: number;

  @Column({ type: 'text', nullable: true })
  observacionesCorte!: string | null;

  // 🆕 Relación con Motivo
  @ManyToOne(() => Motivo, (motivo) => motivo.particiones, {
    nullable: true,
  })
  motivo!: Motivo | null;

  // 🆕 Auditoría de Usuarios
  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @ManyToOne(() => Usuario, { nullable: true })
  modificadoPor!: Usuario | null;

  @ManyToOne(() => Usuario, { nullable: true })
  eliminadoPor!: Usuario | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // 🆕 Soft Delete
  @DeleteDateColumn()
  deletedAt!: Date | null;
}