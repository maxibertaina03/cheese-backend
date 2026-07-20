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
import { Usuario } from '../../identidad/entities/Usuario';
import { ReciboAplicacion } from './ReciboAplicacion';
import { ReciboPago } from './ReciboPago';

// A nivel recibo puede ser 'mixto' cuando combina medios de pago.
export type MedioPago = 'efectivo' | 'transferencia' | 'mixto';

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

  @OneToMany(() => ReciboPago, (pago) => pago.recibo)
  pagos!: ReciboPago[];

  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @CreateDateColumn()
  fecha!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
