// Builds this fork's own @ui-sdk packages: stamps the fork version, runs the
// release steps upstream runs, packs each package and writes its hashes.
// .fork/README.md has the command and how to check a build.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"

const root = path.resolve(import.meta.dirname, "..")
const fork = "https://github.com/aspenas/ui"
const upstream = "https://github.com/vercel-labs/ui"

const { values } = parseArgs({
  options: { build: { type: "string" }, out: { type: "string" } },
})
const buildNumber = Number(values.build)
if (!Number.isInteger(buildNumber) || buildNumber < 1) {
  throw new Error("Pass --build <n>, a whole number from 1.")
}
const out = path.resolve(values.out ?? path.join(root, ".fork/out"))

const read = (command, args) =>
  execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim()
const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, stdio: ["ignore", "inherit", "inherit"] })

if (read("git", ["status", "--porcelain"])) {
  throw new Error("The tree has changes. Commit or remove them first.")
}
const commit = read("git", ["rev-parse", "HEAD"])
const base = read("git", ["merge-base", "HEAD", "origin/main"])
const carried = read("git", ["log", "--format=%H %s", `${base}..HEAD`])
  .split("\n")
  .filter(Boolean)

const packages = readdirSync(path.join(root, "packages")).sort()
const manifestPath = (name) => path.join(root, "packages", name, "package.json")
const manifests = packages.map((name) =>
  JSON.parse(readFileSync(manifestPath(name), "utf8"))
)
const upstreamVersion = manifests[0].version
if (manifests.some((manifest) => manifest.version !== upstreamVersion)) {
  throw new Error("The packages are not all at one version.")
}
const version = `${upstreamVersion}.fork.${buildNumber}`

const sha = (algorithm, file, encoding) =>
  createHash(algorithm).update(readFileSync(file)).digest(encoding)

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
try {
  packages.forEach((name, index) => {
    const manifest = manifests[index]
    manifest.version = version
    manifest.repository.url = `git+${fork}.git`
    manifest.fork = { build: buildNumber, commit, upstream: base }
    writeFileSync(manifestPath(name), `${JSON.stringify(manifest, null, 2)}\n`)
  })
  run("pnpm", ["install", "--frozen-lockfile"])
  run("pnpm", ["build"])
  run("pnpm", ["docs:packages"])
  run("pnpm", ["check:packages"])
  for (const name of packages) {
    run(
      "pnpm",
      ["pack", "--pack-destination", out],
      path.join(root, "packages", name)
    )
  }
} finally {
  run("git", ["checkout", "--", "packages"])
}

const tarballs = readdirSync(out)
  .filter((file) => file.endsWith(".tgz"))
  .sort()
  .map((file) => ({
    file,
    bytes: readFileSync(path.join(out, file)).length,
    sha256: sha("sha256", path.join(out, file), "hex"),
    integrity: `sha512-${sha("sha512", path.join(out, file), "base64")}`,
  }))
writeFileSync(
  path.join(out, "SHA256SUMS"),
  tarballs.map(({ sha256, file }) => `${sha256}  ${file}\n`).join("")
)
writeFileSync(
  path.join(out, "build-info.json"),
  `${JSON.stringify(
    {
      version,
      build: buildNumber,
      source: { repository: fork, commit },
      upstream: {
        repository: upstream,
        commit: base,
        version: upstreamVersion,
      },
      carried,
      node: process.version,
      pnpm: read("pnpm", ["--version"]),
      tarballs,
    },
    null,
    2
  )}\n`
)
