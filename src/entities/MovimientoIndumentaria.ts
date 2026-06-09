import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Indumentaria } from './Indumentaria';
import { Proveedor } from './Proveedor';
import { Usuario } from './Usuario';

@Entity('movimientos_indumentaria')
export class MovimientoIndumentaria {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Indumentaria, (indumentaria) => indumentaria.movimientos)
  indumentaria!: Indumentaria;

  @Column({ type: 'varchar', length: 20 })
  tipo!: 'INGRESO' | 'EGRESO' | 'AJUSTE';

  @Column({ type: 'int' })
  cantidad!: number; // Positivo siempre; el tipo define si suma o resta

  @Column({ type: 'int' })
  stockAnterior!: number;

  @Column({ type: 'int' })
  stockNuevo!: number;

  // A dónde se entregó la prenda (egresos)
  @Column({ type: 'varchar', length: 200, nullable: true })
  destino!: string | null;

  // De qué proveedor vino (ingresos)
  @ManyToOne(() => Proveedor, { nullable: true })
  proveedor!: Proveedor | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  documentoReferencia!: string | null; // N° remito, factura, etc.

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @Column({ type: 'timestamp' })
  fechaMovimiento!: Date;

  @ManyToOne(() => Usuario, { nullable: true })
  usuario!: Usuario | null;

  @CreateDateColumn()
  createdAt!: Date;
}
