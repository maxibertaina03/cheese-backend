const assert = require('node:assert/strict');
const { ReportesController } = require('../dist/controllers/reportes.controller');
const { AppDataSource } = require('../dist/config/database');
const { createMockResponse, overrideProperty } = require('./test-helpers');

module.exports = [
  {
    name: 'ReportesController.getTopProductos normaliza campos numericos',
    run: async () => {
      const fakeQueryBuilder = {
        leftJoin() {
          return this;
        },
        select() {
          return this;
        },
        addSelect() {
          return this;
        },
        groupBy() {
          return this;
        },
        addGroupBy() {
          return this;
        },
        orderBy() {
          return this;
        },
        limit() {
          return this;
        },
        async getRawMany() {
          return [
            {
              productoId: '3',
              nombre: 'Pategras',
              totalVendido: '2450.50',
              cantidadCortes: '7',
              promedioCorte: '350.07',
            },
          ];
        },
      };

      const restoreRepository = overrideProperty(AppDataSource, 'getRepository', () => ({
        createQueryBuilder: () => fakeQueryBuilder,
      }));

      try {
        const req = {
          query: {
            limit: 5,
          },
        };
        const res = createMockResponse();

        await ReportesController.getTopProductos(req, res);

        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, [
          {
            productoId: 3,
            nombre: 'Pategras',
            totalVendido: 2450.5,
            cantidadCortes: 7,
            promedioCorte: 350.07,
          },
        ]);
      } finally {
        restoreRepository();
      }
    },
  },
];
