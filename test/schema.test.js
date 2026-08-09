// items_game.txt: the one file the app rewrites that the client parses itself. A malformed
// result does not degrade, it kills the game on load with ERROR PARSING SCRIPT, and a merge
// that drops blocks silently removes cosmetics people paid for. So the merge is pinned on
// both counts: what it splices in, and what it refuses to ship.
const test = require('node:test');
const assert = require('node:assert/strict');

const schema = require('../src/schema.js');

const item = (id, name, extra = '') => `		"${id}"
		{
			"name"		"${name}"
			"prefab"		"default_item"
${extra}		}
`;

/** A small but structurally real items_game.txt. */
const small = (ids = [['1', 'One'], ['2', 'Two'], ['3', 'Three']]) => `"items_game"
{
	"items"
	{
${ids.map(([id, name]) => item(id, name)).join('')}	}
}
`;

/** Big enough to clear validateSchema's "did we just lose the whole table" floor. */
function large(count = 1200, mark = 'Item') {
  const ids = Array.from({ length: count }, (_, i) => [String(i + 1), `${mark} ${i + 1}`]);
  return small(ids);
}

test('every item in the table is listed', () => {
  assert.equal(schema.listItems(small()).length, 3);
  assert.equal(schema.listItems(large(1200)).length, 1200);
});

test('an item is found by id, and a missing one reports missing rather than throwing', () => {
  const text = small();
  const hit = schema.findItem(text, '2');
  assert.ok(hit, 'id 2 exists');
  assert.ok(text.slice(hit.start, hit.end).includes('"Two"'));
  assert.equal(schema.findItem(text, '9999'), null);
});

test('a block replaces the item with that id and leaves its neighbours untouched', () => {
  const base = small();
  const replacement = `"2"
{
	"name"		"Replaced"
	"prefab"		"default_item"
}`;

  const out = schema.mergeSchema(base, [{ id: '2', block: replacement, source: 'mod A' }]);

  assert.deepEqual(out.applied, [{ id: '2', source: 'mod A' }]);
  assert.deepEqual(out.missing, []);
  assert.deepEqual(out.conflicts, []);
  assert.ok(out.text.includes('"Replaced"'));
  assert.equal(out.text.includes('"Two"'), false, 'the old block is gone');
  assert.ok(out.text.includes('"One"') && out.text.includes('"Three"'), 'neighbours survive');
  assert.equal(schema.listItems(out.text).length, 3, 'no item is lost or duplicated');
});

test('several blocks all land, not just the last one', () => {
  // The merge splices from the tail so earlier offsets stay valid; doing it head-first would
  // corrupt every edit after the first.
  const base = small();
  const block = (id, name) => `"${id}"\n{\n\t"name"\t\t"${name}"\n}`;

  const out = schema.mergeSchema(base, [
    { id: '1', block: block('1', 'First'), source: 'a' },
    { id: '3', block: block('3', 'Third'), source: 'b' },
  ]);

  assert.equal(out.applied.length, 2);
  assert.ok(out.text.includes('"First"'));
  assert.ok(out.text.includes('"Third"'));
  assert.ok(out.text.includes('"Two"'), 'the untouched item is still there');
  assert.equal(schema.listItems(out.text).length, 3);
});

test('a block for an item the game does not have is reported, not invented', () => {
  const out = schema.mergeSchema(small(), [{ id: '4242', block: '"4242"\n{\n}', source: 'mod' }]);
  assert.deepEqual(out.missing, ['4242']);
  assert.deepEqual(out.applied, []);
  assert.equal(schema.listItems(out.text).length, 3);
});

test('the same block shipped by two mods is not a conflict', () => {
  // Skinchanger bakes the whole cart into every export, so identical copies are the norm and
  // treating them as conflicts would warn on nearly every pair of imported mods.
  const block = '"2"\n{\n\t"name"\t\t"Shared"\n}';
  const out = schema.mergeSchema(small(), [
    { id: '2', block, source: 'mod A' },
    { id: '2', block: block.replace(/\n\t/g, '\n \t '), source: 'mod B' },
  ]);

  assert.deepEqual(out.conflicts, [], 'whitespace-only differences are the same block');
  assert.equal(out.applied.length, 1);
});

test('two mods changing one item differently is reported as a conflict', () => {
  const out = schema.mergeSchema(small(), [
    { id: '2', block: '"2"\n{\n\t"name"\t\t"From A"\n}', source: 'mod A' },
    { id: '2', block: '"2"\n{\n\t"name"\t\t"From B"\n}', source: 'mod B' },
  ]);

  assert.equal(out.conflicts.length, 1);
  assert.deepEqual(out.conflicts[0], { id: '2', a: 'mod A', b: 'mod B' });
  assert.ok(out.text.includes('"From B"'), 'the later patch wins');
});

test('merging nothing changes nothing', () => {
  const base = small();
  const out = schema.mergeSchema(base, []);
  assert.equal(out.text, base);
});

test('a well-formed table of the right size passes validation', () => {
  const text = large(1200);
  const got = schema.validateSchema(text);
  assert.equal(got.items, 1200);
  assert.equal(got.bytes, text.length);
});

test('an unbalanced block is refused instead of shipped', () => {
  assert.throws(() => schema.validateSchema(`${large(1200)}{`));
  assert.throws(() => schema.validateSchema(large(1200).replace('}\n', '')));
  assert.throws(() => schema.validateSchema(`}${large(1200)}`));
});

test('an unclosed quote is refused', () => {
  assert.throws(() => schema.validateSchema(`${large(1200)}"oops`));
});

test('a table that lost most of its items is refused', () => {
  // The failure this guards against: a merge that empties the table produces a file the game
  // loads happily, with every cosmetic gone.
  assert.throws(() => schema.validateSchema(small()));
});

test('a table smaller than the game shipped is refused even when it is large', () => {
  const base = large(1300);
  const shrunk = large(1200);
  assert.doesNotThrow(() => schema.validateSchema(shrunk), 'fine on its own');
  assert.throws(() => schema.validateSchema(shrunk, base), 'not fine against the game');
});

test('merging into a real-sized table keeps it valid', () => {
  const base = large(1200);
  const out = schema.mergeSchema(base, [
    { id: '500', block: '"500"\n{\n\t"name"\t\t"Patched"\n}', source: 'mod' },
  ]);

  assert.equal(out.applied.length, 1);
  assert.doesNotThrow(() => schema.validateSchema(out.text, base));
});
