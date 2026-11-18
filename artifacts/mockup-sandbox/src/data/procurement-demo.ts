import rawDataset from "./procurement-demo.json";

export interface ProcurementDemoRecord {
  id: string;
  modality: string;
  nature: string;
  status: string;
  number: string;
  year: number;
  openingAt: string;
  entity: string;
  objectSummary: string;
  estimatedValueCents: number;
  awardedValueCents: number | null;
}

export interface ProcurementDemoDataset {
  datasetType: string;
  sourceStatus: string;
  sourceDescription: string;
  dataAsOf: null;
  records: ProcurementDemoRecord[];
}

export const procurementDemo =
  rawDataset satisfies ProcurementDemoDataset;
