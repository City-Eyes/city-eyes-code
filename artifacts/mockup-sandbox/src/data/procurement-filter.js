export function filterProcurementRecords(records, { query = "", status = "all" } = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

  return records.filter((record) => {
    const matchesStatus = status === "all" || record.status === status;
    const searchableText = [
      record.number,
      record.year,
      record.modality,
      record.nature,
      record.entity,
      record.objectSummary,
    ]
      .join(" ")
      .toLocaleLowerCase("pt-BR");

    return matchesStatus && searchableText.includes(normalizedQuery);
  });
}
