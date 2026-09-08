# Decisions, gaps and repeated claims

Reviews of this repository, by people and by models, keep arriving with the same three problems.
They file a deliberate trade-off as a flaw. They miss a real weakness because nothing points at
it. They repeat something that was true in August and stopped being true in September.

So this file carries three lists: what was decided on purpose and what the alternative cost, what
is genuinely missing, and which claims keep coming back with the command that settles them.

**Every entry ends with a check you can run.** Nothing here asks to be believed. If a check
disagrees with what is written above it, the check is right and the text is stale, and an issue
saying so is welcome. Gone over on 2026-09-08, at version 2.6.4.

---

## Decided on purpose

### There is no linter and no formatter

`.editorconfig` covers indentation, `.gitattributes` covers line endings, and nothing else
enforces shape. ESLint would be the first development dependency beyond Electron and its
builder, its first run over the source would produce a reformatting commit nobody can review,
and a CI gate that fails on spacing rather than on behaviour teaches people to stop reading CI.
The checks here aim at correctness instead, and there are enough of them to fail a bad change.

*Check:* `CONTRIBUTING.md` under Style, and `.github/workflows/` for what does gate a push.

### The app ships two dependencies

`adm-zip` and `electron-updater` ship inside it; `electron` and `electron-builder` only build
it. The VPK reader and writer, the KeyValues parser, the zip guards, the mirror logic and the
update checks are written here, because every dependency is a stranger with write access to a
game folder on tens of thousands of machines. That is a bias rather than a ban: a pull request
adding one has to say what it replaces and why writing it here is worse.

*Check:* `node -e "const p=require('./package.json');console.log(p.dependencies,p.devDependencies)"`

### Valve's `vpk.exe` is deliberately absent

It is proprietary, and a project that bundles it is not open source in the sense a code-signing
programme means. Reading and writing VPK archives is this repository's own code.

*Check:* `src/vpk.js`, and `test/vpk.test.js`, which runs the writer against the reader.

### The renderer is plain JavaScript

No framework, no bundler, no transpiler, and no TypeScript in the app. What ships is what is in
the repository, so a reviewer reading `renderer/app.js` is reading the program rather than its
input. The documentation site under `site/` is a separate package and does use Astro and
TypeScript.

*Check:* `npm start` runs Electron against the source directly. There is no build step to read.

### The documentation site lives in this repository

The site's numbers come from the app's own version and from the catalog at build time, so a page
cannot claim a version the repository does not have. Typed-in numbers had already drifted once,
in August 2026, when the landing said 1,150 mods against a catalog holding 1,090.

*Check:* `site/src/lib/stats.ts`, and the fact sheet at <https://dota2modmanager.com/facts/>.

### `fingerprints.json` sits at the repository root and cannot move

Reviews suggest moving the generated files to a data branch or to build artifacts. That one
cannot go: installed copies of the app fetch it from `raw.githubusercontent.com` at the path it
has in `main`. Moving it breaks every copy already on somebody's machine, and no release fixes
the ones already out there.

*Check:* `src/fingerprints.js`, the `FP_URL` constant.

### A quarter of the commits are made by a scheduled job, and they stay

A workflow checks the upstream catalog every thirty minutes and commits when it moved, which is
around 120 of the commits here. They are not squashed away and the interval is not lowered:
freshness is the point, and since 2026-09-08 the files are written one record per line with a
subject naming what arrived or left, so the commits can be read like any other.

*Check:* `git log --oneline` for the subjects, `tools/json-lines.js` and `tools/index-delta.js`
for how they are produced, and `test/json-lines.test.js` for what the formatter guarantees.

### Eleven commits from August carry a co-author trailer, and the history was not rewritten

They were made with an assistant and the trailer was left in the body. Cleaning them means
rewriting everything from 7 August: about 350 of the SHAs move, the release tags move with them,
and every external link to a commit dies. The assistant appears nowhere as an author, only in
those eleven trailers.

*Check:* `git log --grep='Co-Authored-By' --format='%h %ad %s' --date=short` and
`git shortlog -sne HEAD`.

### Working with an assistant is stated rather than hidden

`AGENTS.md` says how this project expects an assistant to be used, what the tests will not let
one do, and where the house style is written down. Commits and pushes are the maintainer's.

