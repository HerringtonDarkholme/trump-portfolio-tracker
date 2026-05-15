import datasetJson from "../data/dataset.json";
import type { Dataset } from "../types";

export const dataset = datasetJson as unknown as Dataset;
