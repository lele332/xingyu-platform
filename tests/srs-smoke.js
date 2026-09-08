const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const code = fs.readFileSync(path.join(__dirname, "..", "js", "srs.js"), "utf8");
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code + "\n;globalThis.SRS = SRS;", sandbox);
const SRS = sandbox.SRS;

const now = Date.now();
const card = { id: "card-1", question: "Q", answer: "A", subject: "数学", createdAt: new Date(now).toISOString() };

assert.ok(SRS.isDue(card), "new card should be due");
assert.equal(SRS.dueCards([card]).length, 1, "new card should appear in due queue");

const good = SRS.review(card, "good", now);
assert.equal(good.state, "review");
assert.equal(good.reps, 1);
assert.ok(new Date(good.due).getTime() > now, "good review should schedule future");

const future = new Date(now + 2 * 86400000).toISOString();
const reviewed = { ...card, srs: { ...good, due: future } };
assert.equal(SRS.dueCards([reviewed], now).length, 0, "future card should not be due");

const again = SRS.review(reviewed, "again", now);
assert.equal(again.lapses, 1);
assert.ok(new Date(again.due).getTime() <= now + 15 * 60 * 1000, "again review should return shortly");

const early = new Date(now + 9 * 60 * 1000).toISOString();
assert.equal(SRS.dueCards([{ ...card, srs: again }], new Date(early).getTime()).length, 0, "again card is not due before 10m");

console.log("SRS smoke test OK");
