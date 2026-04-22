const assert = require('node:assert/strict');

const authModulePath = '../dist/config/auth';

const resetAuthModule = () => {
  delete require.cache[require.resolve(authModulePath)];
};

const setEnv = ({ nodeEnv, jwtSecret }) => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
  };

  if (nodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = nodeEnv;
  }

  if (jwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = jwtSecret;
  }

  return () => {
    if (previous.NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous.NODE_ENV;
    }

    if (previous.JWT_SECRET === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previous.JWT_SECRET;
    }

    resetAuthModule();
  };
};

module.exports = [
  {
    name: 'Auth config rechaza JWT_SECRET inseguro en produccion',
    run: async () => {
      const restoreEnv = setEnv({
        nodeEnv: 'production',
        jwtSecret: 'change_me',
      });

      try {
        resetAuthModule();
        assert.throws(
          () => require(authModulePath),
          /JWT_SECRET debe configurarse con un valor seguro en produccion/
        );
      } finally {
        restoreEnv();
      }
    },
  },
  {
    name: 'Auth config permite fallback solo fuera de produccion',
    run: async () => {
      const restoreEnv = setEnv({
        nodeEnv: 'test',
        jwtSecret: undefined,
      });

      try {
        resetAuthModule();
        const { JWT_SECRET, signAuthToken, verifyAuthToken } = require(authModulePath);
        const token = signAuthToken({ id: 1, rol: 'admin', username: 'maxi' });
        const decoded = verifyAuthToken(token);

        assert.equal(JWT_SECRET, 'tu_secreto_temporal');
        assert.equal(decoded.id, 1);
        assert.equal(decoded.rol, 'admin');
        assert.equal(decoded.username, 'maxi');
      } finally {
        restoreEnv();
      }
    },
  },
];
