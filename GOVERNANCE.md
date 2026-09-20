# Governance

Who decides what happens to this project, and how you can tell.

## The model

One maintainer decides, in public, through pull requests. That is the whole model, and it is
written down here because "one person decides" is only honest when everybody can see where the
deciding happens.

Every change to the program goes through a pull request against `main`, including the
maintainer's own. A branch rule closes direct pushes to `main`, and the same checks run for
everybody: tests on Linux and Windows, lint, the type-error ceiling, the coverage floor, the size
budget, CodeQL, the English twin for every Russian string, and the rule that a fix carries a test
or says in the commit why it does not. A pull request merges when they are all green.

Decisions that shape the project, rather than the code, go in [DECISIONS.md](DECISIONS.md) with
the reason and the date. A decision you can read is a decision you can argue with.

## Roles

**Maintainer: Mykhailo Lynnyk ([@TheFleece](https://github.com/TheFleece)).** Reviews and merges
pull requests, cuts releases, answers security reports within 48 hours, keeps the app working
against a game that changes under it, and holds the keys: the signing key for `config/app.json`,
the release workflow's secrets, the domain and the mirror bucket. Nobody else has them today, and
[Continuity](#continuity) says what that costs.

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
decision with its reason in [DECISIONS.md](DECISIONS.md). There is no committee and no vote,
because there is nobody to vote.

## Becoming a maintainer

Land changes over time, show the care this project asks for, and you can be invited. The
maintainer invites; the invitation is recorded here, in this file, so the list of people who can
merge is the same list everybody can read.

## Continuity

Today this project has one maintainer, which is a risk it names rather than hides.

What survives without him: the code. It is GPL-3.0 and public, so anybody may fork it and carry
on, and every release carries a provenance attestation that ties its files to the commit they
were built from.

What does not: the releases themselves, the update feed, the signed `config/app.json`, the site
and the mirror. Those need keys and accounts only the maintainer holds, so a fork would have to
start its own. Until that is arranged, the honest answer to "can this project keep releasing if
one person disappears" is no, and it is answered that way on the project's
[OpenSSF Best Practices entry](https://www.bestpractices.dev/en/projects/14721) as well.
