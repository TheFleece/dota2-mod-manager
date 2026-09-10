# Decisions, gaps and repeated claims

Reviews of this repository, by people and by models, keep arriving with the same three problems.
They file a deliberate trade-off as a flaw. They miss a real weakness because nothing points at
it. They repeat something that was true in August and stopped being true in September.

So this file carries three lists: what was decided on purpose and what the alternative cost, what
is genuinely missing, and which claims keep coming back with the command that settles them.

**Every entry ends with a check you can run.** Nothing here asks to be believed. If a check
disagrees with what is written above it, the check is right and the text is stale, and an issue
saying so is welcome.

The countable claims are held to the code by `test/decisions.test.js`, which fails when this
file and the repository disagree about how long `main.js` is, how many test files there are, what
the app depends on, or where the fingerprint index is fetched from. The date below is left out
of that on purpose: it records when a person last read the whole file, and a test that kept it
current would be forging a review nobody did.

Last gone over on 2026-09-08, at version 2.6.4.

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

`adm-zip` and `electron-updater` ship inside it; `electron`, `electron-builder` and `eslint`
only build and check it, and never reach a user's machine. The VPK reader and writer, the
KeyValues parser, the zip guards, the mirror logic and the update checks are written here,
because every dependency is a stranger with write access to a game folder on tens of thousands
of machines. That is a bias rather than a ban: a pull request adding one has to say what it
replaces and why writing it here is worse.

`eslint` was added on 2026-09-10 and is the one case where writing it here would have been the
wrong answer. Two releases shipped in which no mod could be installed, because splitting a file
left a function call pointing at a function that had stayed behind. Every test passed: they read
the files as text, or never loaded a module that needs Electron. `no-undef` names that in under
a second, and a scope analyser is exactly the kind of thing not to write by hand - the version
attempted here first reported 240 problems, of which one was real.

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

### The source is mirrored, and the workflow does not name where

A copy of `main` and every tag goes to <https://gitlab.com/TheFleece/dota2-mod-manager>. This is
a Dota modding tool: the realistic ways it disappears are a takedown, a suspended account, or a
decision about the catalog it installs from, and none of those give notice. The mirror carries no
issues and no merge requests, because it is a copy rather than a second place to work.

The workflow does not name the host. A mirror was set up on Codeberg on 2026-09-08 and stood down
the same day, when their terms of use turned out to ask projects written with heavy use of
language models not to host there, and moving cost a code change it should not have cost. It now
pushes wherever the `MIRROR_PUSH_URL` secret points and exits green saying nothing is configured
when it points nowhere, so the next move is a secret and not a commit.

*Check:* `git ls-remote https://gitlab.com/TheFleece/dota2-mod-manager.git`, which needs no
account and should answer with the same commit on `main` and the same tags as this repository.

### This project is written with Claude Code, and says so

Since the first commit, on 20 July 2026. Commits carry a `Co-Authored-By` trailer, `README.md`
has a section about it above the dependency table, and `AGENTS.md` asks anyone sending a change
to keep the trailer on theirs.

Two entries used to stand here instead. One explained why eleven commits from August had a
trailer nobody had cleaned out of them. The other said that working with an assistant was
"stated rather than hidden", while `AGENTS.md` on the same day asked contributors not to state
it. Together they read as a project embarrassed by a tool it uses every day, which was never the
position and is not worth the room.

So nobody has to open a review with "was this AI-generated". Yes, it is on the front page, and
every question worth asking after that one is answered elsewhere in this file with a command.

*Check:* `git log --grep='Co-Authored-By' --format='%h %ad %s' --date=short`, the "Written with
Claude Code" section of `README.md`, and **Attribution** in `AGENTS.md`.

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

### The catalog is verified, and the key was pinned later than it arrived

`src/catalog-signature.js` checks an ed25519 signature over every catalog file the app reads, so
a proxy handing over a rewritten `mods.json` fails here rather than at the point where somebody's
machine acts on it. The catalog's author holds the private half.

The key arrived on 2026-09-09 and was pinned on the 10th. In between, the catalog published its
data and its signatures in separate commits, which left one to eight minutes after every update
where the published files disagreed with their own signatures - indistinguishable here from an
attack, and really a bot that had not run yet. Existing users would have kept their cached
catalog; anyone installing the app in those minutes would have had none at all, about five times
a day. The author now writes data and signatures in one commit, so the disagreement has no moment
to happen in.

The whole chain this belongs to - what carries a proof, what each failed check costs, and what
none of it covers - is written out in [ARCHITECTURE.md](ARCHITECTURE.md) under "Who is allowed
to have written this".

