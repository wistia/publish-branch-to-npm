import { execSync } from 'child_process';
import core from '@actions/core';
import { context } from '@actions/github';

import {
  coerceToBoolean,
  generatePullRequestComment,
  getCommentIdentifier,
  getGithubClient,
  getNpmAuthCommand,
  getPackageNameAndVersion,
  getPublishPackageCommand,
  getUniqueVersion,
  getUpdatePackageVersionCommand,
  loadPackageJson,
  postCommentToPullRequest,
} from './helpers.mjs';

try {
  // action inputs
  const githubToken = core.getInput('github_token');
  const npmToken = core.getInput('npm_token');
  const commitHash = context.payload.after;
  const isDryRun = core.getInput('dry_run');

  // early exit because we cannot proceed without these variables
  if (!githubToken) {
    throw new Error('No GitHub token provided');
  }

  if (!npmToken) {
    throw new Error('No npm token provided');
  }

  if (!commitHash) {
    throw new Error('Current commit hash could not be determined');
  }

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
