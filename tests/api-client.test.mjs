import test from "node:test";
import assert from "node:assert/strict";
import { request } from "../js/api.js";
test("successful catalog reads are cached without sharing mutable objects", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ results: [{ id: 42 }] }) };
  };
  try {
    const first = await request("/movie/424242");
    first.results[0].id = 0;
    const second = await request("/movie/424242");
    assert.equal(calls, 1);
    assert.equal(second.results[0].id, 42);
  } finally {
    globalThis.fetch = original;
  }
});
test("an aborted request cannot return cached results", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    request("/movie/424242", {}, { signal: controller.signal }),
    { name: "AbortError" },
  );
});
test("failed requests do not poison the catalog cache", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1
      ? { ok: false, json: async () => ({ error: "Temporary failure" }) }
      : { ok: true, json: async () => ({ results: [{ id: 7 }] }) };
  };
  try {
    await assert.rejects(request("/movie/424243"), /Temporary failure/);
    const success = await request("/movie/424243");
    assert.equal(success.results[0].id, 7);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
