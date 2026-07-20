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
import { Usuario } from '../../identidad/entities/Usuario';
import { Proveedor } from './Proveedor';
import { MovimientoIndumentaria } from './MovimientoIndumentaria';

@Entity('indumentaria')
export class Indumentaria {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200 })
  nombre!: string; // Nombre de la prenda

  // Categoría de uso: blanca | azul | oficina | otra
  @Column({ type: 'varchar', length: 50, nullable: true })
  categoria!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  talle!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color!: string | null;

  // hombre | mujer | unisex
  @Column({ type: 'varchar', length: 20, nullable: true })
  genero!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  ubicacion!: string | null;

  @Column({ type: 'int', default: 0 })
  cantidadDisponible!: number;

  @Column({ type: 'int', default: 0 })
  cantidadTotalIngresada!: number; // Histórico total ingresado

  @Column({ type: 'int', default: 0 })
  stockMinimo!: number; // Alerta cuando baja de este nivel

  // Proveedor principal (para filtros/reportes)
  @ManyToOne(() => Proveedor, (proveedor) => proveedor.indumentaria, {
    nullable: true,
    eager: true,
  })
  proveedor!: Proveedor | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @Column({ default: true })
  activo!: boolean;

  // Historial de movimientos
  @OneToMany(() => MovimientoIndumentaria, (movimiento) => movimiento.indumentaria)
  movimientos!: MovimientoIndumentaria[];

  // Auditoría
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
