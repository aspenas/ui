# This fork's build

`main` in this fork mirrors [vercel-labs/ui](https://github.com/vercel-labs/ui) and carries no commit of its own. This branch, `build`, is upstream at a named commit, plus the changes the fork carries, plus this folder.

Every carried change is also offered upstream as its own pull request. When a published upstream release holds them all, this branch is frozen and the fork's users go back to the registry.

## What a build is

```sh
node .fork/build.mjs --build 1
```

The script refuses a tree with uncommitted changes. Then it:

1. Stamps each package with the version `<upstream version>.fork.<n>`, this repository's URL and a `fork` field that names the build, its commit and the upstream commit it started from. Package names stay `@ui-sdk/*`.
2. Runs the release steps upstream runs: `pnpm build`, `pnpm docs:packages` and `pnpm check:packages`.
3. Packs each package into `.fork/out`, with `SHA256SUMS` and `build-info.json`.
4. Puts the stamped files back, so the tree is clean again.

`build-info.json` holds the version, the build's commit, the upstream commit, the commits carried on top of it, the Node and pnpm versions, and each tarball's size, SHA-256 and npm integrity value.

## Checking a build

Builds are reproducible. Check out the commit `build-info.json` names, run the same command with the same build number on the same Node and pnpm, and compare `SHA256SUMS`. Build 1 was rebuilt in a fresh clone and every hash matched.

## Installing a build

Depend on a tarball by its URL and keep the integrity value your lockfile records for it. A tarball whose bytes change no longer installs.
