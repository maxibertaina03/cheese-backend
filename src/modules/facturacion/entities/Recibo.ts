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
import { ReciboAplicacion } from './ReciboAplicacion';

export type MedioPago = 'efectivo' | 'transferencia';

// Recibo (serie 2): registra el cobro de una o varias notas de pedido de un cliente.
@Entity('recibos')
export class Recibo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 10, default: '2' })
  serie!: string;

  @Column({ type: 'int' })
  numero!: number;

  @ManyToOne(() => Cliente, { nullable: false })
  cliente!: Cliente;

  @Column()
  clienteId!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  montoTotal!: number;

  @Column({ type: 'varchar', length: 20 })
  medioPago!: MedioPago;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @OneToMany(() => ReciboAplicacion, (aplicacion) => aplicacion.recibo)
  aplicaciones!: ReciboAplicacion[];

  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @CreateDateColumn()
  fecha!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
