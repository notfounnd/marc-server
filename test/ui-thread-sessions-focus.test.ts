import assert from "node:assert/strict";
import test from "node:test";
import { keepFocusAfterGoTo } from "../src/ui/app-reference-actions.js";

type FocusRow = {
  name: string;
  navigating: boolean;
  prevented: boolean;
  flagAfter: boolean;
};

const rows: FocusRow[] = [
  {
    name: "a go-to close suppresses the trigger focus return once",
    navigating: true,
    prevented: true,
    flagAfter: false
  },
  {
    name: "an Escape or outside close keeps the trigger focus return",
    navigating: false,
    prevented: false,
    flagAfter: false
  }
];

for (const row of rows) {
  test(`sessions menu close focus: ${row.name}`, () => {
    const navigating = { current: row.navigating };
    const calls: string[] = [];
    const event = {
      preventDefault: () => calls.push("prevented")
    } as unknown as Event;
    keepFocusAfterGoTo(navigating)(event);
    assert.equal(calls.includes("prevented"), row.prevented);
    assert.equal(navigating.current, row.flagAfter);
  });
}

test("the go-to flag is consumed, so the next close returns focus normally", () => {
  const navigating = { current: true };
  const calls: string[] = [];
  const event = {
    preventDefault: () => calls.push("prevented")
  } as unknown as Event;
  const handler = keepFocusAfterGoTo(navigating);
  handler(event);
  handler(event);
  assert.deepEqual(calls, ["prevented"]);
});
