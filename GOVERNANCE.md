# Governance

Who decides what happens to this project, and how you can tell.

## The model

One maintainer decides, in public, through pull requests, and a second one reads every change
before it lands. That is the whole model, and it is written down here because "one person
decides" is only honest when everybody can see where the deciding happens.

Every change to the program goes through a pull request against `main`, including the
maintainers' own. A branch rule closes direct pushes to `main`, and the same checks run for
everybody: tests on Linux and Windows, lint, the type-error ceiling, the coverage floor, the size
budget, CodeQL, the English twin for every Russian string, and the rule that a fix carries a test
or says in the commit why it does not. Since 2026-09-23 the rule also wants an approving review
from a maintainer who did not write the change. A pull request merges when the checks are green
and that approval is on it.

Decisions that shape the project, rather than the code, go in [DECISIONS.md](DECISIONS.md) with
the reason and the date. A decision you can read is a decision you can argue with.

## Roles

**Maintainer: TheFleece ([@TheFleece](https://github.com/TheFleece)).** Reviews and merges
pull requests, cuts releases, answers security reports within 48 hours, keeps the app working
against a game that changes under it, and holds the keys: the signing key for `config/app.json`,
the release workflow's secrets, the domain and the mirror bucket. Nobody else has them today, and
[Continuity](#continuity) says what that costs.

**Second maintainer: Nersaa ([@Nersaa](https://github.com/Nersaa)).** A collaborator on the
repository: they can merge pull requests, push tags and close issues, and they cannot reach the
repository's secrets or its settings. They review the maintainer's pull requests, and the
maintainer reviews theirs, because the branch rule wants an approval from somebody other than the
author. They are also the answer to the question "what happens if one person stops".
[docs/second-maintainer.md](docs/second-maintainer.md) is the whole of it, including what to do on
the day it matters.

**Contributors.** Anybody who opens an issue, a pull request or a translation.
[CONTRIBUTING.md](CONTRIBUTING.md) says what a change has to carry; nothing else is expected, and
no agreement has to be signed. Opening a pull request means the change ships under GPL-3.0 as
part of this program.

**Catalog authors.** The mods and the catalog belong to
[h6rd/Dota2PornFxWeb](https://github.com/h6rd/Dota2PornFxWeb) and to the people who made the
mods. They are not part of this project and have no say in it, and it has none in theirs. The app
reads what they publish and checks the signature on it. A problem with a mod goes to them.

## How a disagreement ends

In the issue, in writing. If it does not end there, the maintainer decides and records the
decision with its reason in [DECISIONS.md](DECISIONS.md). There is no committee and no vote:
two people voting only ever tie.

## Who can merge

<!-- Every handle here must also be in .github/CODEOWNERS, and the other way round;
     test/docs-current.test.js fails when they disagree. -->

| Person | Role | Since |
| --- | --- | --- |
| [@TheFleece](https://github.com/TheFleece) | Maintainer | 2026-07-20 |
| [@Nersaa](https://github.com/Nersaa) | Second maintainer | 2026-09-23 |

Land changes over time, show the care this project asks for, and you can be invited. The
maintainer invites, the row goes in this table, so the list of people who can merge is the same
list everybody can read.

## Continuity

A project one person can merge into is a project that stops when that person does. The answer
here is a second maintainer with rights given before they are needed, described in
[docs/second-maintainer.md](docs/second-maintainer.md): collaborator access, enough to merge, tag
and release, and not enough to reach a secret.

What survives either way: the code. It is GPL-3.0 and public, so anybody may fork it and carry
on, and every release carries a provenance attestation that ties its files to the commit they
were built from.

What a second maintainer adds: releases keep coming. Every pull request runs the same checks, CI
builds and signs and publishes from a tag, and none of that needs a key the maintainer holds
personally.

What stays with the maintainer whatever happens: the private key that signs `config/app.json`,
the domain and the mirror bucket. Losing those costs two conveniences rather than the project.
The switches file stays at its last signed version, which every copy treats exactly as it treats
an unreachable one, and the app falls back to GitHub when the mirror does not answer.

Since 2026-09-23 the table above has two rows, and "can this project keep releasing if one person
disappears" is still not a clean yes. The second maintainer can merge and release what other
people send. They cannot merge a change of their own, a version bump included, because the branch
rule wants an approval from somebody other than the author and only the owner of a personal
repository can change that rule. Moving the repository into an organization with both
maintainers as owners closes it, and until then the project's
[OpenSSF Best Practices entry](https://www.bestpractices.dev/en/projects/14721) keeps answering
no.

The knowledge of how the app keeps up with a game update still sits mostly with one person as
well. Reading every change before it lands is how that moves.
