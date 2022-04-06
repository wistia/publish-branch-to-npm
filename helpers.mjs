import crypto from 'crypto';
import { join } from 'path';
import { readFileSync } from 'fs';
import { env } from 'process';
import core from '@actions/core';
import { getOctokit } from '@actions/github';

// retrieves inputs that are defined in action.yml
// errors are automatically thrown if required inputs are not present
export const getInputs = () => ({
  githubToken: core.getInput('github_token', { required: true }),
  npmToken: core.getInput('npm_token', { required: true }),
  commitHash: core.getInput('commit', { required: true }),
  isDryRun: core.getInput('dry_run') || false,
});

// string used to identify a comment in a PR made by this action
export const getCommentIdentifier = () => '<!-- NPM_PUBLISH_BRANCH_COMMENT_PR -->';

// iterate through comment list to find one that begins with the
// hidden identifier we added in generatePullRequestComment()
export const getCommentId = (commentList, commentIdentifier) => {
  const comment = commentList.find(({ body }) => body.startsWith(commentIdentifier));

  return comment !== undefined ? comment.id : null;
};

// returns an array of comments from current PR
export const getCommentList = async (client, issue) => {
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
export const postCommentToPullRequest = async (context, client, commentBody) => {
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

// returns an Octokit client that we use to make PR comments
export const getGithubClient = (githubToken) => {
  const client = getOctokit(githubToken);

  if (!client) {
    throw new Error('Client could not be created; ensure sure that GitHub token is correct');
  }

  return client;
};

// returns just the beginning X.X.X part of the version
export const getTrimmedPackageVersion = (version) =>
  version.trim().split(/[.-]/).slice(0, 3).join('.');

// current version + 8 chars of a UUID + 8 chars of the last commit hash
// must be valid semver https://semver.org/
export const getUniqueVersion = (currentVersion, commitHash) => {
  const randomish = crypto.randomUUID().substring(0, 8);
  const hash = commitHash.substring(0, 7);
  return `${currentVersion}-beta.${randomish}.${hash}`;
};

export const getPackageNameAndVersion = (name, uniqueVersion) => `${name}@${uniqueVersion}`;

// set auth token to allow publishing in CI
export const getNpmAuthCommand = (npmToken) =>
  `npm config set //registry.npmjs.org/:_authToken ${npmToken}`;

// updates version in package.json
export const getUpdatePackageVersionCommand = (uniqueVersion) =>
  `npm version --git-tag-version false ${uniqueVersion}`;

// publish with "beta" tag since if we do not specify a tag, "latest" will be used by default
export const getPublishPackageCommand = (isDryRun) => {
  let publishCommand = `npm publish --verbose --tag beta`;

  if (isDryRun) {
    publishCommand = `${publishCommand} --dry-run`;
  }

  return publishCommand;
};

// loads package.json from repo and returns the package name & version
export const loadPackageJson = () => {
  const { GITHUB_WORKSPACE } = env;

  if (!GITHUB_WORKSPACE) {
    throw new Error('GITHUB_WORKSPACE env var missing');
  }

  const packageJsonFilepath = join(GITHUB_WORKSPACE, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonFilepath, 'utf8'));

  if (!packageJson) {
    throw new Error('No package.json file could be found');
  }

  const { name, version } = packageJson;
  const currentVersion = getTrimmedPackageVersion(version);
  return { name, currentVersion };
};

// Converts a boolean string value `value` into a boolean. If passed something other than 'true' or 'false' will coerce value to boolean.
export function coerceToBoolean(value) {
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  return Boolean(value);
}

// returns GitHub-flavored markdown with some instructions on how to install a branch package with npm & yarn
// GitHub doesn't allow text colors in markdown so we use the diff code-colorization
// to get a light grey for displaying date & time
export const generatePullRequestComment = (packageNameAndVersion, commentIdentifier) => {
  const currentDate = new Date();

  return `${commentIdentifier}
  A new package containing your PR commits has been published; run one of the commands below to update this package in your application:

  ### yarn:

  \`\`\`shell
  yarn upgrade ${packageNameAndVersion}
  \`\`\`

  ### npm:

  \`\`\`shell
  npm install ${packageNameAndVersion}
  \`\`\`

  _Note: if you continue to push commits to this PR, new packages will be deployed and this comment will update itself with the new version to install._

  ---

  \`\`\`diff
  # ${currentDate.toDateString()} / ${currentDate.toTimeString()}
  \`\`\`
  `;
};
