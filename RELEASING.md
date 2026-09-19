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
| `checksums` | Downloads every file on the draft, writes `SHA256SUMS` and an SBOM, attests the build provenance of every file and the SBOM through Sigstore, and puts `SHA256SUMS`, the SBOM and the provenance bundle on the draft | the maintainer |
| `try-windows` | Downloads the installer from the draft, checks it against `SHA256SUMS`, installs it, and runs `tools/e2e.mjs` against the installed app | the maintainer |
| `try-linux` | Downloads the AppImage from the draft, checks it against `SHA256SUMS`, unpacks it, and runs `tools/e2e.mjs` against it | the maintainer |
| `publish` | Takes the release out of draft, then checks it is the latest and carries every file the updater reads | everybody |
| `beta-feed` | Uploads the release's own `latest.yml` and `latest-linux.yml` a second time as `beta.yml` and `beta-linux.yml`, so the beta channel points at this release too | everybody |
| `mirror-update` | Copies the release to the update mirror | everybody |
| `notify` | Posts the changelog section to Discord | everybody |

Installed copies look for updates at `/releases/latest`, and a draft never shows up there. So nobody
receives a version before both builds of it installed a mod and removed it, and after `publish`
everybody receives it together.

## Betas

A beta is a tag with a prerelease part: `v2.7.0-beta.1`. It goes through the same `gate`, the same
builds and the same `try-windows` and `try-linux` install runs, because a build nobody has
installed is not worth handing to a tester either. After that it parts company with a release:

- it stays a **prerelease** and never becomes `/releases/latest`, which is the endpoint every copy
  on the stable channel follows;
- it carries `beta.yml` and `beta-linux.yml` instead of the `latest` pair, and that is what the
  app reads for somebody on the beta channel;
- `mirror-update` is skipped. The mirror keeps one version under file names that do not carry it,
  so a beta copied there would sit where the stable installer sits while `latest.yml` still
  described the stable one, and every copy that cannot reach GitHub would fail its checksum;
- `notify` is skipped: the people it is for were picked by name, and the app offers it to them.

Who is offered a beta is a list of Discord accounts in the signed `config/app.json`, as hashes.
`src/beta.js` reads it; `npm run rollback` is what writes and signs that file. A tester taken off
the list, or signed out of Discord, is back on the stable channel at the next check without anybody
touching their machine.

When a release goes out, `beta-feed` points the beta channel at it, so a tester who tried a beta
moves on to the released version rather than sitting on the build it replaced.

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

**Stop the broken version doing damage, and tell its users why.** Every running copy fetches
`config/app.json`, signed with a key that is not in this repository. `tools/rollback.mjs` writes that
file, signs it and refuses the mistakes that matter under pressure:

```bash
npm run rollback -- list
CATALOG_KEY=/path/to/config-key.pem npm run rollback -- block install --versions 2.7.0 --until 2026-09-27 --en "Installing is paused in 2.7.0. Update to 2.7.1." --ru "В 2.7.0 установка на паузе. Обнови до 2.7.1."
```

A **block** switches `install`, `cosmetics` or `voice` off for a range of versions (`2.7.0`, or
`2.7.0-2.7.2`) until a day, and adds a notice for exactly those versions. The release with the fix is
not touched, and the block lets go by itself the day after `--until`. Copies before 2.6.13 do not
read blocks at all, which is what made adding them safe, and the tool refuses a range that reaches
them rather than write a block that does nothing there.

For those older copies, or when the cause is outside the app (a Dota patch), switch the feature off
in **every** version, and restore it once that is safe:

```bash
CATALOG_KEY=/path/to/config-key.pem npm run rollback -- everywhere install --en "…" --ru "…"
CATALOG_KEY=/path/to/config-key.pem npm run rollback -- restore install
```

`lift <id>` takes a block out early, `prune` takes out everything past its day, and `sign` signs the
file as it stands. A key that is not the one the app pins is refused before anything is written,
because every copy would ignore what it signed. Without `CATALOG_KEY` the tool writes the file and
says it is unsigned; `test/remote-config-signature.test.js` then fails the pull request, so an
unsigned file cannot go out.

`config/app.json` and `config/app.json.sig` go in one pull request, merged through the checks. A
notice hides itself after its day, but copies released before that field existed ignore it, so run
`prune` once the date has passed.

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
