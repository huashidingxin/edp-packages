#!/usr/bin/env node

/**
 * Check the package workspace before publishing.
 *
 * This intentionally does not contact a registry. It catches repository
 * mistakes (private leaf packages, local path dependencies, missing versions)
 * while leaving authentication and registry selection to the caller/CI.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const packageRoots = ['website', 'miniprogram', 'shared', 'tooling']
const dependencyFields = ['dependencies', 'optionalDependencies', 'peerDependencies']

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function packageFiles() {
  const files = []
  for (const group of packageRoots) {
    const groupDir = join(root, group)
    let entries
    try {
      entries = readdirSync(groupDir)
    } catch {
      continue
    }
    for (const entry of entries) {
      const packageFile = join(groupDir, entry, 'package.json')
      try {
        if (statSync(packageFile).isFile()) files.push(packageFile)
      } catch {
        // Ignore future folders that are not packages yet.
      }
    }
  }
  return files.sort()
}

const failures = []
const files = packageFiles()
if (files.length === 0) failures.push('No publishable package directories were found.')

for (const file of files) {
  const pkg = readJson(file)
  const label = pkg.name || file
  if (pkg.private === true) continue
  if (typeof pkg.name !== 'string' || !pkg.name.startsWith('@edp/')) {
    failures.push(`${label}: package name must use the @edp/ scope.`)
  }
  if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
    failures.push(`${label}: version must be a concrete semver (got ${String(pkg.version)}).`)
  }
  for (const field of dependencyFields) {
    for (const [dependency, range] of Object.entries(pkg[field] || {})) {
      if (typeof range !== 'string') continue
      if (/^(?:link:|file:)/.test(range)) {
        failures.push(`${label}: ${field}.${dependency} uses a local path (${range}).`)
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Publish check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Publish check passed (${files.length} workspace package(s) inspected).`)
  console.log('Registry and credentials are intentionally not checked here; configure them in .npmrc/CI.')
}