*Check:* `AGENTS.md`.

### The maintainer pushes to `main` without opening a pull request

A solo project does not gain anything from reviewing itself in a web form. The gate is a
repository ruleset: the required `test` check has to pass, `main` cannot be deleted and cannot
be force-pushed. Anyone else's change arrives as a pull request and lands on `CODEOWNERS`.

*Check:* `gh api repos/TheFleece/dota2-mod-manager/rulesets`. Note that
`gh api repos/TheFleece/dota2-mod-manager/branches/main/protection` answers **404 Branch not
protected**, because this is a ruleset and not classic branch protection. Reviewers have read
that 404 as an unguarded branch.

### The coverage numbers are a floor, not a target

They sit just under what the suite reaches, so the gate does not fail on the state it was written
in and does fail the moment somebody adds code nothing exercises. Node only reports files a test
loaded, so a module with no test at all is invisible here rather than counted as zero. The gate
holds the line; it does not claim the line is where it should be.

*Check:* the `test:coverage` script in `package.json`, and the comment above the step in
`.github/workflows/test.yml`.

### The catalog signature check ships switched off

`src/catalog-signature.js` verifies an ed25519 signature over the catalog data and has tests for
every way it can fail, but `CATALOG_PUBLIC_KEY` is empty, so it stands aside. The key has to come
from whoever publishes the catalog, and a check that failed shut without one would break the app
for everybody until it arrived. What this leaves open is in the gaps below.

*Check:* `src/catalog-signature.js` and `test/catalog-signature.test.js`.

### Nothing is collected, and that is enforced by review rather than by a setting

There is no telemetry, no analytics, no crash reporting and no opt-out to configure, because
there is nothing to opt out of. `PRIVACY.md` lists every address the app can contact and what it
stores on disk.

*Check:* `PRIVACY.md`, and grep the source for an outbound call: `grep -rn "fetch\|https.get" src/`.

---

## Known gaps

Real ones. Listed here so a review does not have to find them and so the answer is the same
whoever asks.

### The installer is not signed

Windows SmartScreen says "unknown publisher" on first run. SignPath Foundation, which signs open
source for free, turned the application down in August 2026 for not having enough public
visibility yet; a commercial certificate runs a few hundred dollars a year against a program
nobody pays for. What stands in for a signature: every binary is built by a public workflow from
a public commit, and the update metadata beside it carries a SHA-512 of the file.

*Check:* the run that produced any release under
<https://github.com/TheFleece/dota2-mod-manager/actions/workflows/release.yml>, and `latest.yml`
in the release assets.

### One maintainer

One person writes it, reviews it and releases it. There has been one outside pull request and a
handful of issues from users. Nothing about the project survives that person losing interest,
which is worth knowing before depending on it.

*Check:* `git shortlog -sne HEAD`, and the contributors list on GitHub.

### The unit tests run on Linux only

