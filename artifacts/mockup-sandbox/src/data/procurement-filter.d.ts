export interface ProcurementSearchRecord {
  number: string;
  year: number;
  modality: string;
  nature: string;
  entity: string;
  objectSummary: string;
  status: string;
}

export function filterProcurementRecords<T extends ProcurementSearchRecord>(
  records: T[],
  filters?: { query?: string; status?: string },
): T[];
