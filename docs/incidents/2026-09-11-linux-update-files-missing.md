# The update mirror carried nothing for Linux

| Field | Value |
| --- | --- |
| Date | 2026-09-11 |
| Versions | 2.6.5 to 2.6.8 |
| Fixed in | release.yml on 2026-09-11, first used by 2.6.9 |
| Impact | Linux players who cannot reach GitHub got no updates. The second update source from 2.6.5 existed for Windows only. |

## What happened

2.6.5 added our own mirror as a second source for app updates (issue #9). The step that copies a
release onto it was the last step of the Windows job in `release.yml`. The Linux job waits for the
Windows job, so it had not started yet. Every run copied `latest.yml`, `portable.yml` and the two
`.exe` files, then failed to find `Dota-2-Mod-Manager.AppImage` and `latest-linux.yml`, which did
not exist for a few more minutes.

## Why

The copy ran before one of the two builds it copies had finished.

## Why nothing caught it

- The step had `continue-on-error`, so both missing files printed a line and the release stayed
  green.
- Nothing read the mirror back after writing to it. Four releases went out this way.

## What catches it now

- `.github/workflows/release.yml` "Publish the release to the update mirror": a job of its own that
  runs after both builds.
- `.github/workflows/release.yml` "Check the mirror carries both platforms": asks the mirror over
  HTTP for all six files and fails the job if any is missing.
- `test/workflows.test.js` "RELEASING.md names every job release.yml runs"
