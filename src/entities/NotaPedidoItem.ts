import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm';
import { NotaPedido } from './NotaPedido';
import { Unidad } from './Unidad';
import { Elemento } from './Elemento';

export type TipoItemNota = 'queso' | 'elemento';

@Entity('notas_pedido_items')
export class NotaPedidoItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => NotaPedido, (nota) => nota.items, { nullable: false })
  notaPedido!: NotaPedido;

  @Column({ type: 'varchar', length: 20 })
  tipoItem!: TipoItemNota;

  // Para quesos: la unidad física vendida. Para elementos: el elemento.
  @ManyToOne(() => Unidad, { nullable: true })
  unidad!: Unidad | null;

  @ManyToOne(() => Elemento, { nullable: true })
  elemento!: Elemento | null;

  // Snapshots (se congelan al momento de la venta)
  @Column({ type: 'varchar', length: 250 })
  descripcion!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  plu!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pesoGramos!: number | null;

  @Column({ type: 'date', nullable: true })
  fechaElaboracion!: string | null;

  @Column({ type: 'int', default: 1 })
  cantidad!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  precioUnitario!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;
}
