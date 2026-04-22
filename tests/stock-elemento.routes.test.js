const assert = require('node:assert/strict');
const stockElementoRouter = require('../dist/routes/stock-elemento.routes').default;
const { signAuthToken } = require('../dist/config/auth');
const { requestJson, startJsonServer } = require('./test-helpers');

const createAdminToken = () =>
  signAuthToken({
    id: 1,
    rol: 'admin',
    username: 'maxi',
  });

module.exports = [
  {
    name: 'POST /api/stock-elementos valida el body antes de llegar al controller',
    run: async () => {
      const server = await startJsonServer('/api/stock-elementos', stockElementoRouter);
      const token = createAdminToken();

      try {
        const { response, body } = await requestJson(server, '/api/stock-elementos', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        assert.equal(response.status, 400);
        assert.equal(body.error, 'Validacion fallida');
        assert.ok(body.details.some((detail) => detail.field === 'tipoId'));
        assert.ok(body.details.some((detail) => detail.field === 'stockInicial'));
      } finally {
        server.close();
      }
    },
  },
  {
    name: 'POST /api/stock-elementos/tipos valida nombre obligatorio',
    run: async () => {
      const server = await startJsonServer('/api/stock-elementos', stockElementoRouter);
      const token = createAdminToken();

      try {
        const { response, body } = await requestJson(server, '/api/stock-elementos/tipos', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        assert.equal(response.status, 400);
        assert.equal(body.error, 'Validacion fallida');
        assert.ok(body.details.some((detail) => detail.field === 'nombre'));
      } finally {
        server.close();
      }
    },
  },
  {
    name: 'POST /api/stock-elementos/:id/egreso valida id numerico',
    run: async () => {
      const server = await startJsonServer('/api/stock-elementos', stockElementoRouter);
      const token = createAdminToken();

      try {
        const { response, body } = await requestJson(server, '/api/stock-elementos/abc/egreso', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cantidad: 1, motivoId: 1 }),
        });

        assert.equal(response.status, 400);
        assert.equal(body.error, 'Validacion fallida');
        assert.ok(body.details.some((detail) => detail.field === 'id'));
      } finally {
        server.close();
      }
    },
  },
  {
    name: 'POST /api/stock-elementos/:id/ajuste rechaza cantidad cero',
    run: async () => {
      const server = await startJsonServer('/api/stock-elementos', stockElementoRouter);
      const token = createAdminToken();

      try {
        const { response, body } = await requestJson(server, '/api/stock-elementos/1/ajuste', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cantidad: 0, motivo: 'Conteo' }),
        });

        assert.equal(response.status, 400);
        assert.equal(body.error, 'Validacion fallida');
        assert.ok(body.details.some((detail) => detail.field === 'cantidad'));
      } finally {
        server.close();
      }
    },
  },
];
