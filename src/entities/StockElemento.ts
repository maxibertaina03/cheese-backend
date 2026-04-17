// ============================================
// ARCHIVO: src/entities/StockElemento.ts (NUEVO)
// ============================================
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
import { TipoElemento } from './TipoElemento'; // Nueva entidad
import { MovimientoStock } from './MovimientoStock'; // Nueva entidad
import { Usuario } from './Usuario';

@Entity('stock_elementos')
export class StockElemento {
  @PrimaryGeneratedColumn()
  id!: number;

  // Relación con TipoElemento (para categorizar)
  @ManyToOne(() => TipoElemento, { eager: true })
  tipo!: TipoElemento;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  stockActual!: number; // Cantidad disponible

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  stockMinimo!: number; // Alerta cuando baja de este nivel

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  stockTotalIngresado!: number; // Histórico de todo lo ingresado

  @Column({ type: 'varchar', length: 200, nullable: true })
  ubicacion!: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @Column({ default: true })
  activo!: boolean;

  // Historial de movimientos
  @OneToMany(() => MovimientoStock, movimiento => movimiento.stockElemento)
  movimientos!: MovimientoStock[];

  // Auditoría
  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}