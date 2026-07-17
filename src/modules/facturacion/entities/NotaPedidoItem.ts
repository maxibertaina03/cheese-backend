import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { NotaPedido } from './NotaPedido';
import { Producto } from '../../../entities/Producto';
import { Elemento } from '../../../entities/Elemento';

export type TipoItemNota = 'queso' | 'elemento';

@Entity('notas_pedido_items')
export class NotaPedidoItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => NotaPedido, (nota) => nota.items, { nullable: false })
  notaPedido!: NotaPedido;

  @Column()
  notaPedidoId!: number;

  @Column({ type: 'varchar', length: 20 })
  tipoItem!: TipoItemNota;

  // Para quesos: el producto vendido (se descuenta del stock comercial por cantidad).
  @ManyToOne(() => Producto, { nullable: true })
  producto!: Producto | null;

  @Column({ type: 'int', nullable: true })
  productoId!: number | null;

  // Para elementos: el elemento vendido.
  @ManyToOne(() => Elemento, { nullable: true })
  elemento!: Elemento | null;

  @Column({ type: 'int', nullable: true })
  elementoId!: number | null;

  // Snapshots (se congelan al momento de la venta)
  @Column({ type: 'varchar', length: 250 })
  descripcion!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  plu!: string | null;

  @Column({ type: 'int', default: 1 })
  cantidad!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  precioUnitario!: number;

  // Descuento en $ aplicado a la línea (precio × cantidad − descuento = subtotal).
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;
}
