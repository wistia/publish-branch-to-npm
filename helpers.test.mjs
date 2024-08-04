import { assert, expect, test, describe, afterEach } from 'vitest'; // eslint-disable-line import/no-extraneous-dependencies
import {
  coerceToBoolean,
  generateInstallationInstructionsMarkdown,
  getCommentId,
  getGithubClient,
  getNpmAuthCommand,
  getPackageNameAndVersion,
  getPublishPackageCommand,
  getTrimmedPackageVersion,
  getUniqueVersion,
  getUpdatePackageVersionCommand,
  getWorkingDirectory,
  loadPackageJson,
} from './helpers.mjs';

test('coerceToBoolean()', () => {
  assert.strictEqual(coerceToBoolean('true'), true);
  assert.strictEqual(coerceToBoolean('false'), false);
  assert.strictEqual(coerceToBoolean(true), true);
  assert.strictEqual(coerceToBoolean(false), false);
  assert.strictEqual(coerceToBoolean(null), false);
  assert.strictEqual(coerceToBoolean(undefined), false);
  assert.strictEqual(coerceToBoolean('string'), true);
  assert.strictEqual(coerceToBoolean(NaN), false);
});

test('getTrimmedPackageVersion()', () => {
  const fakePackageVersion1 = '1.1.1';
  const fakePackageVersion2 = '1.401.9-prerelease+build';
  const fakePackageVersion3 = '2.10.3-beta.12345678.0000000';

  assert.strictEqual(getTrimmedPackageVersion(fakePackageVersion1), '1.1.1');
  assert.strictEqual(getTrimmedPackageVersion(fakePackageVersion2), '1.401.9');
  assert.strictEqual(getTrimmedPackageVersion(fakePackageVersion3), '2.10.3');
});

test('getNpmAuthCommand()', () => {
  assert.strictEqual(
    getNpmAuthCommand('fakeNpmToken'),
    'npm config set //registry.npmjs.org/:_authToken fakeNpmToken',
  );
});

test('getUpdatePackageVersionCommand()', () => {
  const fakePackageVersion = '2.10.3-beta.12345678.0000000';

  assert.strictEqual(
    getUpdatePackageVersionCommand(fakePackageVersion),
    'npm version --git-tag-version false 2.10.3-beta.12345678.0000000',
  );
});

test('getPackageNameAndVersion()', () => {
  const fakeName = '@namespace/package-name';
  const fakePackageVersion = '2.10.3-beta.12345678.0000000';

  assert.strictEqual(
    getPackageNameAndVersion(fakeName, fakePackageVersion),
    '@namespace/package-name@2.10.3-beta.12345678.0000000',
  );
});

test('getPublishPackageCommand()', () => {
  assert.strictEqual(getPublishPackageCommand(), 'npm publish --verbose --tag beta');
  assert.strictEqual(getPublishPackageCommand(true), 'npm publish --verbose --tag beta --dry-run');
});

test('generateInstallationInstructionsMarkdown()', () => {
  const fakePackageName = '@namespace/package-name';
  const fakePackageNameAndVersion = '@namespace/package-name@2.10.3-beta.12345678.0000000';
  const fakeIdentifier = '<!-- TEST COMMENT -->';
  const comment = generateInstallationInstructionsMarkdown(
    fakePackageName,
    fakePackageNameAndVersion,
    fakeIdentifier,
  );

  assert.strictEqual(comment.startsWith(fakeIdentifier), true);
  expect(comment).toMatch(/yarn add @namespace\/package-name@2\.10\.3-beta\.12345678\.0000000/);
  expect(comment).toMatch(/npm install @namespace\/package-name@2\.10\.3-beta\.12345678\.0000000/);
});

test('getCommentId()', () => {
  const fakeIdentifier = '<!-- TEST COMMENT -->';
  const fakeCommentListWithoutPreviousComment = [
    {
      id: 1,
      body: 'A PR comment',
    },
    {
      id: 2,
      body: 'Another PR comment',
    },
  ];
  const fakeCommentListWithPreviousComment = [
    {
      id: 1,
      body: 'A PR comment',
    },
    {
      id: 2,
      body: '<!-- TEST COMMENT -->\n more comment text',
    },
    {
      id: 3,
      body: 'Another PR comment',
    },
  ];

  assert.strictEqual(getCommentId(fakeCommentListWithoutPreviousComment, fakeIdentifier), null);
  assert.strictEqual(getCommentId(fakeCommentListWithPreviousComment, fakeIdentifier), 2);
});

describe.skip('getWorkingDirectory()', () => {
  afterEach(() => {
    delete process.env.GITHUB_WORKSPACE;
  });

  test('throws an error if GITHUB_WORKSPACE is not set', () => {
    try {
      getWorkingDirectory();
    } catch (error) {
      assert(error instanceof Error);
      assert.strictEqual(error.message, 'GITHUB_WORKSPACE env var missing');
    }
  });
});

describe.skip('loadPackageJson()', () => {
  afterEach(() => {
    delete process.env.GITHUB_WORKSPACE;
  });

  test('executes in the current working directory by default', async () => {
    process.env.GITHUB_WORKSPACE = process.cwd();
    const { name } = loadPackageJson();

    assert.strictEqual(name, 'publish-branch-to-npm');
  });
});

test('getGithubClient()', () => {
  try {
    getGithubClient();
  } catch (error) {
    assert(error instanceof Error);
    assert.strictEqual(error.message, 'Parameter token or opts.auth is required');
  }
});

// run into `Input required and not supplied: github_token` error
test('getUniqueVersion()', () => {
  const fakeCurrentVersion = '1.1.1';
  const fakecommitHash = 'df20d95efe1569bb854f994217f8712cd3a29aa6';

  expect(getUniqueVersion(fakeCurrentVersion, fakecommitHash)).toMatch(/1\.1\.1-beta\..*\.df20d95/);
});
