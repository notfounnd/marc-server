import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAutocompleteOption,
  buildAutocompleteOptions,
  detectAutocompleteRequest,
  getAutocompleteRemoteThreadId
} from "../src/ui/composer-autocomplete.js";

const agents = [{ id: "codex-dev" }, { id: "ui-user" }];
const threads = [
  {
    id: "oportunidade-autocomplete-de-referencias-no-composer-2341bc9f",
    title: "Oportunidade - Autocomplete",
    status: "open" as const
  },
  {
    id: "oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4",
    title: "Oportunidade - Referencias internas",
    status: "closed" as const,
    closedAt: "2026-05-06T05:01:27.248Z"
  }
];
const currentMessages = [
  {
    id: "msg_3333ea5fc93f4dc095",
    agentId: "codex-dev",
    body: "Autocomplete proposal",
    artifacts: ["artifacts/oportunidade-autocomplete-referencias-composer.md"]
  },
  {
    id: "msg_90752d09f93b44e6a2",
    agentId: "ui-user",
    body: "Preparation thread reference",
    artifacts: []
  }
];

test("detects explicit autocomplete triggers before the cursor", () => {
  assert.deepEqual(detectAutocompleteRequest("Ask @cod", 8), {
    end: 8,
    kind: "agent",
    query: "cod",
    start: 4,
    token: "@cod"
  });
  assert.deepEqual(detectAutocompleteRequest("See #msg", 8), {
    end: 8,
    kind: "message",
    query: "msg",
    start: 4,
    token: "#msg"
  });
  assert.deepEqual(detectAutocompleteRequest("Open $oport", 11), {
    end: 11,
    kind: "thread",
    query: "oport",
    start: 5,
    token: "$oport"
  });
  assert.equal(detectAutocompleteRequest("# Heading", 2), undefined);
});

test("suggests agents, workspace threads, current messages, and current artifacts", () => {
  const agentRequest = detectAutocompleteRequest("@codex", 6);
  assert(agentRequest);
  assert.deepEqual(
    buildAutocompleteOptions(agentRequest, {
      agents,
      threads,
      currentMessages
    }).map((option) => option.value),
    ["marc://@codex-dev"]
  );

  const threadRequest = detectAutocompleteRequest("$referencias", 12);
  assert(threadRequest);
  const threadOptions = buildAutocompleteOptions(threadRequest, {
    agents,
    threads,
    currentMessages
  });
  assert.deepEqual(
    threadOptions.map((option) => option.value),
    [
      "marc://$oportunidade-autocomplete-de-referencias-no-composer-2341bc9f",
      "marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4"
    ]
  );
  assert.deepEqual(
    threadOptions.map((option) => ({
      detail: option.detail,
      closed: Boolean(option.closed)
    })),
    [
      { detail: "Open thread", closed: false },
      { detail: "Closed thread", closed: true }
    ]
  );

  const messageRequest = detectAutocompleteRequest("#autocomplete", 13);
  assert(messageRequest);
  const messageOptions = buildAutocompleteOptions(messageRequest, {
    agents,
    threads,
    currentMessages
  });
  assert.deepEqual(
    messageOptions.map((option) => option.value),
    [
      "marc://#msg_3333ea5fc93f4dc095",
      "marc://#msg_3333ea5fc93f4dc095/!oportunidade-autocomplete-referencias-composer.md"
    ]
  );
  assert.equal(messageOptions[1].parentMessageId, "msg_3333ea5fc93f4dc095");
});

test("suggests cross-thread messages and artifacts only from an explicit thread reference", () => {
  const request = detectAutocompleteRequest(
    "Use marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4/#msg",
    80
  );
  assert(request);
  assert.equal(
    getAutocompleteRemoteThreadId(request),
    "oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4"
  );

  assert.deepEqual(
    buildAutocompleteOptions(request, {
      agents,
      threads,
      currentMessages,
      remoteMessages: [
        {
          id: "msg_abcd",
          agentId: "qa-agent",
          body: "Remote evidence",
          artifacts: ["artifacts/evidence.md"]
        }
      ]
    }).map((option) => option.value),
    [
      "marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4/#msg_abcd",
      "marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4/#msg_abcd/!evidence.md"
    ]
  );
});

test("replaces only the active token with the selected canonical reference", () => {
  const request = detectAutocompleteRequest("Ask @cod to review", 8);
  assert(request);
  assert.deepEqual(
    applyAutocompleteOption("Ask @cod to review", request, "marc://@codex-dev"),
    {
      cursor: 21,
      value: "Ask marc://@codex-dev to review"
    }
  );
});
