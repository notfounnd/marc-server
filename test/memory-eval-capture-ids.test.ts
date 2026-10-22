import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  E2_CAPTURE_CHANNELS,
  fingerprintOf,
  type FingerprintComponents
} from "../scripts/memory-eval/capture-fingerprint.js";

type StoredCapture = {
  corpus: string;
  captureId: string;
  components: FingerprintComponents;
  fingerprint: string;
};

/** The fingerprint components stored in the E0 and E1 captures, committed as a fixture. */
const FIXTURE_URL = new URL(
  "./fixtures/memory-eval/capture-ids.json",
  import.meta.url
);

test("the captureIds of the E0 and E1 captures are recomputed from their stored components", async () => {
  const stored = JSON.parse(
    await fs.readFile(FIXTURE_URL, "utf8")
  ) as StoredCapture[];
  assert.deepEqual(
    stored.map((entry) => entry.captureId),
    ["7020a9de1965", "a3761dd19573", "8af296ddeca8", "4dad1e8eaea7"]
  );
  stored.forEach((entry) => {
    const recomputed = fingerprintOf(entry.components);
    assert.equal(recomputed.captureId, entry.captureId, entry.captureId);
    assert.equal(recomputed.fingerprint, entry.fingerprint, entry.captureId);
  });
});

test("captureChannels changes the id only when it is present", async () => {
  const [entry] = JSON.parse(
    await fs.readFile(FIXTURE_URL, "utf8")
  ) as StoredCapture[];
  const withoutChannels = fingerprintOf(entry.components);
  const withChannels = fingerprintOf({
    ...entry.components,
    captureChannels: E2_CAPTURE_CHANNELS
  });
  assert.equal(withoutChannels.captureId, entry.captureId);
  assert.notEqual(withChannels.captureId, entry.captureId);
  assert.equal(withChannels.captureChannels, E2_CAPTURE_CHANNELS);
});
