import crypto from 'crypto';
import { join } from 'path';
import { readFileSync } from 'fs';
import { env } from 'process';
import { getOctokit } from '@actions/github';

// returns an Octokit client that we use to make PR comments
export const getGithubClient = (githubToken) => {
  const client = getOctokit(githubToken);

  if (!client) {
    throw new Error('Client could not be created; ensure sure that GitHub token is correct');
  }

  return client;
};

// string used to identify a comment in a PR made by this action
export const getCommentIdentifier = () => '<!-- NPM_PUBLISH_BRANCH_COMMENT_PR -->';

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

// iterate through comment list to find one that begins with the
// hidden identifier we added in generatePullRequestComment()
export const getCommentId = (commentList, commentIdentifier) => {
  const comment = commentList.find(({ body }) => body.startsWith(commentIdentifier));

  return comment !== undefined ? comment.id : null;
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
