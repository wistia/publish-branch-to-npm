import { env } from 'process';
import { join } from 'path';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';
import core from '@actions/core';
import { context, getOctokit } from '@actions/github';

const { GITHUB_WORKSPACE } = env;

const commentIdentifier = '<!-- NPM_PUBLISH_BRANCH_COMMENT_PR -->';

// returns an Octokit client that we use to make PR comments
const getGithubClient = () => {
  const githubToken = core.getInput('github_token');

  if (!githubToken) {
    throw new Error('No GitHub token provided');
  }

  if (!context.issue.number) {
    throw new Error('This is not a PR or commenting is disabled.');
  }

  const client = getOctokit(githubToken);

  if (!client) {
    throw new Error('Client could not be created; ensure sure that GitHub token is correct.');
  }

  return client;
};

// iterate through comment list to find one that begins with the
// hidden identifier we added in getPullRequestComment()
const findComment = async (client) => {
  const options = {
    owner: context.issue.owner,
    repo: context.issue.repo,
    issue_number: context.issue.number,
  };
  const comments = await client.rest.issues.listComments(options);

  let commentId = null;

  comments.data.forEach(({ body, id }) => {
    if (body.startsWith(commentIdentifier)) {
      commentId = id;
    }
  });

  return commentId;
};

// posts a comment to the PR if none have been posted yet, but any new posts
// (for example, when a new commit is pushed to the PR) will update original comment
// so that there is only ever a single comment being made by this action
const postCommentToPullRequest = async (client, commentBody) => {
  const commentId = await findComment(client);

  if (commentId) {
    await client.rest.issues.updateComment({
      owner: context.issue.owner,
      repo: context.issue.repo,
      comment_id: commentId,
      body: commentBody,
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

// loads package.json from repo using this action and returns the package name
// and just the beginning X.X.X part of the version
const getPackageJson = () => {
  const packageJsonFilepath = join(GITHUB_WORKSPACE, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonFilepath, 'utf8'));

  if (!packageJson) {
    throw new Error('No package.json file could be found');
  }

  const { name, version } = packageJson;
  const currentVersion = version.trim().split(/[.-]/).slice(0, 3).join('.');
  return { name, currentVersion };
};

// current version + 8 chars of a UUID + 8 chars of the last commit SHA
// must be valid semver https://semver.org/
const getUniqueVersion = (currentVersion, commitSha) => {
  const randomish = crypto.randomUUID().substring(0, 8);
  const sha = commitSha.substring(0, 7);
  return `${currentVersion}-beta.${randomish}.${sha}`;
};

// set auth token to allow publishing in CI
const setNpmToken = () => {
  const npmToken = core.getInput('npm_token');

  if (!npmToken) {
    throw new Error('No npm token provided');
  }

  execSync(`npm config set //registry.npmjs.org/:_authToken ${npmToken}`);
};

// update version in package.json (does not get committed)
const updatePackageVersion = (uniqueVersion) => {
  execSync(`npm version --no-git-tag-version ${uniqueVersion}`);
};

// publish with "beta" tag since if we do not specify a tag, "latest" will be used by default
const publishPackage = () => {
  // note: add --dry-run flag to command below to avoid publishing
  execSync(`npm publish --verbose --tag beta`);
};

// returns GitHub-flavored markdown with some instructions on how to install a branch package with npm & yarn
// GitHub doesn't allow text colors in markdown so we use the diff code-colorization
// to get a light grey for displaying date & time
const getPullRequestComment = (nameAndVersion) => {
  if (!nameAndVersion) {
    throw new Error('Package version must be provided to getPullRequestComment');
  }

  const currentDate = new Date();

  return `${commentIdentifier}
  A new package containing your PR commits has been published; run one of the commands below to update this package in your application:

  ### yarn:

  \`\`\`shell
  yarn upgrade ${nameAndVersion}
  \`\`\`

  ### npm:

  \`\`\`shell
  npm install ${nameAndVersion}
  \`\`\`

  _Note: if you continue to push commits to this PR, new packages will be deployed and this comment will update itself with the new version to install._

  ---

  \`\`\`diff
  # ${currentDate.toDateString()} / ${currentDate.toTimeString()}
  \`\`\`
  `;
};

try {
  const githubClient = getGithubClient();
  const { name, currentVersion } = getPackageJson();
  const commitSha = context.payload.after;
  const uniqueVersion = getUniqueVersion(currentVersion, commitSha);
  const nameAndVersion = `${name}@${uniqueVersion}`;
  const commentBody = getPullRequestComment(nameAndVersion);

  setNpmToken()
  updatePackageVersion(uniqueVersion)
  publishPackage()
  await postCommentToPullRequest(githubClient, commentBody);
} catch (error) {
  core.setFailed(error.message);
}
