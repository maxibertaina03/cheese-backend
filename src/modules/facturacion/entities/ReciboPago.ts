import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Recibo } from './Recibo';

// Una forma de pago dentro de un recibo (ej. efectivo $5000 + transferencia $5000).
@Entity('recibos_pagos')
export class ReciboPago {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Recibo, (recibo) => recibo.pagos, { nullable: false })
  recibo!: Recibo;

  @Column()
  reciboId!: number;

  @Column({ type: 'varchar', length: 20 })
  medio!: 'efectivo' | 'transferencia';

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  monto!: number;
}