*Check:* `src/catalog-signature.js`, `test/catalog-signature.test.js`, and the catalog's own
`.github/workflows/update-catalog.yml`, where one `git add` stages the data and the signatures.

### The switches this project can pull are signed too, and a failed check ignores them

`config/app.json` can turn a feature off after a release and put a notice in front of everyone
who opens the app, and it travels the same public proxies as everything else. It is signed with a
key of this project's own, pinned in `src/remote-config.js`.

A copy that does not verify is treated as no file at all, which is what that module already does
with every other failure. Refusing to start would be the wrong trade: the worst an attacker gets
from breaking the signature is that the notices stop arriving, and dropping the request achieved
that already. What they no longer get is to put words on the screen in this project's name.

*Check:* `test/remote-config-signature.test.js`, which fails the build when the committed file
and its signature disagree - the failure an unsigned edit would otherwise cause in silence, on
the day somebody reached for a switch and it did not work.

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

### The coverage floor is measured on one platform only

The suite runs on both since 2026-09-09, which is what issue
[#5](https://github.com/TheFleece/dota2-mod-manager/issues/5) asked for: `ubuntu-latest` carries
the coverage gate, `windows-latest` runs the same tests for correctness, and that job earned
itself on its first run by finding a libuv abort Linux cannot see.

What is still one-sided is the floor. `src/steam.js` takes a different half of itself on each
operating system, so the two platforms report different figures, and the gate is calibrated
against the Linux one. Windows-only code can therefore lose its last test without the number
moving.

*Check:* `.github/workflows/test.yml`, and the `test:coverage` script in `package.json`.

### The newest mods are still trusted on first sight

Since 2026-09-09 the catalog publishes a signed sha256 for every archive, and a download that
does not match it is refused rather than installed. What is left is the lag: the list is rebuilt
by a bot after the mods are added, so the freshest archives are not in it yet - 21 of 992 on the
day it arrived - and those fall back to the old behaviour, remembered on first download and
checked against that copy afterwards.

Refusing them instead would mean the newest mods break for everyone until somebody else's bot
catches up, which is a worse trade than the one this leaves open.

*Check:* `src/catalog.js`, `publishedHash`, and `test/mod-hashes.test.js` for what each answer
does to a download.

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

### Applying to SignPath again

The first application was turned down for public visibility rather than for anything in the code.
The picture has changed since: 39 releases, tens of thousands of installs, a community around the
catalog, and a comparable tool in the same ecosystem already signed by the same programme. Not
resubmitted yet.

*Check:* download the installer from the latest release and ask Windows who signed it:
`Get-AuthenticodeSignature .\Dota-2-Mod-Manager-Setup.exe`. It answers `NotSigned` today, and
the day it stops, this entry is out of date.

---

## Claims that keep coming back

Each of these has arrived in a review. Each is answered by one command.

| Claim | What is true | Check |
|---|---|---|
| "The repository cannot be opened, so the open-source promise is unverifiable" | It is public and has been. A fetch failing at one moment is not a private repository | `gh repo view TheFleece/dota2-mod-manager --json visibility` |
| "`main.js` is a 3,100 line monolith" | 1,311 lines since 2026-09-06, with the IPC handlers in `src/ipc-*.js` | `wc -l main.js` |
| "The catalog counts on the site disagree between pages" | They are counted when each page is built. Two pages built an hour apart show two numbers, and both were right when they were made | `site/src/lib/stats.ts` |
| "The state files in the root are why the repository is 61 MB" | All four generated JSON files together are 1.55 MB of the pack. The preview images are 46.7 MB | the command under the open question above |
| "It is a Windows-only app" | Every release since 2.4.0 also carries a Linux AppImage | `gh release view --json assets` |
| "`main` is unprotected" | It is guarded by a ruleset, which the branch-protection endpoint does not report | `gh api repos/TheFleece/dota2-mod-manager/rulesets` |
| "There are 25 test files" | 44 of them, run on Linux and on Windows on every push | `ls test/*.test.js \| wc -l` then `npm test` |
| "An open issue asks for tests that already exist" | Issue #4 was closed on 2026-09-08 when that was pointed out. `#5`, `#6` and `#7` are open and really are open | `gh issue list --state open` |

---

## Reviewing this project

Nothing here is off limits and a finding that is uncomfortable is still welcome. Two requests.
Say which commit or release you looked at, because this repository moves quickly and a review of
last month's tree reads as wrong rather than as dated. And run the check next to a claim before
filing it, because most of what arrives has one.

Where to put it: an [issue](https://github.com/TheFleece/dota2-mod-manager/issues) for anything
public, and a [private advisory](SECURITY.md) for anything exploitable.
