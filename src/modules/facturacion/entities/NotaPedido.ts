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
import { Cliente } from './Cliente';
import { Usuario } from '../../../entities/Usuario';
import { NotaPedidoItem } from './NotaPedidoItem';

export type EstadoNotaPedido = 'confirmada' | 'pagada_parcial' | 'pagada_total' | 'anulada';

@Entity('notas_pedido')
export class NotaPedido {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 10, default: '1' })
  serie!: string;

  @Column({ type: 'int' })
  numero!: number;

  @ManyToOne(() => Cliente, { nullable: false })
  cliente!: Cliente;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  saldoPendiente!: number;

  @Column({ type: 'varchar', length: 20, default: 'confirmada' })
  estado!: EstadoNotaPedido;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @OneToMany(() => NotaPedidoItem, (item) => item.notaPedido)
  items!: NotaPedidoItem[];

  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @CreateDateColumn()
  fecha!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
