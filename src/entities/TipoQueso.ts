import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Producto } from './Producto';

@Entity('tipos_queso')
export class TipoQueso {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  nombre!: string;

  @OneToMany(() => Producto, (producto) => producto.tipoQueso)
  productos!: Producto[];

  @CreateDateColumn()
  createdAt!: Date;
}

