// ============================================
// ARCHIVO: src/entities/Motivo.ts
// ============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Particion } from './Particion';

@Entity('motivos')
export class Motivo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, length: 50 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ default: true })
  activo!: boolean;

  @OneToMany(() => Particion, (particion) => particion.motivo)
  particiones!: Particion[];

  @CreateDateColumn()
  createdAt!: Date;
}