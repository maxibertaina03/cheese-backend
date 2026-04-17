const suites = [
  ...require('./auth.routes.test'),
  ...require('./unidad.routes.test'),
  ...require('./unidad.controller.test'),
];

async function run() {
  let failed = 0;

  for (const suite of suites) {
    try {
      await suite.run();
      console.log(`PASS ${suite.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${suite.name}`);
      console.error(error);
    }
  }

  console.log(`\n${suites.length - failed}/${suites.length} pruebas OK`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run();
