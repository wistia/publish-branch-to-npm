import { error as displayError, setFailed } from '@actions/core';
import { publishNpmPackage } from './src/helpers.mjs';

try {
  await publishNpmPackage();
} catch (error) {
  displayError(JSON.stringify(error));
  setFailed(error.message);
}
