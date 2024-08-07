import { expect, it, describe, afterEach } from 'vitest'; // eslint-disable-line import/no-extraneous-dependencies
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

describe('helpers', () => {
  const fakeAuthToken = 'fakeNpmToken';
  const fakePackageName = '@namespace/package-name';
  const fakePackageVersion = '2.10.3-beta.12345678.0000000';
  const fakePackageNameAndVersion = `${fakePackageName}@${fakePackageVersion}`;
  const fakePackageWorkspace = fakePackageName;

  describe('coerceToBoolean()', () => {
    it('should return a boolean value', () => {
      expect(coerceToBoolean('true')).toBe(true);
      expect(coerceToBoolean('false')).toBe(false);
      expect(coerceToBoolean(true)).toBe(true);
      expect(coerceToBoolean(false)).toBe(false);
      expect(coerceToBoolean(null)).toBe(false);
      expect(coerceToBoolean(undefined)).toBe(false);
      expect(coerceToBoolean('string')).toBe(true);
      expect(coerceToBoolean(NaN)).toBe(false);
    });
  });

  describe('getPackageNameAndVersion()', () => {
    it('should return the package name and version', () => {
      expect(getPackageNameAndVersion(fakePackageName, fakePackageVersion)).toBe(
        '@namespace/package-name@2.10.3-beta.12345678.0000000',
      );
    });
  });

  describe('getTrimmedPackageVersion()', () => {
    it('should return just the package version', () => {
      const fakePackageVersion1 = '1.1.1';
      const fakePackageVersion2 = '1.401.9-prerelease+build';
      const fakePackageVersion3 = '10.53.3-beta.74629451.73829563';

      expect(getTrimmedPackageVersion(fakePackageVersion1)).toBe('1.1.1');
      expect(getTrimmedPackageVersion(fakePackageVersion2)).toBe('1.401.9');
      expect(getTrimmedPackageVersion(fakePackageVersion3)).toBe('10.53.3');
    });
  });

  describe('getNpmAuthCommand()', () => {
    it('should return an npm auth command', () => {
      expect(getNpmAuthCommand(fakeAuthToken)).toBe(
        'npm config set  //registry.npmjs.org/:_authToken fakeNpmToken',
      );

      expect(getNpmAuthCommand(fakeAuthToken, fakePackageWorkspace)).toBe(
        'npm config set --workspaces=false --include-workspace-root //registry.npmjs.org/:_authToken fakeNpmToken',
      );
    });
  });

  describe('getUpdatePackageVersionCommand()', () => {
    it('should return an npm version command', () => {
      expect(getUpdatePackageVersionCommand(fakePackageVersion)).toBe(
        'npm version  --git-tag-version false 2.10.3-beta.12345678.0000000',
      );

      expect(getUpdatePackageVersionCommand(fakePackageVersion, fakePackageWorkspace)).toBe(
        'npm version --workspace @namespace/package-name --git-tag-version false 2.10.3-beta.12345678.0000000',
      );
    });
  });

  describe('getPublishPackageCommand()', () => {
    it('should return an npm publish command', () => {
      expect(getPublishPackageCommand()).toBe('npm publish --verbose --tag beta');
      expect(getPublishPackageCommand(true)).toBe('npm publish --verbose --tag beta --dry-run');
      expect(getPublishPackageCommand(false, fakePackageWorkspace)).toBe(
        'npm publish --verbose --tag beta --workspace @namespace/package-name',
      );
      expect(getPublishPackageCommand(true, fakePackageWorkspace)).toBe(
        'npm publish --verbose --tag beta --workspace @namespace/package-name --dry-run',
      );
    });
  });

  describe('generateInstallationInstructionsMarkdown()', () => {
    it('poop', () => {
      const fakeIdentifier = '<!-- TEST COMMENT -->';
      const comment = generateInstallationInstructionsMarkdown(
        fakePackageName,
        fakePackageNameAndVersion,
        fakeIdentifier,
      );

      expect(comment.startsWith(fakeIdentifier)).toBe(true);
      expect(comment).toMatch(/yarn add @namespace\/package-name@2\.10\.3-beta\.12345678\.0000000/);
      expect(comment).toMatch(
        /npm install @namespace\/package-name@2\.10\.3-beta\.12345678\.0000000/,
      );
    });
  });

  describe('getCommentId()', () => {
    it('poop', () => {
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

      expect(getCommentId(fakeCommentListWithoutPreviousComment, fakeIdentifier)).toBeNull();
      expect(getCommentId(fakeCommentListWithPreviousComment, fakeIdentifier)).toBe(2);
    });
  });

  describe('getGithubClient()', () => {
    it('poop', () => {
      try {
        getGithubClient();
      } catch (error) {
        expect(error).toBeInstanceOf(Error); // eslint-disable-line vitest/no-conditional-expect
        expect(error.message).toBe('Parameter token or opts.auth is required'); // eslint-disable-line vitest/no-conditional-expect
      }
    });
  });

  // run into `Input required and not supplied: github_token` error
  describe('getUniqueVersion()', () => {
    it('poop', () => {
      const fakeCurrentVersion = '1.1.1';
      const fakecommitHash = 'df20d95efe1569bb854f994217f8712cd3a29aa6';

      expect(getUniqueVersion(fakeCurrentVersion, fakecommitHash)).toMatch(
        /1\.1\.1-beta\..*\.df20d95/,
      );
    });
  });

  describe.skip('getWorkingDirectory()', () => {
    afterEach(() => {
      delete process.env.GITHUB_WORKSPACE;
    });

    it('throws an error if GITHUB_WORKSPACE is not set', () => {
      try {
        getWorkingDirectory();
      } catch (error) {
        expect(error).toBeInstanceOf(Error); // eslint-disable-line vitest/no-conditional-expect
        expect(error.message).toBe('GITHUB_WORKSPACE env var missing'); // eslint-disable-line vitest/no-conditional-expect
      }
    });
  });

  describe.skip('loadPackageJson()', () => {
    afterEach(() => {
      delete process.env.GITHUB_WORKSPACE;
    });

    it('executes in the current working directory by default', async () => {
      process.env.GITHUB_WORKSPACE = process.cwd();
      const { name } = loadPackageJson();

      expect(name).toBe('publish-branch-to-npm');
    });
  });
});
