const assert = require('node:assert/strict');
const { UnidadController } = require('../dist/controllers/unidad.controller');
const { AppDataSource } = require('../dist/config/database');
const { createMockResponse, overrideProperty } = require('./test-helpers');

module.exports = [
  {
    name: 'UnidadController.addParticiones rechaza cortes mayores al stock disponible',
    run: async () => {
      const restoreRepository = overrideProperty(AppDataSource, 'getRepository', () => ({
        findOneBy: async () => ({
          id: 1,
          activa: true,
          pesoActual: 500,
        }),
      }));

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
      } finally {
        restoreRepository();
      }
    },
  },
];
