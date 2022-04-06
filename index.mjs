import { execSync } from 'child_process';
import core from '@actions/core';
import { context } from '@actions/github';

import {
  coerceToBoolean,
  generatePullRequestComment,
  getCommentIdentifier,
  getGithubClient,
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
  const { githubToken, npmToken, commitHash, isDryRun } = getInputs();
  const githubClient = getGithubClient(githubToken);
  const { name, currentVersion } = loadPackageJson();
  const uniqueVersion = getUniqueVersion(currentVersion, commitHash);
  const commentBody = generatePullRequestComment(
    getPackageNameAndVersion(name, uniqueVersion),
    getCommentIdentifier(),
  );

  // set auth token to allow publishing in CI
  execSync(getNpmAuthCommand(npmToken));

  // update version in package.json (does not get committed)
  execSync(getUpdatePackageVersionCommand(uniqueVersion));

  // publish package
  execSync(getPublishPackageCommand(coerceToBoolean(isDryRun)));

  // post comment to PR
  await postCommentToPullRequest(context, githubClient, commentBody);
} catch (error) {
  console.log(error); // eslint-disable-line
  core.setFailed(error.message);
}
