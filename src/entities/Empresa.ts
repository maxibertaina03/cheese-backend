import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Datos del emisor (la propia empresa). Es una configuración única (singleton):
// en la práctica existe una sola fila, que se muestra en todos los comprobantes.
@Entity('empresa')
export class Empresa {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200, default: '' })
  razonSocial!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cuit!: string | null;

  @Column({ type: 'varchar', length: 250, nullable: true })
  direccion!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  codigoPostal!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  localidad!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  provincia!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  telefono!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  condicionIva!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
