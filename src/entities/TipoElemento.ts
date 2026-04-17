// ============================================
// ARCHIVO: src/entities/TipoElemento.ts (NUEVO)
// ============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { StockElemento } from './StockElemento';

@Entity('tipos_elemento')
export class TipoElemento {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre!: string; // Ej: "Pallet madera", "Caja cartón", "Herramienta"

  @Column({ type: 'varchar', length: 50, nullable: true })
  unidadMedida!: string | null; // Ej: "unidades", "metros", "kg"

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  categoria!: string | null; // Ej: "Embalaje", "Herramienta", "Insumo"

  @Column({ type: 'boolean', default: true })
  llevaStock!: boolean; // Si lleva control de stock o es único

  @Column({ default: true })
  activo!: boolean;

  @OneToMany(() => StockElemento, stock => stock.tipo)
  stocks!: StockElemento[];
}