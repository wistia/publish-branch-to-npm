import { execSync } from 'child_process';
import core from '@actions/core';

import {
  getInputs,
  getNpmAuthCommand,
  getPackageNameAndVersion,
  getPublishPackageCommand,
  getUniqueVersion,
  getUpdatePackageVersionCommand,
  loadPackageJson,
  postCommentToPullRequest,
} from './helpers.mjs';

try {
  const { npmToken, commitHash, isDryRun } = getInputs();
  const { name, currentVersion } = loadPackageJson();
  const uniqueVersion = getUniqueVersion(currentVersion, commitHash);
  const packageNameAndVersion = getPackageNameAndVersion(name, uniqueVersion);

  // set auth token to allow publishing in CI
  execSync(getNpmAuthCommand(npmToken));

  // update version in package.json (does not get committed)
  execSync(getUpdatePackageVersionCommand(uniqueVersion));

  // publish package
  execSync(getPublishPackageCommand(isDryRun));

  // post comment to PR
  await postCommentToPullRequest(name, uniqueVersion);
} catch (error) {
  console.log(error); // eslint-disable-line no-console
  core.setFailed(error.message);
}