Most users are on Windows, the code that finds a Steam install branches on the operating system,
and CI runs `ubuntu-latest`. A Windows job would exercise the half the runner currently skips.
Open as issue [#5](https://github.com/TheFleece/dota2-mod-manager/issues/5) and cut for a first
contribution.

*Check:* `.github/workflows/test.yml`.

### The catalog is read without verifying who wrote it

The app reads the catalog through public mirrors for users who cannot reach GitHub, and today
nothing proves the JSON came from the catalog's author rather than from the mirror operator. The
verification code is written and dormant, waiting on a public key from the catalog side. The same
gap covers `config/app.json`, which carries the remote notices and the feature switches.

*Check:* `src/catalog.js`, `src/net.js`, `src/remote-config.js`.

### Mod archive hashes are trust on first use

The app remembers the SHA-256 of an archive the first time it downloads it and refuses different
bytes under the same name afterwards. That catches a later substitution and not the first one. A
hash list published with the catalog would close it.

*Check:* `src/installer.js`, the download index.

### The diagnostic report carries two real paths

`userdata-listing.txt` starts with the app's own folder, which on Windows is under
`C:\Users\<account name>`, and the report names the game folder. The user exports the file and
attaches it themselves, so nothing leaves the machine on its own, but the account name rides
along. Masking both to `%USERPROFILE%` and a placeholder is a small change nobody has made.

*Check:* `src/diagnostics.js`, `folderListingText`.

### `main.js` still holds several jobs

It went from 3,102 lines to 1,266 when the IPC handlers moved into `src/ipc-*.js`. What is left
is the window, the log, auto-update, deep links, import orchestration, cursor reconciliation and
the language folder, which is more than one file's worth of subject.

*Check:* `wc -l main.js`, and `ARCHITECTURE.md` for what is supposed to live where.

### No macOS build, and the Linux one is young

Windows has a year behind it. Linux has shipped an AppImage since 2.4.0 and is started against a
game tree by CI, but it has a fraction of the running time. macOS is not built at all, and Dota's
own layout there has never been tested here.

*Check:* the assets on any release, and `.github/workflows/linux.yml`.

---

## Open questions

Weighed, not settled. Listed so nobody files them as an oversight.

### The repository carries 46 MB of catalog preview images

`site/public/mods/` is 1,317 files and 45 MB on disk, and 82% of the pack once history is counted
in. It grows by five to ten files a day. Committing them was decided when there were 468 of them
averaging 14 KB. The candidates are leaving it alone, fetching them during the site build instead
of committing them, and serving them from the R2 bucket that already mirrors the mod archives.
For what it is worth, the four generated JSON files that reviews usually blame for the size are
1.55 MB of that pack, so this is where the weight actually is.

*Check:*
```
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize:disk) %(rest)' | awk '$1=="blob"&&$4~/^site\/public\/mods\//{n+=$3} END{print n/1048576" MB"}'
```

### Where a second copy of the source should live

A mirror was set up on Codeberg on 2026-09-08 and stood down the same day: their terms of use,
changed on 23 July, ask projects written with heavy use of language models not to host there, and
this one says in `AGENTS.md` that it is. Looking for a different second home rather than a wording
that slips through. A mirror carries no collaboration, so this is about durability and nothing
else.

*Check:* `.github/workflows/mirror.yml`.

### Applying to SignPath again

The first application was turned down for public visibility rather than for anything in the code.
The picture has changed since: 39 releases, tens of thousands of installs, a community around the
catalog, and a comparable tool in the same ecosystem already signed by the same programme. Not
resubmitted yet.

---

## Claims that keep coming back

Each of these has arrived in a review. Each is answered by one command.

| Claim | What is true | Check |
|---|---|---|
| "The repository cannot be opened, so the open-source promise is unverifiable" | It is public and has been. A fetch failing at one moment is not a private repository | `gh repo view TheFleece/dota2-mod-manager --json visibility` |
| "`main.js` is a 3,100 line monolith" | 1,266 lines since 2026-09-06, with the IPC handlers in `src/ipc-*.js` | `wc -l main.js` |
| "The catalog counts on the site disagree between pages" | They are counted when each page is built. Two pages built an hour apart show two numbers, and both were right when they were made | `site/src/lib/stats.ts` |
| "The state files in the root are why the repository is 61 MB" | All four generated JSON files together are 1.55 MB of the pack. The preview images are 46.7 MB | the command under the open question above |
| "It is a Windows-only app" | Every release since 2.4.0 also carries a Linux AppImage | `gh release view --json assets` |
| "`main` is unprotected" | It is guarded by a ruleset, which the branch-protection endpoint does not report | `gh api repos/TheFleece/dota2-mod-manager/rulesets` |
| "There are 25 test files" | 35 files and 363 tests, run on every push | `ls test/*.test.js \| wc -l` then `npm test` |
| "An open issue asks for tests that already exist" | Issue #4 was closed on 2026-09-08 when that was pointed out. `#5`, `#6` and `#7` are open and really are open | `gh issue list --state open` |

---

## Reviewing this project

Nothing here is off limits and a finding that is uncomfortable is still welcome. Two requests.
Say which commit or release you looked at, because this repository moves quickly and a review of
last month's tree reads as wrong rather than as dated. And run the check next to a claim before
filing it, because most of what arrives has one.

Where to put it: an [issue](https://github.com/TheFleece/dota2-mod-manager/issues) for anything
public, and a [private advisory](SECURITY.md) for anything exploitable.
