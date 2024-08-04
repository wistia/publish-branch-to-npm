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

  console.log('githhub workspace', process.env.GITHUB_WORKSPACE); // eslint-disable-line no-console
  console.log('current working directory:', getWorkingDirectory()); // eslint-disable-line no-console
  console.log('\npublishing to npm in directory:', process.cwd()); // eslint-disable-line no-console

  const { name, currentVersion } = loadPackageJson();
  const uniqueVersion = getUniqueVersion(currentVersion);

  publishNpmPackage(name, uniqueVersion);

  await displayInstallationInstructions(name, uniqueVersion);
} catch (error) {
  core.error(JSON.stringify(error));
  core.setFailed(error.message);
}
