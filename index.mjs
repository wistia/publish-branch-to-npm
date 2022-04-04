import { execSync } from 'child_process';
import core from '@actions/core';
import { context } from '@actions/github';

import {
  coerceToBoolean,
  getUniqueVersion,
  generatePullRequestComment,
  getCommentIdentifier,
  getCommentId,
  getGithubClient,
  getNpmAuthCommand,
  getUpdatePackageVersionCommand,
  getPackageNameAndVersion,
  loadPackageJson,
  getPublishPackageCommand,
} from './helpers.mjs';

// returns an array of comments from current PR
const getCommentList = async (client, issue) => {
  const options = {
    owner: issue.owner,
    repo: issue.repo,
    issue_number: issue.number,
  };

  return client.rest.issues.listComments(options);
};

// posts a comment to the PR if none have been posted yet, but any new posts
// (for example, when a new commit is pushed to the PR) will update original comment
// so that there is only ever a single comment being made by this action
const postCommentToPullRequest = async (client, commentBody) => {
  if (!context.issue.number) {
    throw new Error('This is not a PR or commenting is disabled');
  }

  const { data: commentList } = await getCommentList(client, context.issue);
  const commentId = getCommentId(commentList, getCommentIdentifier());

  if (commentId) {
    await client.rest.issues.updateComment({
      issue_number: context.issue.number,
      owner: context.issue.owner,
      repo: context.issue.repo,
      body: commentBody,
      comment_id: commentId,
    });
    return;
  }

  await client.rest.issues.createComment({
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
    body: commentBody,
  });
};

try {
  const githubToken = core.getInput('github_token');
  const npmToken = core.getInput('npm_token');
  const commitHash = context.payload.after;

  // early exit because we cannot proceed without these variables
  if (!githubToken) {
    throw new Error('No GitHub token provided');
  }

  if (!npmToken) {
    throw new Error('No npm token provided');
  }

  if (!commitHash) {
    throw new Error('Current commit could not be determined');
  }

  const isDryRun = coerceToBoolean(core.getInput('dry_run'));
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
  execSync(getPublishPackageCommand(isDryRun));

  // post comment to PR
  await postCommentToPullRequest(githubClient, commentBody);
} catch (error) {
  core.setFailed(error.message);
}
