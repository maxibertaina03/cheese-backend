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
import { NotaPedido } from './NotaPedido';
import { Usuario } from '../../identidad/entities/Usuario';
import { NotaCreditoItem } from './NotaCreditoItem';

// Nota de crédito (serie 3): devolución sobre una nota de pedido. Reingresa stock
// comercial y baja el saldo de la nota.
@Entity('notas_credito')
export class NotaCredito {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 10, default: '3' })
  serie!: string;

  @Column({ type: 'int' })
  numero!: number;

  @ManyToOne(() => NotaPedido, { nullable: false })
  notaPedido!: NotaPedido;

  @Column()
  notaPedidoId!: number;

  @ManyToOne(() => Cliente, { nullable: false })
  cliente!: Cliente;

  @Column()
  clienteId!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  montoTotal!: number;

  @Column({ type: 'text', nullable: true })
  motivo!: string | null;

  @OneToMany(() => NotaCreditoItem, (item) => item.notaCredito)
  items!: NotaCreditoItem[];

  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @CreateDateColumn()
  fecha!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
