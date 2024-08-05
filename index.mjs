import { error as displayError, setFailed, info } from '@actions/core';
import {
  displayInstallationInstructions,
  getUniqueVersion,
  getWorkingDirectory,
  loadPackageJson,
  publishNpmPackage,
} from './helpers.mjs';

try {
  // run all subsequent commands in the working directory
  process.chdir(getWorkingDirectory());

  const { name, currentVersion } = loadPackageJson();
  const uniqueVersion = getUniqueVersion(currentVersion);

  publishNpmPackage(name, uniqueVersion);

  await displayInstallationInstructions(name, uniqueVersion);
} catch (error) {
  displayError(JSON.stringify(error));
  info('this is a test');
  setFailed(error.message);
}
