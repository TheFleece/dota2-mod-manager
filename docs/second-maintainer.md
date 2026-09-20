# The second maintainer

What the role is, what it is not, and what to do on the day it matters.

This project is written by one person. That is fine for the code, which is public and licensed so
anybody may carry it on, and it is not fine for everything around the code: releases, the update
feed people's copies read, the issues somebody has to close. Those need a person with rights,
and rights have to be given before they are needed rather than after.

So the project keeps a second maintainer. Who that is at any time is named in
[GOVERNANCE.md](../GOVERNANCE.md); this file is what the role means.

## What you get

**The Maintain role on the repository.** You can merge pull requests, push tags, edit and close
issues, and manage labels and releases. You cannot read or change the repository's secrets and
you cannot delete the repository, because neither is needed for any of the above.

That is on purpose. The role is meant to let somebody keep the project moving without handing
over anything that would hurt if the account were lost.

## What is asked of you

**Look at pull requests when you have time.** Not all of them and not on a clock. A second pair
of eyes on a change that writes into somebody's game folder is worth more than a green tick, and
that is the whole point of the role.

**For the first few weeks, look at each one.** Long enough for both sides to find out whether
this works in practice: what the checks cover, what a review here is worth arguing about, where
the documents are. After that, as much or as little as suits you.

**Be reachable.** If the maintainer stops answering for weeks, somebody should be able to write
to you and get an answer.

## What is not asked of you

You are not asked to write code, to fix bugs, to answer users, to be on call, or to be
responsible for anything shipping on time. Nothing here is an obligation and nothing here expires
badly: telling the maintainer you would rather not any more ends it, with the file updated to
match and nothing else said about it.

## A review here, in practice

**An approval is welcome and is never a gate.** Pull requests do not require an approving review,
deliberately: the maintainer works alone most days and waiting on a second person for a typo fix
would mean the rule gets switched off the first time it is inconvenient, which teaches everybody
that the rule is decoration. What holds a change back is the checks, and they hold it back for
everybody including the maintainer.

So a review is an opinion, offered when it is worth offering. The things worth an opinion:

- anything that writes into the game folder (`src/patcher.js`, `src/vpk.js`, `src/gamelang.js`,
  `src/schema.js`, `src/file-tx.js`, `src/overlays.js`),
- anything that decides what gets downloaded or whether it is trusted (`src/net.js`,
  `src/catalog-signature.js`, `src/remote-config.js`),
- the release workflow,
- and any text a user reads, where a second reader catches what the first cannot see any more.

[CONTRIBUTING.md](../CONTRIBUTING.md) says what a change has to carry, and
[ARCHITECTURE.md](../ARCHITECTURE.md) says how the thing is put together.

## If the maintainer disappears

The point of the role. In order:

1. **Give it a couple of weeks.** People come back.
2. **Say so in the open**, in an issue, so users and contributors are not guessing.
3. **Keep the project moving.** Merge what is ready, close what is finished. Every pull request
   runs the same checks; a green one is as safe in your hands as in his.
4. **Release when there is something to release.** [RELEASING.md](../RELEASING.md) is the whole
   procedure: a changelog section in both languages, a version bump, a tag. CI builds the
   installer, signs the provenance, publishes the release and updates the mirror. No key of the
   maintainer's is needed for any of it.

What you will not be able to do, and what it costs:

- **Sign `config/app.json`.** The private key is on the maintainer's machine alone. That file can
  switch a broken feature off after a release; without the key it cannot be changed, and every
  copy of the app carries on with the last signed version, which is the same as it being
  unreachable. Nothing breaks, one emergency handle is gone.
- **Touch the site, the domain or the mirror bucket.** They keep serving what is already on them.
  The app falls back to GitHub when the mirror does not answer, which is what it does today when
  the mirror is behind.

So: releases keep coming, and two conveniences stop. That is the difference between a project
that stops dead and one that carries a dent.

## Granting the role

For the maintainer, when somebody accepts:

1. **Settings, Collaborators and teams, Add people**, with the role **Maintain**.
2. Add their handle in [`.github/CODEOWNERS`](../.github/CODEOWNERS), so GitHub asks them for a
   review on its own instead of somebody remembering to.
3. Add their name to the maintainers list in [GOVERNANCE.md](../GOVERNANCE.md). A test fails if
   the two disagree, so neither can quietly go stale.
4. Answer `access_continuity` on the
   [OpenSSF entry](https://www.bestpractices.dev/en/projects/14721) with what is now true, and
   update `.bestpractices.json` to match.
5. Point them at this file and at [RELEASING.md](../RELEASING.md). Nothing else has to be handed
   over.

Taking it back is the same list in reverse, and it is not an accusation: an account that has gone
quiet for a year is a key nobody is holding.
