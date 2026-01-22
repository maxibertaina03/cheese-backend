import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { TipoQueso } from './TipoQueso';
import { Unidad } from './Unidad';

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  nombre!: string;

  // PLU / código interno (balanza)
  @Column({ length: 20, unique: true })
  plu!: string;

  @Column({ default: false })
  seVendePorUnidad!: boolean;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  precioPorKilo!: number | null;


  @ManyToOne(() => TipoQueso, (tipo) => tipo.productos, { nullable: false })
  tipoQueso!: TipoQueso;

  @OneToMany(() => Unidad, (unidad) => unidad.producto)
  unidades!: Unidad[];

  @CreateDateColumn()
  createdAt!: Date;
}
