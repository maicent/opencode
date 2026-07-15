#!/usr/bin/env bun
// Ensures Windows native optionalDependencies are present for cross-packaging.
// bun installs only the host platform's optional deps, and electron-builder's bun
// collector packages whatever is physically in node_modules, so a win32 build
// from linux/mac needs the win32 native packages fetched and linked by hand.
// Idempotent: skips packages that already resolve. Safe to re-run.

import { $ } from "bun"
import { existsSync } from "node:fs"
import path from "node:path"

const pkgDir = path.resolve(import.meta.dir, "..")
const rootDir = path.resolve(pkgDir, "../..")
const storeDir = path.join(rootDir, "node_modules", ".bun")
const deskModules = path.join(pkgDir, "node_modules")
const registry = "https://registry.npmjs.org"

const plat = Bun.env.OPENCODE_TARGET_PLATFORM ?? process.platform
const arch = Bun.env.OPENCODE_TARGET_ARCH ?? process.arch
const suffix = `-${plat}-${arch}`

if (plat === process.platform && arch === process.arch) {
  console.log(`prepare-win-natives: host is ${plat}-${arch}, nothing to do`)
  process.exit(0)
}

const pkg = await Bun.file(path.join(pkgDir, "package.json")).json()
const optional = (pkg.optionalDependencies ?? {}) as Record<string, string>

const wanted = new Map<string, string>()
for (const [name, version] of Object.entries(optional)) {
  if (name.endsWith(suffix)) wanted.set(name, version)
}

// msgpackr-extract is a transitive optional with a pure-JS fallback; include it
// best-effort so electron-builder packages the native instead of warning.
const msgpackr = await Array.fromAsync(
  new Bun.Glob(`@msgpackr-extract+msgpackr-extract-*@*`).scan({ cwd: storeDir, onlyFiles: false }),
).catch(() => [] as string[])
const msgpackrVersion = msgpackr.map((d) => d.slice(d.lastIndexOf("@") + 1)).sort().at(-1)
if (msgpackrVersion) wanted.set(`@msgpackr-extract/msgpackr-extract${suffix}`, msgpackrVersion)

async function place(name: string, version: string) {
  const link = path.join(deskModules, name)
  if (existsSync(link)) return console.log(`skip ${name} (present)`)
  const [scope, base] = name.split("/")
  const storeName = `${scope}+${base}@${version}`
  const dest = path.join(storeDir, storeName, "node_modules", scope, base)
  const url = `${registry}/${name}/-/${base}-${version}.tgz`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`)
  const tgz = path.join(Bun.env.TMPDIR ?? "/tmp", `${base}-${version}.tgz`)
  await Bun.write(tgz, res)
  await $`mkdir -p ${path.dirname(dest)}`
  await $`tar -xzf ${tgz} -C ${path.dirname(dest)}`
  await $`mv ${path.join(path.dirname(dest), "package")} ${dest}`
  await $`rm -f ${tgz}`
  await $`mkdir -p ${path.dirname(link)}`
  await $`ln -sfn ${path.relative(path.dirname(link), dest)} ${link}`
  console.log(`placed ${name}@${version}`)
}

for (const [name, version] of wanted) {
  try {
    await place(name, version)
  } catch (err) {
    if (name.startsWith("@msgpackr-extract/")) console.warn(`warn: ${name} skipped (${err})`)
    else throw err
  }
}

console.log(`prepare-win-natives: ready for ${plat}-${arch}`)
