const assert = require('node:assert/strict');
const unidadRouter = require('../dist/routes/unidad.routes').default;
const { signAuthToken } = require('../dist/config/auth');
const { requestJson, startJsonServer } = require('./test-helpers');

module.exports = [
  {
    name: 'POST /api/unidades valida el body antes de llegar al controller',
    run: async () => {
      const server = await startJsonServer('/api/unidades', unidadRouter);
      const token = signAuthToken({
        id: 1,
        rol: 'admin',
        username: 'maxi',
      });

      try {
        const { response, body } = await requestJson(server, '/api/unidades', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        assert.equal(response.status, 400);
        assert.equal(body.error, 'Validacion fallida');
        assert.ok(Array.isArray(body.details));
        assert.ok(body.details.some((detail) => detail.field === 'productoId'));
        assert.ok(body.details.some((detail) => detail.field === 'pesoInicial'));
        assert.ok(body.details.some((detail) => detail.field === 'motivoId'));
      } finally {
        server.close();
      }
    },
  },
];
