const assert = require('node:assert/strict');
const { StockElementoController } = require('../dist/controllers/stock-elemento.controller');
const { AppDataSource } = require('../dist/config/database');
const { Motivo } = require('../dist/entities/Motivo');
const { MovimientoStock } = require('../dist/entities/MovimientoStock');
const { StockElemento } = require('../dist/entities/StockElemento');
const { TipoElemento } = require('../dist/entities/TipoElemento');
const { Usuario } = require('../dist/entities/Usuario');
const { createMockResponse, overrideProperty } = require('./test-helpers');

module.exports = [
  {
    name: 'StockElementoController.create guarda stock inicial y movimiento en una transaccion',
    run: async () => {
      let transactionCalled = false;
      const saveOrder = [];
      const tipo = { id: 2, nombre: 'Envases' };
      const usuario = { id: 9, username: 'admin' };
      const stockCompleto = { id: 20, tipo, stockActual: 12 };
      const manager = {
        getRepository: (entity) => {
          if (entity === TipoElemento) {
            return {
              findOneBy: async ({ id }) => (id === 2 ? tipo : null),
            };
          }

          if (entity === Usuario) {
            return {
              findOneBy: async ({ id }) => (id === 9 ? usuario : null),
            };
          }

          if (entity === StockElemento) {
            return {
              findOne: async (options) => {
                if (options.relations) {
                  assert.deepEqual(options.where, { id: 20 });
                  return stockCompleto;
                }
                assert.deepEqual(options.where, {
                  tipo: { id: 2 },
                  ubicacion: 'Deposito',
                  activo: true,
                });
                return null;
              },
              create: (payload) => ({
                id: 20,
                ...payload,
              }),
              save: async (payload) => {
                saveOrder.push('stock');
                assert.equal(payload.stockActual, 12);
                assert.equal(payload.stockTotalIngresado, 12);
                assert.equal(payload.stockMinimo, 4);
                return payload;
              },
            };
          }

          if (entity === MovimientoStock) {
            return {
              create: (payload) => ({ id: 90, ...payload }),
              save: async (payload) => {
                saveOrder.push('movimiento');
                assert.equal(payload.tipo, 'INGRESO');
                assert.equal(payload.cantidad, 12);
                assert.equal(payload.stockAnterior, 0);
                assert.equal(payload.stockNuevo, 12);
                return payload;
              },
            };
          }

          throw new Error('Repositorio inesperado');
        },
      };
      const restoreTransaction = overrideProperty(AppDataSource, 'transaction', async (callback) => {
        transactionCalled = true;
        return callback(manager);
      });

      try {
        const req = {
          user: { id: 9, rol: 'admin' },
          body: {
            tipoId: 2,
            stockInicial: 12,
            stockMinimo: 4,
            ubicacion: 'Deposito',
          },
        };
        const res = createMockResponse();

        await StockElementoController.create(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(transactionCalled, true);
        assert.deepEqual(saveOrder, ['stock', 'movimiento']);
        assert.equal(res.body.id, 20);
      } finally {
        restoreTransaction();
      }
    },
  },
  {
    name: 'StockElementoController.ingresarStock guarda stock y movimiento en una transaccion',
    run: async () => {
      let transactionCalled = false;
      const saveOrder = [];
      const stockElemento = {
        id: 5,
        activo: true,
        stockActual: '3.50',
        stockTotalIngresado: '10.00',
      };
      const usuario = { id: 9, username: 'admin' };
      const manager = {
        getRepository: (entity) => {
          if (entity === StockElemento) {
            return {
              findOne: async (options) => {
                assert.deepEqual(options.where, { id: 5 });
                assert.deepEqual(options.lock, { mode: 'pessimistic_write' });
                return stockElemento;
              },
              save: async (payload) => {
                saveOrder.push('stock');
                assert.equal(payload.stockActual, 5.5);
                assert.equal(payload.stockTotalIngresado, 12);
                return payload;
              },
            };
          }

          if (entity === MovimientoStock) {
            return {
              create: (payload) => ({ id: 91, ...payload }),
              save: async (payload) => {
                saveOrder.push('movimiento');
                assert.equal(payload.tipo, 'INGRESO');
                assert.equal(payload.cantidad, 2);
                assert.equal(payload.stockAnterior, 3.5);
                assert.equal(payload.stockNuevo, 5.5);
                return payload;
              },
            };
          }

          if (entity === Usuario) {
            return {
              findOneBy: async ({ id }) => (id === 9 ? usuario : null),
            };
          }

          throw new Error('Repositorio inesperado');
        },
      };
      const restoreTransaction = overrideProperty(AppDataSource, 'transaction', async (callback) => {
        transactionCalled = true;
        return callback(manager);
      });

      try {
        const req = {
          params: { id: '5' },
          user: { id: 9, rol: 'admin' },
          body: {
            cantidad: 2,
            observaciones: 'Compra',
          },
        };
        const res = createMockResponse();

        await StockElementoController.ingresarStock(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(transactionCalled, true);
        assert.deepEqual(saveOrder, ['stock', 'movimiento']);
        assert.equal(res.body.stockAnterior, 3.5);
        assert.equal(res.body.stockNuevo, 5.5);
      } finally {
        restoreTransaction();
      }
    },
  },
  {
    name: 'StockElementoController.egresarStock rechaza stock insuficiente sin guardar cambios',
    run: async () => {
      let transactionCalled = false;
      let saveCalled = false;
      const manager = {
        getRepository: (entity) => {
          if (entity === StockElemento) {
            return {
              findOne: async (options) => {
                assert.deepEqual(options.where, { id: 5 });
                assert.deepEqual(options.lock, { mode: 'pessimistic_write' });
                return {
                  id: 5,
                  stockActual: '2.00',
                  stockMinimo: '1.00',
                };
              },
              save: async () => {
                saveCalled = true;
              },
            };
          }

          if (entity === MovimientoStock) {
            return {
              create: () => {
                saveCalled = true;
              },
              save: async () => {
                saveCalled = true;
              },
            };
          }

          if (entity === Motivo || entity === Usuario) {
            return {
              findOneBy: async () => null,
            };
          }

          throw new Error('Repositorio inesperado');
        },
      };
      const restoreTransaction = overrideProperty(AppDataSource, 'transaction', async (callback) => {
        transactionCalled = true;
        return callback(manager);
      });

      try {
        const req = {
          params: { id: '5' },
          body: {
            cantidad: 4,
            motivoId: 1,
          },
        };
        const res = createMockResponse();

        await StockElementoController.egresarStock(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'Stock insuficiente. Disponible: 2');
        assert.equal(transactionCalled, true);
        assert.equal(saveCalled, false);
      } finally {
        restoreTransaction();
      }
    },
  },
  {
    name: 'StockElementoController.ajusteStock rechaza stock negativo sin guardar cambios',
    run: async () => {
      let transactionCalled = false;
      let saveCalled = false;
      const manager = {
        getRepository: (entity) => {
          if (entity === StockElemento) {
            return {
              findOne: async (options) => {
                assert.deepEqual(options.where, { id: 5 });
                assert.deepEqual(options.lock, { mode: 'pessimistic_write' });
                return {
                  id: 5,
                  stockActual: '3.00',
                  stockTotalIngresado: '10.00',
                };
              },
              save: async () => {
                saveCalled = true;
              },
            };
          }

          if (entity === MovimientoStock) {
            return {
              create: () => {
                saveCalled = true;
              },
              save: async () => {
                saveCalled = true;
              },
            };
          }

          if (entity === Usuario) {
            return {
              findOneBy: async () => null,
            };
          }

          throw new Error('Repositorio inesperado');
        },
      };
      const restoreTransaction = overrideProperty(AppDataSource, 'transaction', async (callback) => {
        transactionCalled = true;
        return callback(manager);
      });

      try {
        const req = {
          params: { id: '5' },
          body: {
            cantidad: -4,
            motivo: 'Ajuste por conteo',
          },
        };
        const res = createMockResponse();

        await StockElementoController.ajusteStock(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'El ajuste dejaria el stock en negativo');
        assert.equal(transactionCalled, true);
        assert.equal(saveCalled, false);
      } finally {
        restoreTransaction();
      }
    },
  },
];
