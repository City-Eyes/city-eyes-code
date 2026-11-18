import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const fixturePath = new URL("../src/data/procurement-demo.json", import.meta.url);
const dataset = JSON.parse(await readFile(fixturePath, "utf8"));
const expectedRecordFields = [
  "id",
  "modality",
  "nature",
  "status",
  "number",
  "year",
  "openingAt",
  "entity",
  "objectSummary",
  "estimatedValueCents",
  "awardedValueCents",
].sort();

test("identifies the dataset as synthetic and without an official cutoff", () => {
  assert.equal(dataset.datasetType, "synthetic_demo");
  assert.equal(dataset.sourceStatus, "not_official");
  assert.equal(dataset.dataAsOf, null);
  assert.match(dataset.sourceDescription, /nenhuma linha|nenhuma exportação/i);
});

test("uses unique demo-only identifiers and the approved visible fields", () => {
  assert.ok(dataset.records.length > 0);
  const ids = dataset.records.map((record) => record.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const record of dataset.records) {
    assert.deepEqual(Object.keys(record).sort(), expectedRecordFields);
    assert.match(record.id, /^DEMO-\d{3}$/);
    assert.equal(record.number, record.id);
  }
});

test("contains valid dates, non-negative integer amounts, and no personal fields", () => {
  const serialized = JSON.stringify(dataset.records);

  for (const record of dataset.records) {
    assert.ok(Number.isFinite(Date.parse(record.openingAt)));
    assert.ok(Number.isInteger(record.year));
    assert.ok(Number.isInteger(record.estimatedValueCents));
    assert.ok(record.estimatedValueCents >= 0);

    if (record.awardedValueCents !== null) {
      assert.ok(Number.isInteger(record.awardedValueCents));
      assert.ok(record.awardedValueCents >= 0);
    }
  }

  assert.doesNotMatch(serialized, /cpf|e-mail|telefone|email|phone/i);
});
