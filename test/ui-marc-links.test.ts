import assert from "node:assert/strict";
import test from "node:test";
import {
  linkifyMarcReferences,
  marcReferenceLabel,
  transformMarkdownUrl
} from "../src/ui/marc-links.js";

test("renders canonical short labels for mARC references", () => {
  assert.equal(marcReferenceLabel("marc://@codex-dev"), "@codex-dev");
  assert.equal(
    marcReferenceLabel("marc://#msg_3937368093ec46fead"),
    "#msg_3937368093ec46fead"
  );
  assert.equal(
    marcReferenceLabel(
      "marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4"
    ),
    "$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4"
  );
  assert.equal(
    marcReferenceLabel(
      "marc://#msg_d8d44b0250e842ffa2/!complemento-artifacts-referencias.md"
    ),
    "!complemento-artifacts-referencias.md"
  );
  assert.equal(
    marcReferenceLabel(
      "marc://$oportunidade-autocomplete-de-referencias-no-composer-2341bc9f/#msg_3333ea5fc93f4dc095"
    ),
    "#msg_3333ea5fc93f4dc095"
  );
  assert.equal(
    marcReferenceLabel(
      "marc://$oportunidade-autocomplete-de-referencias-no-composer-2341bc9f/#msg_3333ea5fc93f4dc095/!oportunidade-autocomplete-referencias-composer.md"
    ),
    "!oportunidade-autocomplete-referencias-composer.md"
  );
});

test("linkifies plain mARC references with canonical labels", () => {
  assert.equal(
    linkifyMarcReferences("Ask marc://@codex-dev to inspect marc://#msg_123."),
    "Ask [@codex-dev](marc://@codex-dev) to inspect [#msg_123](marc://#msg_123)."
  );
  assert.equal(
    linkifyMarcReferences("Open marc://#msg_123/!notes.md"),
    "Open [!notes.md](marc://#msg_123/!notes.md)"
  );
});

test("does not linkify mARC references inside inline code, fenced code, or markdown destinations", () => {
  assert.equal(
    linkifyMarcReferences("Use `marc://@codex-dev` literally."),
    "Use `marc://@codex-dev` literally."
  );
  assert.equal(
    linkifyMarcReferences("```txt\nmarc://@codex-dev\n```\nmarc://@qa-dev"),
    "```txt\nmarc://@codex-dev\n```\n[@qa-dev](marc://@qa-dev)"
  );
  assert.equal(
    linkifyMarcReferences("[custom](marc://@codex-dev)"),
    "[custom](marc://@codex-dev)"
  );
});

test("preserves mARC URLs while keeping the markdown default transform for other URLs", () => {
  assert.equal(transformMarkdownUrl("marc://@codex-dev"), "marc://@codex-dev");
  assert.equal(transformMarkdownUrl("javascript:alert(1)"), "");
  assert.equal(
    transformMarkdownUrl("https://example.com"),
    "https://example.com"
  );
});
