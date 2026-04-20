const assert = require('node:assert/strict');
const reportesRouter = require('../dist/routes/reportes.routes').default;
const { signAuthToken } = require('../dist/config/auth');
const { AppDataSource } = require('../dist/config/database');
const { overrideProperty, requestJson, startJsonServer } = require('./test-helpers');

const createFakeUnidadQueryBuilder = (rows) => {
  const queryBuilder = {
    leftJoinAndSelect() {
      return this;
    },
    where() {
      return this;
    },
    andWhere() {
      return this;
    },
    orderBy() {
      return this;
    },
    addOrderBy() {
      return this;
    },
    withDeleted() {
      return this;
    },
    async getMany() {
      return rows;
    },
  };

  return queryBuilder;
};

module.exports = [
  {
    name: 'GET /api/reportes/top-productos valida el limite maximo',
    run: async () => {
      const server = await startJsonServer('/api/reportes', reportesRouter);
      const token = signAuthToken({
        id: 1,
        rol: 'admin',
        username: 'maxi',
      });

      try {
        const { response, body } = await requestJson(server, '/api/reportes/top-productos?limit=80', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        assert.equal(response.status, 400);
        assert.equal(body.error, 'Validacion fallida');
        assert.ok(body.details.some((detail) => detail.field === 'limit'));
      } finally {
        server.close();
      }
    },
  },
  {
    name: 'GET /api/reportes/ventas rechaza rangos invertidos',
    run: async () => {
      const server = await startJsonServer('/api/reportes', reportesRouter);
      const token = signAuthToken({
        id: 1,
        rol: 'admin',
        username: 'maxi',
      });

      try {
        const { response, body } = await requestJson(
          server,
          '/api/reportes/ventas?fechaInicio=2026-04-10&fechaFin=2026-04-01',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        assert.equal(response.status, 400);
        assert.equal(body.error, 'El rango de fechas es invalido');
      } finally {
        server.close();
      }
    },
  },
  {
    name: 'GET /api/reportes/dashboard rechaza rango incompleto',
    run: async () => {
      const server = await startJsonServer('/api/reportes', reportesRouter);
      const token = signAuthToken({
        id: 1,
        rol: 'admin',
        username: 'maxi',
      });

      try {
        const { response, body } = await requestJson(
          server,
          '/api/reportes/dashboard?fechaInicio=2026-04-01',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        assert.equal(response.status, 400);
        assert.equal(body.error, 'El rango de fechas es incompleto');
      } finally {
        server.close();
      }
    },
  },
  {
    name: 'GET /api/reportes/export/excel rechaza rango incompleto',
    run: async () => {
      const server = await startJsonServer('/api/reportes', reportesRouter);
      const token = signAuthToken({
        id: 1,
        rol: 'admin',
        username: 'maxi',
      });

      try {
        const { response, body } = await requestJson(
          server,
          '/api/reportes/export/excel?fechaFin=2026-04-20',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        assert.equal(response.status, 400);
        assert.equal(body.error, 'El rango de fechas es incompleto');
      } finally {
        server.close();
      }
    },
  },
  {
    name: 'GET /api/reportes/export/inventario/pdf requiere autenticacion',
    run: async () => {
      const server = await startJsonServer('/api/reportes', reportesRouter);

      try {
        const { response, body } = await requestJson(server, '/api/reportes/export/inventario/pdf', {
          method: 'GET',
        });

        assert.equal(response.status, 401);
        assert.equal(body.error, 'No autorizado - No hay token');
      } finally {
        server.close();
      }
    },
  },
  {
    name: 'GET /api/reportes/export/historial/pdf rechaza rango incompleto',
    run: async () => {
      const server = await startJsonServer('/api/reportes', reportesRouter);
      const token = signAuthToken({
        id: 1,
        rol: 'admin',
        username: 'maxi',
      });

      try {
        const { response, body } = await requestJson(
          server,
          '/api/reportes/export/historial/pdf?fechaInicio=2026-04-01',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        assert.equal(response.status, 400);
        assert.equal(body.error, 'El rango de fechas es incompleto');
      } finally {
        server.close();
      }
    },
  },
  {
    name: 'GET /api/reportes/export/historial/pdf rechaza rango invertido',
    run: async () => {
      const server = await startJsonServer('/api/reportes', reportesRouter);
      const token = signAuthToken({
        id: 1,
        rol: 'admin',
        username: 'maxi',
      });

      try {
        const { response, body } = await requestJson(
          server,
          '/api/reportes/export/historial/pdf?fechaInicio=2026-04-20&fechaFin=2026-04-01',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        assert.equal(response.status, 400);
        assert.equal(body.error, 'El rango de fechas es invalido');
      } finally {
        server.close();
      }
    },
  },
  {
    name: 'GET /api/reportes/export/historial/pdf acepta filtro estado',
    run: async () => {
      const server = await startJsonServer('/api/reportes', reportesRouter);
      const token = signAuthToken({
        id: 1,
        rol: 'admin',
        username: 'maxi',
      });
      const restoreRepository = overrideProperty(AppDataSource, 'getRepository', () => ({
        createQueryBuilder: () => createFakeUnidadQueryBuilder([]),
      }));

      try {
        const address = server.address();
        const response = await fetch(
          `http://127.0.0.1:${address.port}/api/reportes/export/historial/pdf?estado=activos`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /application\/pdf/);
      } finally {
        restoreRepository();
        server.close();
      }
    },
  },
];
