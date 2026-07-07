import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { NotaCredito } from './NotaCredito';
import { NotaPedidoItem } from './NotaPedidoItem';

export type TipoItemNota = 'queso' | 'elemento';

@Entity('notas_credito_items')
export class NotaCreditoItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => NotaCredito, (nc) => nc.items, { nullable: false })
  notaCredito!: NotaCredito;

  @Column()
  notaCreditoId!: number;

  // Ítem original de la nota de pedido que se devuelve (para controlar la sobre-devolución).
  @ManyToOne(() => NotaPedidoItem, { nullable: false })
  notaPedidoItem!: NotaPedidoItem;

  @Column()
  notaPedidoItemId!: number;

  @Column({ type: 'varchar', length: 20 })
  tipoItem!: TipoItemNota;

  @Column({ type: 'int', nullable: true })
  productoId!: number | null;

  @Column({ type: 'int', nullable: true })
  elementoId!: number | null;

  @Column({ type: 'varchar', length: 250 })
  descripcion!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  plu!: string | null;

  @Column({ type: 'int', default: 1 })
  cantidad!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  precioUnitario!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;
}
