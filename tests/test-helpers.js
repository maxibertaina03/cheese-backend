const express = require('express');

async function startJsonServer(basePath, router) {
  const app = express();
  app.use(express.json());
  app.use(basePath, router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function requestJson(server, path, options = {}) {
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  let body = null;

  if (text) {
    body = JSON.parse(text);
  }

  return { response, body };
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function overrideProperty(target, property, value) {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, {
    configurable: true,
    writable: true,
    value,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, property, descriptor);
      return;
    }

    delete target[property];
  };
}

module.exports = {
  createMockResponse,
  overrideProperty,
  requestJson,
  startJsonServer,
};
