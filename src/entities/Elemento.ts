import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Motivo } from './Motivo';
import { Usuario } from './Usuario';
import { MovimientoElemento } from './MovimientoElemento'; // Nueva entidad

@Entity('elementos')
export class Elemento {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cantidadDisponible!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cantidadTotal!: number; // Histórico total ingresado

  @Column({ default: true })
  activo!: boolean;

  // Relación con movimientos (historial de ingresos/egresos)
  @OneToMany(() => MovimientoElemento, mov => mov.elemento)
  movimientos!: MovimientoElemento[];

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

  @DeleteDateColumn()
  deletedAt!: Date | null;
}