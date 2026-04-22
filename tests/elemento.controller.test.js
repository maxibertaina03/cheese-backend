const assert = require('node:assert/strict');
const { ElementoController } = require('../dist/controllers/elemento.controller');
const { AppDataSource } = require('../dist/config/database');
const { Elemento } = require('../dist/entities/Elemento');
const { Motivo } = require('../dist/entities/Motivo');
const { MovimientoElemento } = require('../dist/entities/MovimientoElemento');
const { Usuario } = require('../dist/entities/Usuario');
const { createMockResponse, overrideProperty } = require('./test-helpers');

module.exports = [
  {
    name: 'ElementoController.registrarIngreso guarda stock y movimiento en una transaccion',
    run: async () => {
      let transactionCalled = false;
      const saveOrder = [];
      const elemento = {
        id: 4,
        cantidadDisponible: '5.50',
        cantidadTotal: '10.00',
        activo: false,
      };
      const usuario = { id: 9, username: 'admin' };
      const manager = {
        getRepository: (entity) => {
          if (entity === Elemento) {
            return {
              findOne: async (options) => {
                assert.deepEqual(options.where, { id: 4 });
                assert.deepEqual(options.lock, { mode: 'pessimistic_write' });
                return elemento;
              },
              save: async (payload) => {
                saveOrder.push('elemento');
                assert.equal(payload.cantidadDisponible, 8);
                assert.equal(payload.cantidadTotal, 12.5);
                assert.equal(payload.activo, true);
                return payload;
              },
            };
          }

          if (entity === MovimientoElemento) {
            return {
              create: (payload) => ({ id: 77, ...payload }),
              save: async (payload) => {
                saveOrder.push('movimiento');
                assert.equal(payload.tipo, 'ingreso');
                assert.equal(payload.cantidad, 2.5);
                assert.equal(payload.stockAnterior, 5.5);
                assert.equal(payload.stockNuevo, 8);
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
          params: { id: '4' },
          user: { id: 9, rol: 'admin' },
          body: {
            cantidad: 2.5,
            observaciones: 'Compra',
          },
        };
        const res = createMockResponse();

        await ElementoController.registrarIngreso(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(transactionCalled, true);
        assert.deepEqual(saveOrder, ['elemento', 'movimiento']);
        assert.equal(res.body.stockAnterior, 5.5);
        assert.equal(res.body.stockNuevo, 8);
      } finally {
        restoreTransaction();
      }
    },
  },
  {
    name: 'ElementoController.registrarEgreso rechaza stock insuficiente sin guardar cambios',
    run: async () => {
      let transactionCalled = false;
      let saveCalled = false;
      const manager = {
        getRepository: (entity) => {
          if (entity === Elemento) {
            return {
              findOne: async (options) => {
                assert.deepEqual(options.where, { id: 4 });
                assert.deepEqual(options.lock, { mode: 'pessimistic_write' });
                return {
                  id: 4,
                  cantidadDisponible: '3.00',
                  activo: true,
                };
              },
              save: async () => {
                saveCalled = true;
              },
            };
          }

          if (entity === MovimientoElemento) {
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
          params: { id: '4' },
          body: {
            cantidad: 5,
            motivoId: 1,
          },
        };
        const res = createMockResponse();

        await ElementoController.registrarEgreso(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'Stock insuficiente. Disponible: 3');
        assert.equal(transactionCalled, true);
        assert.equal(saveCalled, false);
      } finally {
        restoreTransaction();
      }
    },
  },
];
