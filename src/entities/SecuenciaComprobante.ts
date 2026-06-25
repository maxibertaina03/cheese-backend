import { Entity, PrimaryColumn, Column } from 'typeorm';

// Numeración correlativa por tipo de comprobante. Una fila por tipo:
//   1 = Nota de Pedido, 2 = Recibo, 3 = Nota de Crédito.
// El número siguiente se obtiene bloqueando la fila e incrementando `ultimoNumero`
// dentro de la misma transacción que crea el comprobante, para no dejar huecos.
@Entity('secuencias_comprobante')
export class SecuenciaComprobante {
  @PrimaryColumn({ type: 'int' })
  tipo!: number;

  @Column({ type: 'varchar', length: 10, default: '1' })
  prefijo!: string;

  @Column({ type: 'int', default: 0 })
  ultimoNumero!: number;
}
