import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { endGroup, getInput, notice, startGroup } from '@actions/core';
import { getOctokit, context } from '@actions/github';

// retrieves inputs that are defined in action.yml
// errors are automatically thrown if required inputs are not present
export const getInputs = () => ({
  githubToken: getInput('github_token', { required: true }),
  npmToken: getInput('npm_token', { required: true }),
  commitHash: getInput('commit_hash', { required: true }),
  isDryRun: getInput('dry_run', { required: false }) === 'true',
  workingDirectory: getInput('working_directory', { required: false }) || '.',
});

export const getWorkingDirectory = () => {
  const githubWorkspace = process.env.GITHUB_WORKSPACE;

  if (!githubWorkspace) {
    throw new Error('GITHUB_WORKSPACE env var missing');
  }

  const { workingDirectory } = getInputs();

  return join(githubWorkspace, workingDirectory);
};

// returns an object with the eventName and boolean properties
// indicating if it's a pull request of manual workflow dispatch
export const getEventType = () => {
  const eventName = process.env.GITHUB_EVENT_NAME;

  if (!eventName) {
    throw new Error('GITHUB_EVENT_NAME env var missing');
  }

  const isPullRequest = eventName === 'pull_request';
  const isWorkflowDispatch = eventName === 'workflow_dispatch';

  return { eventName, isPullRequest, isWorkflowDispatch };
};

// iterate through comment list to find one that begins with the
// hidden identifier we added in generateInstallationInstructionsMarkdown()
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

// current version + 8 chars of a UUID + 7 chars of the commit hash
// must be valid semver https://semver.org/
export const getUniqueVersion = (currentVersion, optionalCommitHash) => {
  const versionPrefix = 'beta'; // alpha, rc
  const randomish = crypto.randomUUID().substring(0, 8);
  const commitHash = optionalCommitHash || getInputs().commitHash;
  const hash = commitHash.substring(0, 7);
  return `${currentVersion}-${versionPrefix}.${randomish}.${hash}`;
};

// set auth token to allow publishing in CI
// flags are necessary to avoid errors in workspace repos
// see: https://github.com/npm/cli/issues/6099
export const getNpmAuthCommand = (npmToken) =>
  `npm config set --workspaces=false --include-workspace-root //registry.npmjs.org/:_authToken ${npmToken}`;

// updates version in package.json
export const getUpdatePackageVersionCommand = (uniqueVersion) =>
  `npm version --git-tag-version false ${uniqueVersion}`;

// Converts a boolean string value `value` into a boolean.
// If passed something other than 'true' or 'false' will coerce value to boolean.
export const coerceToBoolean = (value) => {
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  return Boolean(value);
};

// publish with "beta" tag since if we do not specify a tag, "latest" will be used by default
export const getPublishPackageCommand = (isDryRun) => {
  let publishCommand = 'npm publish --verbose --tag beta';

  if (coerceToBoolean(isDryRun)) {
    publishCommand = `${publishCommand} --dry-run`;
  }

  return publishCommand;
};

// returns a fully qualified package and version for installation instructions
export const getPackageNameAndVersion = (name, uniqueVersion) => `${name}@${uniqueVersion}`;

// loads package.json from repo and returns the package name & version
export const loadPackageJson = () => {
  const packageJsonFilepath = join(getWorkingDirectory(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonFilepath, 'utf8'));

  if (!packageJson) {
    throw new Error('No package.json file could be found');
  }

  const { name, version } = packageJson;
  const currentVersion = getTrimmedPackageVersion(version);
  return { name, currentVersion };
};

// returns GitHub-flavored markdown with some instructions on how to install a branch package
// GitHub doesn't allow text colors in markdown so we use the diff code-colorization
// to get a light grey for displaying date & time
export const generateInstallationInstructionsMarkdown = (
  packageName,
  packageNameAndVersion,
  commentIdentifier,
) => {
  const currentDate = new Date();

  return `${commentIdentifier}
  ### ${packageName}

  A new package containing your PR commits has been published! Run one of the commands below to update this package in your application:

  #### yarn:

  \`\`\`shell
  yarn add ${packageNameAndVersion}
  \`\`\`

  #### npm:

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

// returns text-based instructions that are displayed inside an annotation on GitHub
export const generateInstallationInstructionsAnnotation = (packageName, packageNameAndVersion) => `
${packageName}

A new package containing your PR commits has been published! Run one of the commands below to update this package in your application:

  * yarn add ${packageNameAndVersion}

  * npm install ${packageNameAndVersion}
`;

// posts a comment to the PR if none have been posted yet, but any new posts
// (for example, when a new commit is pushed to the PR) will update original comment
// so that there is only ever a single comment being made by this action
export const postCommentToPullRequest = async (packageName, packageNameAndVersion) => {
  if (!context.issue.number) {
    throw new Error('This is not a PR or commenting is disabled');
  }

  // string used to identify a comment in a PR made by this action
  const commentIdentifier = '<!-- NPM_PUBLISH_BRANCH_COMMENT_PR -->';
  const { githubToken } = getInputs();
  const githubClient = getGithubClient(githubToken);
  const commentBody = generateInstallationInstructionsMarkdown(
    packageName,
    packageNameAndVersion,
    commentIdentifier,
  );
  const { data: commentList } = await getCommentList(githubClient, context.issue);
  const commentId = getCommentId(commentList, commentIdentifier);

  if (commentId) {
    await githubClient.rest.issues.updateComment({
      issue_number: context.issue.number,
      owner: context.issue.owner,
      repo: context.issue.repo,
      body: commentBody,
      comment_id: commentId,
    });
    return;
  }

  await githubClient.rest.issues.createComment({
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
    body: commentBody,
  });
};

export const displayInstallationInstructions = (name, uniqueVersion) => {
  const packageName = name;
  const packageNameAndVersion = getPackageNameAndVersion(packageName, uniqueVersion);
  const { isPullRequest, isWorkflowDispatch } = getEventType();

  if (isPullRequest) {
    return postCommentToPullRequest(packageName, packageNameAndVersion);
  }

  if (isWorkflowDispatch) {
    const commentBody = generateInstallationInstructionsAnnotation(
      packageName,
      packageNameAndVersion,
    );

    return notice(commentBody);
  }

  throw new Error(
    `Package (${packageNameAndVersion}) may have been published but installation instructions could not be displayed, check https://www.npmjs.com/package/${name}?activeTab=versions`,
  );
};

export const publishNpmPackage = (name, uniqueVersion) => {
  const { npmToken, isDryRun } = getInputs();

  startGroup(`\nPublish ${name} package to registry in ${process.cwd()}`);

  // set auth token to allow publishing in CI
  execSync(getNpmAuthCommand(npmToken));

  // update version in package.json (does not get committed)
  execSync(getUpdatePackageVersionCommand(uniqueVersion));

  // publish package
  execSync(getPublishPackageCommand(isDryRun));

  endGroup();
};
