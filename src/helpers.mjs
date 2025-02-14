import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { endGroup, getInput, notice, startGroup, debug } from '@actions/core';
import { getOctokit, context } from '@actions/github';

// wrapper for `debug` method; used to hide debug logs during tests
const log = (args) => {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }
  return debug(args);
};

// converts a boolean string value `value` into a boolean.
// if passed something other than 'true' or 'false' will coerce value to boolean.
export const coerceToBoolean = (value) => {
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  return Boolean(value);
};

// retrieves inputs that are defined in action.yml
// errors are automatically thrown if required inputs are not present
// TODO: `getBooleanInput` is available in @actions/core and could be useful here
export const getInputs = () => {
  const workspaceInput = getInput('workspace', { required: false });
  const workspace = workspaceInput === '' ? undefined : workspaceInput;

  return {
    githubToken: getInput('github_token', { required: true }),
    npmToken: getInput('npm_token', { required: true }),
    commitHash: getInput('commit_hash', { required: true }),
    workspace,
    isDryRun: getInput('dry_run', { required: false }) === 'true',
    workingDirectory: getInput('working_directory', { required: false }) || '.',
  };
};

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
export const getNpmAuthCommand = (npmToken, workspace) => {
  const flags = coerceToBoolean(workspace) ? '--workspaces=false --include-workspace-root' : '';
  log(`npm config set ${flags} //registry.npmjs.org/:_authToken ${npmToken}`);
  return `npm config set ${flags} //registry.npmjs.org/:_authToken ${npmToken}`;
};

// updates version in package.json
export const getUpdatePackageVersionCommand = (uniqueVersion, workspace) => {
  const flags = coerceToBoolean(workspace) ? `--workspace=${workspace}` : '';
  log(`npm version ${flags} --git-tag-version false ${uniqueVersion}`);
  return `npm version ${flags} --git-tag-version false ${uniqueVersion}`;
};

// creates an npm publish command with flags
export const getPublishPackageCommand = (isDryRun, workspace) => {
  // publish with "beta" tag since if we do not specify a tag, "latest" will be used by default
  let flags = '--tag beta';

  if (coerceToBoolean(workspace)) {
    flags = `${flags} --workspace=${workspace}`;
  }

  if (coerceToBoolean(isDryRun)) {
    flags = `${flags} --dry-run`;
  }

  log(`npm publish --verbose ${flags}`);

  return `npm publish --verbose ${flags}`;
};

// returns a fully qualified package and version for installation instructions
export const getPackageNameAndVersion = (name, uniqueVersion) => `${name}@${uniqueVersion}`;

// returns the package name & version
export const getPackageMetadata = () => {
  const { workspace } = getInputs();

  // run all subsequent commands in the working directory
  process.chdir(getWorkingDirectory());

  const isWorkspace = coerceToBoolean(workspace);
  const flags = coerceToBoolean(workspace) ? ` --workspace=${workspace}` : '';

  // run npm cli commands to get the package name and version
  // - for a standard package, the output looks like `"1.6.0"` (including quotes)
  // - for a workspace package, the output looks like json
  const npmPkgVersion = execSync(`npm pkg get version${flags}`, { encoding: 'utf8' }).trim();
  const npmPkgName = execSync(`npm pkg get name${flags}`, { encoding: 'utf8' }).trim();

  let version;
  let name;

  if (isWorkspace) {
    const parsedVersion = JSON.parse(npmPkgVersion);
    const parsedName = JSON.parse(npmPkgName);

    [version] = Object.values(parsedVersion);
    [name] = Object.values(parsedName);
  } else {
    version = npmPkgVersion.replace(/^"|"$/g, '');
    name = npmPkgName.replace(/^"|"$/g, '');
  }

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
  // TODO: use Intl.DateTimeFormat to format date and time for different locales
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

  #### pnpm:

  \`\`\`shell
  pnpm add ${packageNameAndVersion}
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

  * pnpm add ${packageNameAndVersion}
`;

// posts a comment to the PR if none have been posted yet, but any new posts
// (for example, when a new commit is pushed to the PR) will update original comment
// so that there is only ever a single comment being made by this action
export const postCommentToPullRequest = async (packageName, packageNameAndVersion) => {
  if (!context.issue.number) {
    throw new Error('This is not a PR or commenting is disabled');
  }

  // string used to identify a comment in a PR made by this action
  // TODO: in a workspace setting it could be nice to combine the packages into a single comment
  const commentIdentifier = `<!-- NPM_PUBLISH_BRANCH_COMMENT_PR_${packageName.toUpperCase()} -->`;
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

export const publishNpmPackage = async () => {
  const { npmToken, isDryRun, workspace } = getInputs();

  // run all subsequent commands in the working directory
  process.chdir(getWorkingDirectory());

  // get a unique version for the package for publishing
  const { name, currentVersion } = getPackageMetadata();
  const uniqueVersion = getUniqueVersion(currentVersion);

  startGroup(`\nPublish ${name} package to registry in ${process.cwd()}`);

  // set auth token to allow publishing in CI
  execSync(getNpmAuthCommand(npmToken, workspace));

  // update version in package.json (does not get committed)
  try {
    execSync(getUpdatePackageVersionCommand(uniqueVersion, workspace));
  } catch (error) {
    // there's an issue with npm and any package.json entries that contain `workspace:*` fields
    // this works fine with yarn/pnpm but npm does not support it
    // thankfully the version will still be updated despite this error so we can ignore it
    //
    // `npm error code EUNSUPPORTEDPROTOCOL`
    // `npm error Unsupported URL Type "workspace:": workspace:*`
    if (error?.message?.includes('EUNSUPPORTEDPROTOCOL')) {
      log(
        'Warning: Encountered EUNSUPPORTEDPROTOCOL error from npm version command. Ignoring and continuing...',
      );
    } else {
      // rethrow for any other errors
      throw error;
    }
  }

  // publish package
  execSync(getPublishPackageCommand(isDryRun, workspace));

  // display installation instructions
  await displayInstallationInstructions(name, uniqueVersion);

  endGroup();
};
