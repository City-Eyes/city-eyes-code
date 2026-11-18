import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { filterProcurementRecords } from "../src/data/procurement-filter.js";

const fixturePath = new URL("../src/data/procurement-demo.json", import.meta.url);
const dataset = JSON.parse(await readFile(fixturePath, "utf8"));
const componentPath = new URL(
  "../src/components/mockups/ProcurementDemo.tsx",
  import.meta.url,
);
const componentSource = await readFile(componentPath, "utf8");
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

test("text search returns only matching rows for numbers and object descriptions", () => {
  const byNumber = filterProcurementRecords(dataset.records, {
    query: " demo-003 ",
  });
  const byObject = filterProcurementRecords(dataset.records, {
    query: "sinalização",
  });

  assert.deepEqual(byNumber.map((record) => record.id), ["DEMO-003"]);
  assert.deepEqual(byObject.map((record) => record.id), ["DEMO-002"]);
});

test("status filter returns only rows with the selected status", () => {
  const results = filterProcurementRecords(dataset.records, {
    status: "Homologada",
  });

  assert.deepEqual(results.map((record) => record.id), ["DEMO-003"]);
  assert.ok(results.every((record) => record.status === "Homologada"));
});

test("combined search and status filters exclude unrelated rows", () => {
  const matching = filterProcurementRecords(dataset.records, {
    query: "sinalização",
    status: "Em análise",
  });
  const mismatched = filterProcurementRecords(dataset.records, {
    query: "sinalização",
    status: "Homologada",
  });

  assert.deepEqual(matching.map((record) => record.id), ["DEMO-002"]);
  assert.deepEqual(mismatched, []);
});

test("the component uses filtered records as the visible table rows", () => {
  assert.match(
    componentSource,
    /filterProcurementRecords\(procurementDemo\.records,\s*\{\s*query,\s*status\s*\}\)/,
  );
  assert.match(componentSource, /filteredRecords\.map\(\(record\) => \(/);
});

test("empty results render an accessible state labeled as fictional demo data", () => {
  assert.deepEqual(
    filterProcurementRecords(dataset.records, { query: "não existe" }),
    [],
  );
  assert.match(componentSource, /role="status"/);
  assert.match(
    componentSource,
    /aria-label="Estado vazio da demonstração fictícia"/,
  );
  assert.match(componentSource, /Nenhum exemplo fictício encontrado/);
  assert.match(
    componentSource,
    /Demonstração CITY EYES · dados 100% fictícios/,
  );
});
