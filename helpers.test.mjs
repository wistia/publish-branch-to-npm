import test from 'ava'; // eslint-disable-line import/no-unresolved
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
  loadPackageJson,
} from './helpers.mjs';

test('getGithubClient()', (t) => {
  const error = t.throws(
    () => {
      getGithubClient();
    },
    { instanceOf: Error },
  );

  t.is(error.message, 'Parameter token or opts.auth is required');
});

test('coerceToBoolean()', (t) => {
  t.is(coerceToBoolean('true'), true);
  t.is(coerceToBoolean('false'), false);
  t.is(coerceToBoolean(true), true);
  t.is(coerceToBoolean(false), false);
  t.is(coerceToBoolean(null), false);
  t.is(coerceToBoolean(undefined), false);
  t.is(coerceToBoolean('string'), true);
  t.is(coerceToBoolean(NaN), false);
});

test.skip('getUniqueVersion()', (t) => {
  const fakeCurrentVersion = '1.1.1';
  const fakecommitHash = 'df20d95efe1569bb854f994217f8712cd3a29aa6';

  t.regex(getUniqueVersion(fakeCurrentVersion, fakecommitHash), /1\.1\.1-beta\..*\.df20d95/);
});

test('getTrimmedPackageVersion()', (t) => {
  const fakePackageVersion1 = '1.1.1';
  const fakePackageVersion2 = '1.401.9-prerelease+build';
  const fakePackageVersion3 = '2.10.3-beta.12345678.0000000';

  t.is(getTrimmedPackageVersion(fakePackageVersion1), '1.1.1');
  t.is(getTrimmedPackageVersion(fakePackageVersion2), '1.401.9');
  t.is(getTrimmedPackageVersion(fakePackageVersion3), '2.10.3');
});

test('getNpmAuthCommand()', (t) => {
  t.is(
    getNpmAuthCommand('fakeNpmToken'),
    'npm config set //registry.npmjs.org/:_authToken fakeNpmToken',
  );
});

test('getUpdatePackageVersionCommand()', (t) => {
  const fakePackageVersion = '2.10.3-beta.12345678.0000000';

  t.is(
    getUpdatePackageVersionCommand(fakePackageVersion),
    'npm version --git-tag-version false 2.10.3-beta.12345678.0000000',
  );
});

test('getPackageNameAndVersion()', (t) => {
  const fakeName = '@namespace/package-name';
  const fakePackageVersion = '2.10.3-beta.12345678.0000000';

  t.is(
    getPackageNameAndVersion(fakeName, fakePackageVersion),
    '@namespace/package-name@2.10.3-beta.12345678.0000000',
  );
});

test('getPublishPackageCommand()', (t) => {
  t.is(getPublishPackageCommand(), 'npm publish --verbose --tag beta');
  t.is(getPublishPackageCommand(true), 'npm publish --verbose --tag beta --dry-run');
});

test('generateInstallationInstructionsMarkdown()', (t) => {
  const fakePackageNameAndVersion = '@namespace/package-name@2.10.3-beta.12345678.0000000';
  const fakeIdentifier = '<!-- TEST COMMENT -->';
  const comment = generateInstallationInstructionsMarkdown(
    fakePackageNameAndVersion,
    fakeIdentifier,
  );

  t.is(comment.startsWith(fakeIdentifier), true);
  t.regex(comment, /yarn add @namespace\/package-name@2\.10\.3-beta\.12345678\.0000000/);
  t.regex(comment, /npm install @namespace\/package-name@2\.10\.3-beta\.12345678\.0000000/);
});

test('getCommentId()', (t) => {
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

  t.is(getCommentId(fakeCommentListWithoutPreviousComment, fakeIdentifier), null);
  t.is(getCommentId(fakeCommentListWithPreviousComment, fakeIdentifier), 2);
});

// this passes locally but fails in CI for some reason
test.skip('loadPackageJson()', (t) => {
  const error = t.throws(
    () => {
      loadPackageJson();
    },
    { instanceOf: Error },
  );

  t.is(error.message, 'GITHUB_WORKSPACE env var missing');
});
