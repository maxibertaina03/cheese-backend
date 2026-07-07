import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Producto } from '../../../entities/Producto';
import { Usuario } from '../../../entities/Usuario';

// Historial de movimientos del stock comercial (carga, venta, ajuste).
@Entity('movimientos_stock_comercial')
export class MovimientoStockComercial {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Producto, { nullable: false })
  producto!: Producto;

  @Column()
  productoId!: number;

  @Column({ type: 'varchar', length: 20 })
  tipo!: 'ingreso' | 'egreso' | 'ajuste';

  @Column({ type: 'int' })
  cantidad!: number;

  @Column({ type: 'int' })
  stockAnterior!: number;

  @Column({ type: 'int' })
  stockNuevo!: number;

  // Referencia legible: "Carga" o "NP 1-5" (nota de pedido) o "NC 3-2" (nota de crédito).
  @Column({ type: 'varchar', length: 60, nullable: true })
  referencia!: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @CreateDateColumn()
  createdAt!: Date;
}
