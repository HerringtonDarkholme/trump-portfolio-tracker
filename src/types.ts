export type Transaction = {
  n: number;
  date: string;
  type: "purchase" | "sale";
  amount: string;
  mid: number;
  low: number;
  high: number;
  rawDescription: string;
};

export type Stock = {
  ticker: string;
  name: string;
  sector: string;
  totalBuy: number;
  totalSell: number;
  net: number;
  txCount: number;
  firstDate: string;
  lastDate: string;
  transactions: Transaction[];
  resolution?: "exact" | "fuzzy";
};

export type Sector = {
  sector: string;
  totalVolume: number;
  netFlow: number;
  tickers: string[];
};

export type Dataset = {
  generatedAt: string;
  totals: {
    txCount: number;
    buyCount: number;
    sellCount: number;
    totalVolume: number;
    netFlow: number;
    uniqueTickers: number;
    unresolvedCount: number;
  };
  stocks: Record<string, Stock>;
  sectors: Record<string, Sector>;
  unresolved: string[];
};
