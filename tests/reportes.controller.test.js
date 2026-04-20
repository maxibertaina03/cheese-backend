const assert = require('node:assert/strict');
const { ReportesController } = require('../dist/controllers/reportes.controller');
const { AppDataSource } = require('../dist/config/database');
const { createMockResponse, overrideProperty } = require('./test-helpers');

const createFakeUnidadQueryBuilder = (rows = []) => {
  const calls = [];
  const queryBuilder = {
    calls,
    leftJoinAndSelect(...args) {
      calls.push(['leftJoinAndSelect', ...args]);
      return this;
    },
    where(...args) {
      calls.push(['where', ...args]);
      return this;
    },
    andWhere(...args) {
      calls.push(['andWhere', ...args]);
      return this;
    },
    orderBy(...args) {
      calls.push(['orderBy', ...args]);
      return this;
    },
    addOrderBy(...args) {
      calls.push(['addOrderBy', ...args]);
      return this;
    },
    withDeleted() {
      calls.push(['withDeleted']);
      return this;
    },
    async getMany() {
      calls.push(['getMany']);
      return rows;
    },
  };

  return queryBuilder;
};

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
  {
    name: 'ReportesController.exportInventarioPdf filtra unidades activas por tipo y observaciones',
    run: async () => {
      const fakeQueryBuilder = createFakeUnidadQueryBuilder([]);
      const restoreRepository = overrideProperty(AppDataSource, 'getRepository', () => ({
        createQueryBuilder: () => fakeQueryBuilder,
      }));

      try {
        const req = {
          query: {
            search: 'azul',
            tipoQuesoId: 4,
            searchObservaciones: 'true',
          },
        };
        const res = createMockResponse();

        await ReportesController.exportInventarioPdf(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['Content-Type'], 'application/pdf');
        assert.ok(Buffer.isBuffer(res.body));
        assert.ok(fakeQueryBuilder.calls.some((call) => call[0] === 'where' && call[1] === 'unidad.activa = true'));
        assert.ok(fakeQueryBuilder.calls.some((call) => call[0] === 'andWhere' && call[1] === 'tipo.id = :tipoQuesoId'));
        assert.ok(
          fakeQueryBuilder.calls.some(
            (call) => call[0] === 'andWhere' && String(call[1]).includes('observacionesIngreso')
          )
        );
      } finally {
        restoreRepository();
      }
    },
  },
  {
    name: 'ReportesController.exportHistorialPdf incluye eliminados y aplica estado y fechas',
    run: async () => {
      const fakeQueryBuilder = createFakeUnidadQueryBuilder([]);
      const restoreRepository = overrideProperty(AppDataSource, 'getRepository', () => ({
        createQueryBuilder: () => fakeQueryBuilder,
      }));

      try {
        const req = {
          query: {
            estado: 'agotados',
            fechaInicio: '2026-04-01',
            fechaFin: '2026-04-20',
          },
        };
        const res = createMockResponse();

        await ReportesController.exportHistorialPdf(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['Content-Type'], 'application/pdf');
        assert.ok(Buffer.isBuffer(res.body));
        assert.ok(fakeQueryBuilder.calls.some((call) => call[0] === 'withDeleted'));
        assert.ok(
          fakeQueryBuilder.calls.some(
            (call) => call[0] === 'andWhere' && String(call[1]).includes('unidad.activa = false')
          )
        );
        assert.ok(
          fakeQueryBuilder.calls.some(
            (call) => call[0] === 'andWhere' && String(call[1]).includes('unidad.createdAt BETWEEN')
          )
        );
      } finally {
        restoreRepository();
      }
    },
  },
];
