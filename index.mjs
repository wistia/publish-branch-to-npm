import core from '@actions/core';
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
  core.error(JSON.stringify(error));
  core.setFailed(error.message);
}
