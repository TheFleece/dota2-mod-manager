/* The search-path patch against a real directory, rather than against strings.
 *
 * test/patcher.test.js pins the text transforms byte for byte and never calls apply(), state()
 * or revert(). That gap had a cost: apply() demanded `dota.signatures` before it would do
 * anything, and Valve's Linux build ships `bin/linuxsteamrt64/` without one. A Linux user
 * pressing "safe mode off" got "dota.signatures not found" and no way forward - reported on
 * 2026-09-11 with a photograph of that folder, holding the client, forty shared libraries and
 * no list.
 *
 * So: both shapes of installation, built in a temporary directory, patched and reverted.
 * `paths()` decides where the list belongs, so this reads the same on either platform.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const patcher = require('../src/patcher.js');
const { MARKER, FOLDER } = patcher;

const GAMEINFO = `"GameInfo"
{
	FileSystem
	{
		SearchPaths
		{
			Game_Language		dota_*LANGUAGE*
			Game				dota
			Game				core
			Mod					dota
			Write				dota
		}
	}
}
`;

const BRANCH = '"GameInfo"\r\n{\r\n\tgame \t\t"Dota 2"\r\n\r\n\tFileSystem\r\n\t{\r\n\t\tSteamAppId\t\t\t\t570\r\n\t}\r\n}\r\n';

/* A list with no entry for the branch file: `vanillaBranchHashes` finds nothing to compare
   against, which is the same answer it gives for a build whose list does not mention it. The
   point here is whether our own line goes in and comes out, not hash arithmetic. */
const SIGNATURES = 'somefile.dll~SHA1:' + 'A'.repeat(40) + ';CRC:' + 'B'.repeat(8) + '\r\nDIGEST:' + 'C'.repeat(40) + '\r\n';

/**
 * A throwaway game tree.
 * @param {object} t
 * @param {boolean} withList  give it a dota.signatures, the way Windows ships one
 */
function tree(t, withList) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2mm-patch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const game = path.join(root, 'game');
  const backupDir = path.join(root, 'backups');
  fs.mkdirSync(path.join(game, 'dota'), { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(game, 'dota', 'gameinfo.gi'), GAMEINFO);
  fs.writeFileSync(path.join(game, 'dota', 'gameinfo_branchspecific.gi'), Buffer.from(BRANCH, 'latin1'));
  const sig = patcher.paths(game).signatures;
  if (withList) {
    fs.mkdirSync(path.dirname(sig), { recursive: true });
    fs.writeFileSync(sig, Buffer.from(SIGNATURES, 'latin1'));
  }
  return { game, backupDir, sig };
}

const branchOf = (game) => fs.readFileSync(patcher.paths(game).branch, 'latin1');

test('an install that ships no signature list is still patched', (t) => {
  const { game, backupDir, sig } = tree(t, false);
  assert.equal(fs.existsSync(sig), false, 'the tree really has no list');

  const st = patcher.apply({ gamePath: game, folder: FOLDER, backupDir });

  assert.ok(branchOf(game).includes(MARKER), 'the branch file carries the patch');
  assert.ok(branchOf(game).includes(FOLDER), 'and names the mod folder');
  assert.equal(st.patched, true);
  assert.equal(fs.existsSync(path.join(game, FOLDER)), true, 'the folder the patch registers exists');
  assert.equal(fs.existsSync(sig), false, 'and no list was invented for it');
});

test('an install with no list reports that, rather than reporting an unsigned patch', (t) => {
  // Both consumers of this - the status bar dot and schemaService.heal - treat "patched but
  // not signed" as something wrong. On Linux that would be permanent, and re-patching on every
  // check would be the app fighting itself.
  const { game, backupDir } = tree(t, false);
  patcher.apply({ gamePath: game, folder: FOLDER, backupDir });

  const st = patcher.state(game, FOLDER);
  assert.equal(st.signable, false, 'there is nothing here to sign into');
  assert.equal(st.signed, false, 'so nothing was signed');
  assert.equal(st.patched, true, 'and the patch is on, which is the finished state here');
});

test('an install with a list gets the patch signed into it', (t) => {
  const { game, backupDir, sig } = tree(t, true);

  const st = patcher.apply({ gamePath: game, folder: FOLDER, backupDir });

  assert.equal(st.signable, true);
  assert.equal(st.signed, true, 'the patched branch file is accounted for in the list');
  const text = fs.readFileSync(sig, 'latin1');
  assert.ok(text.includes('gameinfo_branchspecific.gi~SHA1:'), 'our line is in the list');
  assert.ok(text.includes('DIGEST:'), "and Valve's own lines are still there");
});

test('reverting puts both files back exactly as they were', (t) => {
  for (const withList of [true, false]) {
    const { game, backupDir, sig } = tree(t, withList);
    const branchBefore = fs.readFileSync(patcher.paths(game).branch);
    const sigBefore = withList ? fs.readFileSync(sig) : null;

    patcher.apply({ gamePath: game, folder: FOLDER, backupDir });
    const st = patcher.revert({ gamePath: game, folder: FOLDER, backupDir });

    assert.deepEqual(fs.readFileSync(patcher.paths(game).branch), branchBefore,
      `the branch file came back byte for byte (list: ${withList})`);
    if (withList) assert.deepEqual(fs.readFileSync(sig), sigBefore, 'and so did the list');
    assert.equal(st.patched, false);
  }
});

test('applying twice does not stack, with a list or without one', (t) => {
  for (const withList of [true, false]) {
    const { game, backupDir } = tree(t, withList);
    patcher.apply({ gamePath: game, folder: FOLDER, backupDir });
    const once = branchOf(game);
    patcher.apply({ gamePath: game, folder: FOLDER, backupDir });

    assert.equal(branchOf(game), once, `the second patch changed nothing (list: ${withList})`);
    // twice by design: the folder is registered on a Game line and on a Mod line, and each
    // carries the marker. The count is pinned so a third registration is a deliberate change.
    const marks = once.split(MARKER).length - 1;
    assert.equal(marks, 2, `the marker appears twice, not ${marks} times`);
  }
});

test('a tree with no gameinfo at all is still refused, and says which file', (t) => {
  const { game, backupDir } = tree(t, true);
  fs.rmSync(path.join(game, 'dota', 'gameinfo.gi'));

  assert.throws(
    () => patcher.apply({ gamePath: game, folder: FOLDER, backupDir }),
    /gameinfo\.gi/,
    'the file it cannot do without is named in the error',
  );
});
