import { error as displayError, setFailed } from '@actions/core';
import { publishNpmPackage } from './src/helpers.mjs';

try {
  // this is a bundled GitHub Action entry point, it is never loaded via require()
  // oxlint-disable-next-line node/no-top-level-await
  await publishNpmPackage();
} catch (error) {
  displayError(JSON.stringify(error));
  setFailed(error.message);
}
