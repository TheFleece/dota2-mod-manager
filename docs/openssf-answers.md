# OpenSSF Best Practices: the answers

The passing badge is a self-assessment on [bestpractices.dev](https://www.bestpractices.dev). This
file holds an answer for every criterion at that level, with the link the form asks for, so filling
it in is copying rather than remembering. The criteria ids match the anchors in the form.

The same answers live in `.bestpractices.json` at the root of this repository, which the badge
site reads by itself: opening the questionnaire and pressing "Save (and continue)" with the robot
icon fills the form with them, to accept or change. This file is that list in prose, and
test/openssf.test.js fails when the two stop naming the same criteria.

The project entry is https://www.bestpractices.dev/en/projects/14721.

Keep this file honest. A criterion answered here and no longer true in the repository is worse than
an unanswered one, and the badge is rechecked at every release.

Shorthand used below: **repo** is `https://github.com/TheFleece/dota2-mod-manager`, **site** is
`https://dota2modmanager.com`.

## Basics

| Criterion | Answer | URL to give |
| --- | --- | --- |
| `description_good` | Met | repo README.md, first paragraph |
| `interact` | Met | repo README.md (Download, Report a bug, Contributing) |
| `contribution` | Met | repo CONTRIBUTING.md |
| `contribution_requirements` | Met | repo CONTRIBUTING.md |
| `floss_license` | Met: GPL-3.0-only | repo LICENSE |
| `floss_license_osi` | Met: GPL-3.0 is OSI approved | repo LICENSE |
| `license_location` | Met: LICENSE in the repository root | repo LICENSE |
| `documentation_basics` | Met | site, and repo README.md |
| `documentation_interface` | Met | repo docs/API.md, generated from the source by `npm run docs` and checked in CI |
| `sites_https` | Met: github.com, dota2modmanager.com and cdn.dota2modmanager.com are TLS only | site |
| `discussion` | Met: GitHub Issues and Discussions, plus the project's Discord | repo issues |
| `english` | Met: every document in the repository is English; README.ru.md and CHANGELOG.ru.md are twins for Russian users | repo README.md |
| `maintained` | Met | repo commits |

**Justification for `documentation_interface`** (paste into the box):

> The app is a desktop program, and its external interfaces are documented in three places: the
> window itself is described with screenshots on the site, the `d2mm://` link format and the
> settings file are described in ARCHITECTURE.md, and every exported function of every module is
> in docs/API.md, which is generated from the source and fails CI when it drifts.

## Change control

| Criterion | Answer | URL to give |
| --- | --- | --- |
| `repo_public` | Met | repo |
| `repo_track` | Met: git | repo commits |
| `repo_interim` | Met: every change lands on main through a pull request, between releases | repo commits |
| `repo_distributed` | Met: git | repo |
| `version_unique` | Met: each release is a `vX.Y.Z` tag and the version in package.json | repo releases |
| `version_semver` | Met: SemVer, features in minor, fixes in patch | repo CONTRIBUTING.md |
| `version_tags` | Met: `git tag vX.Y.Z` is what starts a release | repo RELEASING.md |
| `release_notes` | Met: CHANGELOG.md holds a section per version, and the release workflow puts that section in the GitHub release and in the Discord announcement | repo CHANGELOG.md |
| `release_notes_vulns` | Met | repo CHANGELOG.md |

**Justification for `release_notes_vulns`**:

> No vulnerability has been reported in this project's own code. When an advisory in a dependency
> touched the app, the release notes said what it was and whether the app was affected: 2.6.11
> describes the adm-zip path traversal advisory and explains that the app never lets that library
> write to disk, so no installed mod could have used it.

## Reporting

| Criterion | Answer | URL to give |
| --- | --- | --- |
| `report_process` | Met | repo CONTRIBUTING.md, "Reporting a bug" |
| `report_tracker` | Met: GitHub Issues, with templates | repo issues |
| `report_responses` | Met | repo issues |
| `enhancement_responses` | Met | repo issues |
| `report_archive` | Met: public issues and Discussions | repo issues |
| `vulnerability_report_process` | Met | repo SECURITY.md |
| `vulnerability_report_private` | Met: GitHub private vulnerability reporting is on, and SECURITY.md sends reporters there | repo SECURITY.md |
| `vulnerability_report_response` | Met | repo SECURITY.md |

**Justification for `report_responses`**:

> Every issue opened so far has an answer from the maintainer. CONTRIBUTING.md promises a first
> reply within 72 hours, and a daily job (`tools/radar.mjs`) measures the project against that
> promise and messages the maintainer when something is overdue.

**Justification for `vulnerability_report_response`**:

> No vulnerability report has been received. SECURITY.md promises a first reply within 48 hours,
> and the same daily job watches that promise.

## Quality

| Criterion | Answer | URL to give |
| --- | --- | --- |
| `build` | Met: `npm ci` then `npm run dist` (electron-builder); CI builds the installer, the portable build and the AppImage for every release | repo .github/workflows/release.yml |
| `build_common_tools` | Met: npm, electron-builder, GitHub Actions | repo package.json |
| `build_floss_tools` | Met: Node.js, npm and electron-builder are FLOSS | repo package.json |
| `test` | Met: `npm test`, 78 test files on node:test, released under the project's own licence | repo test/ |
| `test_invocation` | Met: `npm test` | repo package.json |
| `test_most` | Met | repo .github/coverage-baseline.json |
| `test_continuous_integration` | Met: the suite runs on Linux and Windows for every push and every pull request | repo .github/workflows/test.yml |
| `test_policy` | Met | repo CONTRIBUTING.md |
| `tests_are_added` | Met | repo pull requests |
| `tests_documented_added` | Met | repo CONTRIBUTING.md |
| `warnings` | Met: ESLint for code that cannot run, and `tsc --checkJs` over the JSDoc | repo eslint.config.js |
| `warnings_fixed` | Met: both run in `npm run verify`, which is the CI gate | repo package.json |
| `warnings_strict` | Met with a note | repo eslint.config.js |

**Justification for `test_most`**: 

> Coverage is measured on every run and held two ways: an aggregate floor of 74% of lines in the
> gate, and each file's own number per platform in .github/coverage-baseline.json, which a run
> below them fails. Measured today it is about 83% of lines and 80% of branches, with the modules
> that write into the player's game folder above 85%.

**Justification for `test_policy` and `tests_are_added`**:

> CONTRIBUTING.md states that a fix arrives with a test, or with a `No-Test-Because:` line saying
> why none is possible. A required check on every pull request ("A fix brings its test") enforces
> it against the diff. Beyond that, `.github/mutants.json` holds deliberate breakages of the
> promises the tests are supposed to guard, and a weekly run breaks each one to check the suite
> notices; a mutant that survives is a test that proves nothing.

**Justification for `warnings_strict`**:

> The linter is deliberately limited to correctness rules rather than style, because the project
> wants a failed lint to mean "this line will throw". Type checking is stricter over time by
> construction: the number of type errors per file is written down and can only fall.

## Security

| Criterion | Answer | URL to give |
| --- | --- | --- |
| `know_secure_design` | Met | repo ARCHITECTURE.md, "Who is allowed to have written this" |
| `know_common_errors` | Met | repo docs/incidents/ |
| `crypto_published` | Met: SHA-256 and Ed25519 from Node's own crypto, TLS from the platform | repo src/catalog.js |
| `crypto_call` | Met: node:crypto only, no cryptography of the project's own | repo src/catalog.js |
| `crypto_floss` | Met | repo package.json |
| `crypto_keylength` | Met: SHA-256 and Ed25519 | repo src/remote-config.js |
| `crypto_working` | Met | repo src/remote-config.js |
| `crypto_weaknesses` | Met | repo src/catalog.js |
| `crypto_pfs` | Met: every connection is TLS 1.3 or 1.2 with ECDHE, provided by Node and Chromium | repo src/net.js |
| `crypto_password_storage` | N/A: the app stores no passwords | repo src/discord-auth.js |
| `crypto_random` | Met: `crypto.randomBytes` for the OAuth state | repo src/discord-auth.js |
| `delivery_mitm` | Met: downloads and updates are HTTPS from GitHub releases or the project's own CDN | repo SECURITY.md |
| `delivery_unsigned` | Met | repo SECURITY.md |
| `vulnerabilities_fixed_60_days` | Met | repo security advisories |
| `vulnerabilities_critical_fixed` | Met | repo CHANGELOG.md |
| `no_leaked_credentials` | Met: secret scanning and push protection are on, and every secret a workflow reads is listed in .github/credentials.json and tried against its service every morning | repo .github/credentials.json |

**Justification for `know_secure_design`**:

> The app writes into another program's folder and installs files written by strangers, so the
> design is built around least privilege and around not trusting input. The renderer has no Node
> integration, no file access and no network beyond an explicit bridge. Every archive comes through
> one door that refuses paths climbing out of their folder, refuses names Windows treats specially,
> and caps sizes and ratios. Every write to the game folder is one transaction that rolls back
> whole. The catalog is signed with a pinned key, each archive is checked against a published
> SHA-256, and the project's own remote switches are signed as well. Workflow tokens are read-only
> unless a job asks otherwise, and every action is pinned to a commit.

**Justification for `know_common_errors`**:

> Path traversal (zip slip), time-of-check to time-of-use, unsafe zip expansion, and trusting a
> file because of its name are the errors this kind of software gets wrong, and each has a guard
> and a test here. The project also keeps write-ups of what has gone wrong in docs/incidents/, each
> naming the test or the check that would catch it again; a test in the suite fails when one of
> those guards is renamed or deleted.

**Justification for `crypto_working` and `crypto_weaknesses`**:

> Integrity is SHA-256 and signatures are Ed25519. SHA-1 appears in two places that are not
> security mechanisms: cache file names, and the fingerprint of a VPK's own index, which the game's
> format defines. Neither decides whether anything is trusted.

**Justification for `delivery_unsigned`**:

> Every release carries SHA256SUMS, a Sigstore attestation of that list produced by the release
> workflow, and an SBOM. Updates are fetched over HTTPS and verified by electron-updater against
> the hashes in the signed update feed. Mod archives are checked against `mod-hashes.json`, which
> the catalog publishes and signs with a key pinned in the app.

**Justification for `vulnerabilities_fixed_60_days`**:

> No known vulnerability is open. `npm audit` runs over both lockfiles every morning and its
> findings appear in the project status issue the same day; Dependabot opens security updates and
> minor ones merge themselves once every check passes.

## Analysis

| Criterion | Answer | URL to give |
| --- | --- | --- |
| `static_analysis` | Met: CodeQL on every pull request and on a schedule, plus ESLint and `tsc --checkJs` | repo .github/workflows/codeql.yml |
| `static_analysis_common_vulnerabilities` | Met: CodeQL's security queries for JavaScript and TypeScript | repo security code scanning |
| `static_analysis_fixed` | Met | repo security code scanning |
| `static_analysis_often` | Met: every pull request, every push to main, and weekly | repo .github/workflows/codeql.yml |
| `dynamic_analysis` | Met | repo .github/workflows/e2e.yml |
| `dynamic_analysis_unsafe` | N/A: the project's own code is JavaScript; no C or C++ is written here | repo |
| `dynamic_analysis_enable_assertions` | Met with a note | repo test/ |
| `dynamic_analysis_fixed` | Met | repo docs/incidents/ |

**Justification for `static_analysis_fixed`**:

> Two high-severity CodeQL findings were open in September 2026 and both were fixed the day they
> were reported, each with a test. Since 17 September the branch rule on main refuses to merge a
> pull request that adds an alert at High or higher, so a finding cannot reach main and wait.

**Justification for `dynamic_analysis`**:

> Three kinds. The built installer and AppImage are installed and clicked through on Linux and on
> Windows before a release becomes public: install a mod, switch it off, restart, switch it on,
> remove it, with the game folder checked on disk after every step. The VPK and zip parsers are
> fuzzed with seeded random input, and every input that broke one is kept as a test. And a weekly
> mutation run breaks the promises the tests guard, to check the suite notices.

**Justification for `dynamic_analysis_enable_assertions`**:

> The test suite is assertions, and the app itself refuses rather than assumes at every boundary
> that matters: a path that would leave its folder, an archive that lies about its size, a game
> folder that holds no game. Production builds do not carry extra assertions beyond those refusals.

## After the badge

- Put the badge in both READMEs, in the row of badges at the top.
- Teach `tools/radar.mjs` to read the badge level, so a questionnaire that goes stale says so.
- Silver asks for things this project does not have yet: a second maintainer, a documented
  architecture review, and a signed release binary. Phase 3 of the quality plan is aimed there.
