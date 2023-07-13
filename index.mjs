import core from '@actions/core';
import {
  getUniqueVersion,
  loadPackageJson,
  displayInstallationInstructions,
  publishNpmPackage,
} from './helpers.mjs';

try {
  const { name, currentVersion } = loadPackageJson();
  const uniqueVersion = getUniqueVersion(currentVersion);

  publishNpmPackage(name, uniqueVersion);

  await displayInstallationInstructions(name, uniqueVersion);
} catch (error) {
  core.error(JSON.stringify(error));
  core.setFailed(error.message);
}
