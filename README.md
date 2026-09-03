# EDP shared packages

This directory is the single Git repository for reusable EDP packages.
Applications remain separate repositories and consume published package
versions; they must not depend on `../../packages` paths.

## Current packages

- `website/ui` → `@edp/website-ui`: Vue components, API client, contracts,
  theme/navigation helpers, and website UI logic.
- `website/runtime` → `@edp/website-runtime`: Nuxt module, layouts,
  composables, and standard website pages. It depends on `@edp/website-ui`.

Future platform packages belong in `miniprogram/`, `shared/`, or `tooling/`
when there is a real second consumer. Keep application-specific code in the
application repository.

## Workspace commands

```bash
pnpm install
pnpm run check
pnpm exec changeset
pnpm run version
pnpm run release
```

The workspace uses `workspace:^` only for dependencies between packages in
this repository. Published manifests are rewritten to normal semver ranges.
An application repository uses released versions, for example:

```json
{
  "dependencies": {
    "@edp/website-runtime": "0.1.0",
    "@edp/website-ui": "0.1.0"
  }
}
```

Before the first release, configure the organization's npm registry in a
local `.npmrc` (see `.npmrc.example`) and use a read-only token in application
CI.

## Application integration

An application repository is intentionally not a member of this workspace.
After `@edp/website-ui` and `@edp/website-runtime` have been published, add
the released versions to the application itself:

```bash
pnpm add @edp/website-runtime@0.1.0 @edp/website-ui@0.1.0
```

The resulting manifest should contain normal semver versions, not `link:` or
relative `file:` paths:

```json
{
  "dependencies": {
    "@edp/website-runtime": "0.1.0",
    "@edp/website-ui": "0.1.0"
  }
}
```

Each application keeps its own lockfile and `.npmrc` (or CI-provided npm
configuration). A clean clone must build without the sibling `packages/`
directory. During local package development, use a packed tarball or a local
link only in an uncommitted override; do not commit that override to the
application repository.

The package Git repository alone is not a substitute for a registry when one
published package depends on another package in this workspace. Git-based
subdirectory dependencies can be used temporarily, but they pin source
commits and make transitive dependencies and CI credentials harder to manage.
