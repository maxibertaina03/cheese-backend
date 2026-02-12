// ============================================
// ARCHIVO: src/entities/MovimientoStock.ts (NUEVO)
// ============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { StockElemento } from './StockElemento';
import { Motivo } from './Motivo';
import { Usuario } from './Usuario';

@Entity('movimientos_stock')
export class MovimientoStock {
  @PrimaryGeneratedColumn()
  id!: number;

  // Relación con el stock
  @ManyToOne(() => StockElemento, stock => stock.movimientos)
  stockElemento!: StockElemento;

  @Column({ type: 'varchar', length: 20 })
  tipo!: 'INGRESO' | 'EGRESO' | 'AJUSTE';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  cantidad!: number; // Positivo siempre, el tipo define si suma o resta

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  stockAnterior!: number; // Stock antes del movimiento

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  stockNuevo!: number; // Stock después del movimiento

  // Motivo solo para egresos
  @ManyToOne(() => Motivo, { nullable: true })
  motivo!: Motivo | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  documentoReferencia!: string | null; // N° factura, remito, etc.

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @Column({ type: 'date' })
  fechaMovimiento!: Date;

  // Quién registró
  @ManyToOne(() => Usuario, { nullable: true })
  usuario!: Usuario | null;

  @CreateDateColumn()
  createdAt!: Date;
}