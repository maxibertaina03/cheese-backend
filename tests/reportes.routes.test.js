const assert = require('node:assert/strict');
const reportesRouter = require('../dist/routes/reportes.routes').default;
const { signAuthToken } = require('../dist/config/auth');
const { requestJson, startJsonServer } = require('./test-helpers');

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
];
