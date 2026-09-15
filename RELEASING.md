# Releasing

How a version goes out, what stops it on the way, and what to do when one that went out is wrong.

## The path

1. Both changelogs get a section for the new version, `CHANGELOG.md` and `CHANGELOG.ru.md`, covering
   everything since the last tag. `test/release-contract.test.js` fails the pull request if the
   version in `package.json` has no section or an empty one.
2. The version in `package.json` goes up in the same pull request, which merges like any other.
3. The maintainer tags the merged commit `vX.Y.Z` and pushes the tag. Nothing else starts a release.

The tag starts `.github/workflows/release.yml`:

| Job | What it does | Who can see it |
|---|---|---|
| `gate` | Waits until the tagged commit has passed every check in `.github/required-checks.json`, and fails if one failed | nobody |
| `build` | Opens the release as a draft with its changelog section, builds the installer and the portable exe into it, and checks the draft is the only release on the tag | the maintainer |
| `linux` | Builds the AppImage into the same draft | the maintainer |
| `try-windows` | Downloads the installer from the draft, installs it, and runs `tools/e2e.mjs` against the installed app | the maintainer |
| `try-linux` | Downloads the AppImage from the draft, unpacks it, and runs `tools/e2e.mjs` against it | the maintainer |
| `publish` | Takes the release out of draft, then checks it is the latest and carries every file the updater reads | everybody |
| `mirror-update` | Copies the release to the update mirror | everybody |
| `notify` | Posts the changelog section to Discord | everybody |

Installed copies look for updates at `/releases/latest`, and a draft never shows up there. So nobody
receives a version before both builds of it installed a mod and removed it, and after `publish`
everybody receives it together.

## A job before `publish` failed

Nobody outside the repository saw anything. The draft sits on the releases page, visible only to
people with write access.

1. Read why. The two `try-*` jobs upload `e2e-release-windows` and `e2e-release-linux`: a screenshot
   per launch, the window's step report and the app log.
2. Delete the draft:

   ```bash
   gh release delete vX.Y.Z --yes
   ```

3. Delete the tag, here and on GitHub:

   ```bash
   git tag -d vX.Y.Z
   git push origin :refs/tags/vX.Y.Z
   ```

4. Fix it through a pull request and tag the new merge commit with the same version. No copy ever
   received that version, so there is no number to skip.

Do not publish the draft by hand. The jobs that stopped it are the only thing that ran the build
about to go out.

## A published release is broken

Copies that already updated stay on it: the updater never moves anybody to a lower version. You
control how many more copies take it, and what the ones on it are told.

**Ship a fix.** A patch release through the path above is the normal answer, and the only one that
reaches copies already on the broken version.

**Tell people while the fix is coming.** Every running copy fetches `config/app.json`, signed with a
key that is not in this repository. The file can do two things:

- switch off `install`, `cosmetics` or `voice`, with a reason in both languages:

  ```json
  "features": { "install": { "off": true, "en": "Installing is paused until 2.7.1.", "ru": "Установка на паузе до 2.7.1." } }
  ```

- show a notice to one range of versions, with `minVersion` and `maxVersion`, until a last day:

  ```json
  { "id": "2026-09-broken-2.7.0", "date": "2026-09-20", "until": "2026-09-27", "level": "warn",
    "minVersion": "2.7.0", "maxVersion": "2.7.0", "en": "…", "ru": "…" }
  ```

  `until` is required: `test/remote-config.test.js` fails a notice without one.

Sign it and put the file and its signature in one pull request:

```bash
CATALOG_KEY=/path/to/config-key.pem node tools/sign-catalog.js config/app.json
```

`test/remote-config-signature.test.js` fails that pull request when the two disagree. Take the switch
and the notice out again once the fix is out, the same way. A notice hides itself after its `until`
day, but copies released before that field existed ignore it, so it still has to leave the file.

**Stop it spreading, when the build damages game folders.** Mark the release a pre-release.
`/releases/latest` skips pre-releases, so copies that have not updated stop being offered it, and the
files stay on the page for anyone who needs them:

```bash
gh release edit vX.Y.Z --prerelease
gh api repos/TheFleece/dota2-mod-manager/releases/latest --jq .tag_name
```

The second command has to print the previous version. The update mirror holds one version only and
still has the broken one, so run `.github/workflows/r2.yml` by hand with `release` set to the previous
version.
