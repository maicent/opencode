#!/usr/bin/env bun
// Ensures a wine binary is available for electron-builder's Windows NSIS step.
// On Linux/macOS electron-builder runs rcedit under wine to stamp the installer
// icon/version; without wine the NSIS step fails with `spawn wine ENOENT`.
// Uses a pinned portable Kron4ek Wine-Builds tarball so no sudo/apt is needed.
// Idempotent: skips when wine is already on PATH or already downloaded.
// No-op on Windows hosts (electron-builder runs rcedit natively there).

import { $ } from "bun"
import { existsSync } from "node:fs"
import path from "node:path"

if (process.platform === "win32") {
  console.log("prepare-wine: windows host, wine not needed")
  process.exit(0)
}

// bump this to move to a newer portable wine build
const wineVersion = "11.13"
const asset = `wine-${wineVersion}-amd64-wow64.tar.xz`
const url = `https://github.com/Kron4ek/Wine-Builds/releases/download/${wineVersion}/${asset}`

const pkgDir = path.resolve(import.meta.dir, "..")
const cacheDir = path.join(pkgDir, ".cache")
const wineDir = path.join(cacheDir, "wine")
const wineBin = path.join(wineDir, "bin", "wine")

const systemWine = await $`which wine`.text().catch(() => "")
if (systemWine.trim()) {
  console.log(`prepare-wine: using system wine (${systemWine.trim()})`)
  process.exit(0)
}

if (!existsSync(wineBin)) {
  console.log(`prepare-wine: fetching ${asset}`)
  await $`mkdir -p ${cacheDir}`
  const tgz = path.join(cacheDir, asset)
  // curl over fetch: follows the release-asset redirect and resumes partials
  await $`curl -fL --retry 3 --retry-delay 2 -C - -o ${tgz} ${url}`
  // the tarball extracts to wine-<ver>-amd64-wow64/; normalize to .cache/wine
  await $`tar -xf ${tgz} -C ${cacheDir}`
  await $`rm -rf ${wineDir}`
  await $`mv ${path.join(cacheDir, `wine-${wineVersion}-amd64-wow64`)} ${wineDir}`
  await $`rm -f ${tgz}`
}

const check = await $`${wineBin} --version`.text()
console.log(`prepare-wine: wine ready (${check.trim()}) at ${path.join(wineDir, "bin")}`)
