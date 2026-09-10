# Security

## Reporting a vulnerability

Open a private advisory:
[github.com/TheFleece/dota2-mod-manager/security/advisories/new](https://github.com/TheFleece/dota2-mod-manager/security/advisories/new)

It reaches the author and nobody else. Do not open a public issue for something exploitable.

Tell me what you did and what happened. A rough description beats none, and a way to reproduce
it beats everything. I will answer, and I will say plainly whether I think it is a problem.

## What the app is, in terms of what can go wrong

It runs on your machine, keeps no server of its own and holds no account. What it does touch:

- **The Dota folder.** It writes mod archives into the language folder the game mounts, and can
  patch `gameinfo_branchspecific.gi` when the cosmetics feature is switched on. It copies
  Valve's files before the first write and puts them back byte for byte on revert.
- **The network.** It reads the mod catalogue and the mods themselves from
  [h6rd/Dota2PornFxWeb](https://github.com/h6rd/Dota2PornFxWeb), through public mirrors when
  GitHub is unreachable, and it downloads one MIT-licensed tool from its own project's
  releases, pinned by SHA-256.

  None of that route is trusted. The catalogue files carry an ed25519 signature by their author
  and the app refuses bytes that do not verify against a pinned key; each mod archive is checked
  against a SHA-256 from that signed list; and the file that can switch a feature off after a
  release is signed by this project's own key and ignored when it does not verify. The whole
  chain, including what each failure costs and what it does not cover, is written out in
  [ARCHITECTURE.md](ARCHITECTURE.md) under "Who is allowed to have written this".
- **Files you hand it.** Mod archives, preset files that travel between strangers, and folders
  you drop on the window.

Anything that gets code running, writes outside those places, or turns catalogue data into an
instruction is worth reporting. So is anything that makes the app fetch from somewhere it was
not asked to.

## Scope

In scope: this repository, and the installers published from it.

Out of scope: the mods themselves and the catalogue that hosts them, which belong to h6rd and
to the mod authors. Report those to them. Also out of scope: whether modding Dota is a good
idea, which is a question for you and not a vulnerability.

## Versions

The current release is the one that gets fixed. The app updates itself, so there is no line of
older versions to patch.
