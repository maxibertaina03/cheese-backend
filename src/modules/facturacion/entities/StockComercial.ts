import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, UpdateDateColumn } from 'typeorm';
import { Producto } from '../../../entities/Producto';

// Stock de venta (facturación) por producto, en CANTIDAD. Es independiente del
// inventario físico (unidades cargadas con pistola). Una fila por producto.
@Entity('stock_comercial')
export class StockComercial {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Producto, { nullable: false })
  producto!: Producto;

  @Column({ unique: true })
  productoId!: number;

  @Column({ type: 'int', default: 0 })
  cantidadDisponible!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
