import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Producto } from '../../inventario-quesos/entities/Producto';
import { Proveedor } from '../../indumentaria/entities/Proveedor';
import { Usuario } from '../../identidad/entities/Usuario';

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

  // 🆕 Datos de la compra (solo en ingresos por carga): fecha, comprobante de compra
  // (prefijo + número), precio de compra unitario y proveedor. Sirven para la ganancia.
  @Column({ type: 'date', nullable: true })
  fechaComprobante!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  comprobantePrefijo!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  comprobanteNumero!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  precioCompra!: number | null;

  @ManyToOne(() => Proveedor, { nullable: true })
  proveedor!: Proveedor | null;

  @Column({ type: 'int', nullable: true })
  proveedorId!: number | null;

  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @CreateDateColumn()
  createdAt!: Date;
}
