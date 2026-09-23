# Code signing policy

What is signed, by whom, and what a person downloading this program can check for themselves.

## Today: the installer is not signed

Windows SmartScreen warns about every download of this app, and that warning is honest: the
installer carries no Authenticode signature. A certificate costs money this project does not take
in, and the free programme for open source turned this project down once, in August 2026, for not
being well enough known yet.

What is signed today, and how to check it, is below. This page is also what this project will keep
current on the day a certificate arrives, because the programme that grants it asks for exactly
this page.

## What is signed

**Every published file, by the build itself.** Each release carries `SHA256SUMS`, the SHA-256 of
every file on it, and a Sigstore provenance attestation over that list, made by the release
workflow at the tagged commit. There is no private key on anybody's machine: Sigstore issues a
short-lived certificate to the workflow and records the signature in a public transparency log.

```
gh attestation verify Dota-2-Mod-Manager-Setup.exe --repo dota2modmanager/dota2-mod-manager
```

**The catalog the app reads**, by its author. Mod data carries an ed25519 signature made by the
catalog's own author, against a public key pinned inside the app. An archive is checked against a
SHA-256 from that signed list before it reaches a game folder.

**The file that can change the app after a release**, by this project. `config/app.json` switches
a feature off, shows a notice, names the beta testers and can add a download mirror. It is signed
with an ed25519 key held by the maintainer and pinned in the app; a copy that does not verify is
ignored exactly as if it were unreachable.

## Who can sign, and how

The maintainer, [@TheFleece](https://github.com/TheFleece), holds the key for `config/app.json`
and the accounts that publish releases. Two-factor authentication is on for GitHub and for every
service that can publish anything.

Releases are built only by CI, from a tag on `main`, and never from a developer machine. A change
reaches `main` only through a pull request that passed the checks listed in
[`.github/required-checks.json`](../.github/required-checks.json), and the branch rule applies to
the maintainer too. [GOVERNANCE.md](../GOVERNANCE.md) says who may merge, and
[RELEASING.md](../RELEASING.md) is the whole release procedure.

## What the program does to a machine

It writes in two places: its own data folder, and the Dota 2 folder, where it adds mod archives to
the language folder the game mounts, can write loose fonts and cursors, and can patch one text
file. Anything it replaces is copied first and restored byte for byte on removal. It asks before
it touches the game folder the first time, and the uninstaller asks what should go with it.

It contacts the catalog, the update feed and nothing else. Every address is listed in
[PRIVACY.md](../PRIVACY.md). There is no telemetry, no account requirement and no bundled
software. [SECURITY.md](../SECURITY.md) says what the program promises and what it refuses to
promise; [docs/assurance-case.md](assurance-case.md) is the argument behind those promises.

## Third-party components

The app ships two runtime dependencies from npm and three typefaces, all listed in
[NOTICE](../NOTICE) with their licences, and a CycloneDX SBOM of what each release contains is
published beside the installer. One external tool, Source2Viewer-CLI (MIT), is downloaded only
when a feature needs it, pinned by version and SHA-256, and never bundled.

## When this changes

If a certificate is granted, this page will name the issuer and the programme that granted it,
and the credit those programmes ask for will appear here and on the project's front page. Until
then the honest summary is the first line of this file.
