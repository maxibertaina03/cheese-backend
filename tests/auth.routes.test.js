const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const authRouter = require('../dist/routes/auth.routes').default;
const { AppDataSource } = require('../dist/config/database');
const {
  overrideProperty,
  requestJson,
  startJsonServer,
} = require('./test-helpers');

module.exports = [
  {
    name: 'POST /api/auth/register rechaza crear admin sin un actor admin',
    run: async () => {
      const server = await startJsonServer('/api/auth', authRouter);

      try {
        const { response, body } = await requestJson(server, '/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            username: 'nuevo.admin',
            password: 'secreto123',
            rol: 'admin',
          }),
        });

        assert.equal(response.status, 403);
        assert.equal(body.error, 'Solo un administrador puede crear otro administrador');
      } finally {
        server.close();
      }
    },
  },
  {
    name: 'POST /api/auth/login devuelve token con credenciales validas',
    run: async () => {
      const restoreInitialized = overrideProperty(AppDataSource, 'isInitialized', true);
      const passwordHash = await bcrypt.hash('secreto123', 4);
      const restoreRepository = overrideProperty(AppDataSource, 'getRepository', () => ({
        findOne: async ({ where }) => {
          if (where.username !== 'maxi') {
            return null;
          }

          return {
            id: 7,
            username: 'maxi',
            rol: 'admin',
            password: passwordHash,
          };
        },
      }));

      const server = await startJsonServer('/api/auth', authRouter);

      try {
        const { response, body } = await requestJson(server, '/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            username: 'maxi',
            password: 'secreto123',
          }),
        });

        assert.equal(response.status, 200);
        assert.equal(body.user.username, 'maxi');
        assert.equal(body.user.rol, 'admin');
        assert.equal(typeof body.token, 'string');
        assert.ok(body.token.length > 20);
      } finally {
        restoreRepository();
        restoreInitialized();
        server.close();
      }
    },
  },
];
