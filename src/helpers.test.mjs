import { expect, it, describe, vi, beforeEach, afterEach } from 'vitest'; // eslint-disable-line import/no-extraneous-dependencies
import { getInput } from '@actions/core';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
  getPackageMetadata,
  getEventType,
} from './helpers.mjs';

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

describe('helpers', () => {
  const fakeGithubToken = 'fakeGithubToken';
  const fakeNpmToken = 'fakeNpmToken';
  const fakecommitHash = 'df20d95efe1569bb854f994217f8712cd3a29aa6';
  const fakePackageName = '@namespace/package-name';
  const fakePackageVersion = '2.10.3-beta.12345678.0000000';
  const fakePackageNameAndVersion = `${fakePackageName}@${fakePackageVersion}`;
  const fakePackageWorkspace = fakePackageName;

  beforeEach(() => {
    process.env.GITHUB_WORKSPACE = '/fake/github/workspace';

    getInput.mockImplementation((name) => {
      const inputs = {
        github_token: fakeGithubToken,
        npm_token: fakeNpmToken,
        commit_hash: fakecommitHash,
        workspace: undefined,
        dry_run: 'true',
        working_directory: undefined,
      };
      return inputs[name];
    });

    readFileSync.mockImplementation(() =>
      JSON.stringify({
        name: 'publish-branch-to-npm',
        version: '1.0.0',
      }),
    );
  });

  afterEach(() => {
    delete process.env.GITHUB_WORKSPACE;

    vi.clearAllMocks();
  });

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
      expect(getNpmAuthCommand(fakeNpmToken)).toBe(
        'npm config set  //registry.npmjs.org/:_authToken fakeNpmToken',
      );

      expect(getNpmAuthCommand(fakeNpmToken, fakePackageWorkspace)).toBe(
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
        'npm version --workspace=@namespace/package-name --git-tag-version false 2.10.3-beta.12345678.0000000',
      );
    });
  });

  describe('getPublishPackageCommand()', () => {
    it('should return an npm publish command', () => {
      expect(getPublishPackageCommand()).toBe('npm publish --verbose --tag beta');
      expect(getPublishPackageCommand(true)).toBe('npm publish --verbose --tag beta --dry-run');
      expect(getPublishPackageCommand(false, fakePackageWorkspace)).toBe(
        'npm publish --verbose --tag beta --workspace=@namespace/package-name',
      );
      expect(getPublishPackageCommand(true, fakePackageWorkspace)).toBe(
        'npm publish --verbose --tag beta --workspace=@namespace/package-name --dry-run',
      );
    });
  });

  describe('generateInstallationInstructionsMarkdown()', () => {
    it('should generate correct markdown instructions', () => {
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
    it('should return the correct comment ID or null', () => {
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
    it('should throw an error if token is missing', () => {
      try {
        delete process.env.GITHUB_WORKSPACE;
        getGithubClient();
      } catch (error) {
        expect(error).toBeInstanceOf(Error); // eslint-disable-line vitest/no-conditional-expect
        expect(error.message).toBe('Parameter token or opts.auth is required'); // eslint-disable-line vitest/no-conditional-expect
      }
    });
  });

  describe('getUniqueVersion()', () => {
    it('should generate a unique version string', () => {
      const fakeCurrentVersion = '1.1.1';

      expect(getUniqueVersion(fakeCurrentVersion, fakecommitHash)).toMatch(
        /1\.1\.1-beta\..*\.df20d95/,
      );
    });
  });

  describe('getWorkingDirectory()', () => {
    it('throws an error if GITHUB_WORKSPACE is not set', () => {
      try {
        getWorkingDirectory();
      } catch (error) {
        expect(error).toBeInstanceOf(Error); // eslint-disable-line vitest/no-conditional-expect
        expect(error.message).toBe('GITHUB_WORKSPACE env var missing'); // eslint-disable-line vitest/no-conditional-expect
      }
    });

    it('should return the correct working directory', () => {
      getInput.mockImplementation((key) => {
        if (key === 'working_directory') return './fakeDir';
        return '';
      });

      const workingDir = getWorkingDirectory();

      expect(workingDir).toBe('/fake/github/workspace/fakeDir');
    });
  });

  describe('getPackageMetadata()', () => {
    beforeEach(() => {
      // don't let process.chdir actually do anything during tests
      vi.spyOn(process, 'chdir').mockImplementation(() => {});
    });

    it('loads name and version for a standard (non-workspace) package', () => {
      // for a standard package, `npm pkg get` returns a quoted string for version and name
      execSync
        .mockReturnValueOnce('"1.6.0"\n') // version
        .mockReturnValueOnce('"@namespace/package-name"\n'); // name

      const { name, currentVersion } = getPackageMetadata();

      expect(execSync).toHaveBeenCalledWith('npm pkg get version', { encoding: 'utf8' });
      expect(execSync).toHaveBeenCalledWith('npm pkg get name', { encoding: 'utf8' });
      expect(name).toBe('@namespace/package-name');
      expect(currentVersion).toBe('1.6.0');
    });

    it('loads name and version for a workspace package', () => {
      // We'll set the input `workspace` to something truthy, e.g. '@namespace/workspace-package-name'
      getInput.mockImplementation((key) => {
        if (key === 'workspace') return '@namespace/workspace-package-name';
        if (key === 'working_directory') return '.';
        // fallback:
        return '';
      });

      // For a workspace, npm pkg get returns a JSON object
      execSync
        .mockReturnValueOnce('{"@namespace/workspace-package-name": "0.4.0"}\n') // version
        .mockReturnValueOnce(
          '{"@namespace/workspace-package-name": "@namespace/workspace-package-name"}\n',
        ); // name

      const { name, currentVersion } = getPackageMetadata();

      // The final commands should have included --workspace=@namespace/workspace-package-name
      expect(execSync).toHaveBeenCalledWith(
        'npm pkg get version --workspace=@namespace/workspace-package-name',
        {
          encoding: 'utf8',
        },
      );
      expect(execSync).toHaveBeenCalledWith(
        'npm pkg get name --workspace=@namespace/workspace-package-name',
        {
          encoding: 'utf8',
        },
      );

      expect(name).toBe('@namespace/workspace-package-name');
      expect(currentVersion).toBe('0.4.0');
    });
  });

  describe('getEventType()', () => {
    afterEach(() => {
      delete process.env.GITHUB_EVENT_NAME;
    });

    it('should return correct event type for pull_request', () => {
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      const eventType = getEventType();

      expect(eventType).toStrictEqual({
        eventName: 'pull_request',
        isPullRequest: true,
        isWorkflowDispatch: false,
      });
    });

    it('should return correct event type for workflow_dispatch', () => {
      process.env.GITHUB_EVENT_NAME = 'workflow_dispatch';
      const eventType = getEventType();

      expect(eventType).toStrictEqual({
        eventName: 'workflow_dispatch',
        isPullRequest: false,
        isWorkflowDispatch: true,
      });
    });

    it('should return correct event type for other events', () => {
      process.env.GITHUB_EVENT_NAME = 'push';
      const eventType = getEventType();

      expect(eventType).toStrictEqual({
        eventName: 'push',
        isPullRequest: false,
        isWorkflowDispatch: false,
      });
    });

    it('should throw an error if GITHUB_EVENT_NAME is not set', () => {
      try {
        getEventType();
      } catch (error) {
        expect(error).toBeInstanceOf(Error); // eslint-disable-line vitest/no-conditional-expect
        expect(error.message).toBe('GITHUB_EVENT_NAME env var missing'); // eslint-disable-line vitest/no-conditional-expect
      }
    });
  });
});
