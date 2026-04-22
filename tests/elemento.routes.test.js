const assert = require('node:assert/strict');
const elementoRouter = require('../dist/routes/elemento.routes').default;
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
    name: 'POST /api/elementos valida el body antes de llegar al controller',
    run: async () => {
      const server = await startJsonServer('/api/elementos', elementoRouter);
      const token = createAdminToken();

      try {
        const { response, body } = await requestJson(server, '/api/elementos', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        assert.equal(response.status, 400);
        assert.equal(body.error, 'Validacion fallida');
        assert.ok(Array.isArray(body.details));
        assert.ok(body.details.some((detail) => detail.field === 'nombre'));
        assert.ok(body.details.some((detail) => detail.field === 'cantidadTotal'));
      } finally {
        server.close();
      }
    },
  },
  {
    name: 'POST /api/elementos/:id/ingreso valida id numerico',
    run: async () => {
      const server = await startJsonServer('/api/elementos', elementoRouter);
      const token = createAdminToken();

      try {
        const { response, body } = await requestJson(server, '/api/elementos/abc/ingreso', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cantidad: 1 }),
        });

        assert.equal(response.status, 400);
        assert.equal(body.error, 'Validacion fallida');
        assert.ok(body.details.some((detail) => detail.field === 'id'));
      } finally {
        server.close();
      }
    },
  },
];
