import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Recibo } from './Recibo';
import { NotaPedido } from './NotaPedido';

// Cuánto de un recibo se aplicó a cada nota de pedido (reparto manual).
@Entity('recibos_aplicaciones')
export class ReciboAplicacion {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Recibo, (recibo) => recibo.aplicaciones, { nullable: false })
  recibo!: Recibo;

  @Column()
  reciboId!: number;

  @ManyToOne(() => NotaPedido, { nullable: false })
  notaPedido!: NotaPedido;

  @Column()
  notaPedidoId!: number;

  // Snapshot del número de la nota (ej. "1-5") para el PDF.
  @Column({ type: 'varchar', length: 20, nullable: true })
  numeroNota!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  monto!: number;
}
