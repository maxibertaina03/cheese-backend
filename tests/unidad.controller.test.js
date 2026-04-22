const assert = require('node:assert/strict');
const { UnidadController } = require('../dist/controllers/unidad.controller');
const { AppDataSource } = require('../dist/config/database');
const { Motivo } = require('../dist/entities/Motivo');
const { Particion } = require('../dist/entities/Particion');
const { Unidad } = require('../dist/entities/Unidad');
const { Usuario } = require('../dist/entities/Usuario');
const { createMockResponse, overrideProperty } = require('./test-helpers');

module.exports = [
  {
    name: 'UnidadController.addParticiones rechaza cortes mayores al stock disponible',
    run: async () => {
      let transactionCalled = false;
      let saveCalled = false;
      const manager = {
        getRepository: (entity) => {
          if (entity === Unidad) {
            return {
              findOne: async (options) => {
                assert.deepEqual(options.lock, { mode: 'pessimistic_write' });
                return {
                  id: 1,
                  activa: true,
                  pesoActual: 500,
                };
              },
              save: async () => {
                saveCalled = true;
              },
            };
          }

          if (entity === Particion) {
            return {
              create: () => {
                saveCalled = true;
              },
              save: async () => {
                saveCalled = true;
              },
            };
          }

          return {
            findOneBy: async () => null,
          };
        },
      };
      const restoreTransaction = overrideProperty(AppDataSource, 'transaction', async (callback) => {
        transactionCalled = true;
        return callback(manager);
      });

      try {
        const req = {
          params: { id: '1' },
          body: {
            peso: 600,
          },
        };
        const res = createMockResponse();

        await UnidadController.addParticiones(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'Peso insuficiente en la unidad');
        assert.equal(transactionCalled, true);
        assert.equal(saveCalled, false);
      } finally {
        restoreTransaction();
      }
    },
  },
  {
    name: 'UnidadController.addParticiones guarda corte y unidad en una transaccion',
    run: async () => {
      let transactionCalled = false;
      const saveOrder = [];
      const unidad = {
        id: 1,
        activa: true,
        pesoActual: 500,
      };
      const motivo = { id: 3, nombre: 'Venta' };
      const usuario = { id: 7, username: 'maxi' };
      const particionCreada = { id: 99 };
      const particionCompleta = {
        id: 99,
        peso: 200,
        motivo,
        creadoPor: usuario,
      };
      const manager = {
        getRepository: (entity) => {
          if (entity === Unidad) {
            return {
              findOne: async (options) => {
                assert.deepEqual(options.where, { id: 1 });
                assert.deepEqual(options.lock, { mode: 'pessimistic_write' });
                return unidad;
              },
              save: async (payload) => {
                saveOrder.push('unidad');
                assert.equal(payload.pesoActual, 300);
                return payload;
              },
            };
          }

          if (entity === Particion) {
            return {
              create: (payload) => ({
                ...particionCreada,
                ...payload,
              }),
              save: async (payload) => {
                saveOrder.push('particion');
                assert.equal(payload.peso, 200);
                return payload;
              },
              findOne: async (options) => {
                assert.deepEqual(options.where, { id: 99 });
                return particionCompleta;
              },
            };
          }

          if (entity === Motivo) {
            return {
              findOneBy: async ({ id }) => (id === 3 ? motivo : null),
            };
          }

          if (entity === Usuario) {
            return {
              findOneBy: async ({ id }) => (id === 7 ? usuario : null),
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
          params: { id: '1' },
          user: { id: 7, rol: 'admin' },
          body: {
            peso: 200,
            motivoId: 3,
            observacionesCorte: 'Mostrador',
          },
        };
        const res = createMockResponse();

        await UnidadController.addParticiones(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(transactionCalled, true);
        assert.deepEqual(saveOrder, ['particion', 'unidad']);
        assert.equal(res.body.unidad.pesoActual, 300);
        assert.equal(res.body.particion.id, 99);
      } finally {
        restoreTransaction();
      }
    },
  },
];
