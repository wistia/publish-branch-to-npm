# publish-branch-to-npm

GitHub action to publish a pre-release version of an npm package to the registry when a pull request is made.

## Usage

```
- name: Publish branch package to npm
  uses: wistia/publish-branch-to-npm@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    npm_token: ${{ secrets.NPM_AUTH_TOKEN }}
```

`github_token` and `npm_token` are required inputs and this action cannot work without them. `dry_run` is optional and defaults to `false`.

## Inputs

### github_token

A token that GitHub automatically creates and stores in a `GITHUB_TOKEN` secret to use in your workflow.

### npm_token

An npm access token. See [https://docs.npmjs.com/creating-and-viewing-access-tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens)

### dry_run

As of `npm@6`, does everything publish would do except actually publishing to the registry. Reports the details of what would have been published, see [npm publish docs](https://docs.npmjs.com/cli/v7/commands/npm-publish).
