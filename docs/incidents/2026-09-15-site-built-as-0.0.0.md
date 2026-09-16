# The site built as version 0.0.0 (near miss)

| Field | Value |
| --- | --- |
| Date | 2026-09-15 |
| Versions | the site, on Dependabot's Astro 7 update (pull request #12) |
| Fixed in | commit 53416db, before #12 was merged |
| Impact | None: found before deploy. The build would have published version 0.0.0 on the fact sheet, in llms.txt and in the structured data, and given 32 pages the front page's link-preview card. |

## What happened

The site read two things from the disk around it: the app version from the repository's
`package.json`, and whether a page has its own card under `public/og/`. Both paths were worked out
from `import.meta.url`, which names the build chunk that runs, not the source file. Astro 5 kept
its chunks at a depth where three folders up reached the repository. Astro 7 moved them, and three
folders up became `site/package.json`, which says 0.0.0. Every page still built.

A build of the pull request compared against main before merging showed the difference: a handful
of strings across 361 files.

## Why

A path computed from where the running file sits changes when a bundler moves the file.

## Why nothing caught it

- Nothing built the site before a merge. The pull request passed every check in the repository.
- A build that succeeds with wrong strings in it raises no error.

## What catches it now

- `site/src/lib/paths.ts`: finds the site and the repository from the folder holding
  `astro.config.mjs`, which gives the same answer on Astro 5 and 7.
- `site/tools/check-build.mjs` "site/package.json says 0.0.0": reads the finished build and fails
  on a wrong version or a page without its own card.
- `.github/workflows/site.yml` "Check what the build read": runs that check on every pull request
  that touches the site, and deploys nothing there.
