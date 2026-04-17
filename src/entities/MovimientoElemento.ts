
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Elemento } from './Elemento';
import { Motivo } from './Motivo';
import { Usuario } from './Usuario';

@Entity('movimientos_elemento')
export class MovimientoElemento {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Elemento, elemento => elemento.movimientos)
  elemento!: Elemento;

  @Column({ type: 'varchar', length: 20 })
  tipo!: 'ingreso' | 'egreso';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  cantidad!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  stockAnterior!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  stockNuevo!: number;

  @ManyToOne(() => Motivo, { nullable: true })
  motivo!: Motivo | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @CreateDateColumn()
  createdAt!: Date;
}