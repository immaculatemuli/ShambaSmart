export interface User {
  id: number;
  name: string;
  phone: string;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Crop {
  key: string;
  name: string;
  days: number;
  spacing: string;
  seasons: number[];
  irrigated: boolean;
  in_season: boolean;
  nursery: boolean;
}

export interface County {
  name: string;
  latitude: number;
  longitude: number;
}

export interface Market {
  id: number;
  name: string;
  county: string;
}

export interface Catalog {
  crops: Crop[];
  counties: County[];
  markets: Market[];
  expense_categories: string[];
  task_kinds: string[];
}

export interface Plot {
  id: number;
  name: string;
  crop: string;
  crop_name: string;
  variety: string | null;
  size_acres: number | null;
  planted_on: string;
  status: 'growing' | 'harvested';
  notes: string | null;
  age_days: number;
  season_days: number | null;
  progress: number | null;
  expected_harvest_on: string | null;
  open_tasks?: number;
  next_task_on?: string | null;
}

export interface Task {
  id: number;
  plot_id: number | null;
  plot_name: string | null;
  plot_crop: string | null;
  kind: string;
  title: string;
  details: string | null;
  due_on: string;
  done_at: string | null;
  source: 'calendar' | 'manual';
}

export interface ForecastDay {
  date: string;
  code: number;
  temp_max: number;
  temp_min: number;
  rain_mm: number;
  rain_chance: number | null;
  wind_kmh: number;
}

export interface Alert {
  id: string;
  level: 'warning' | 'good' | 'info';
  icon: string;
  title: string;
  message: string;
}

export interface Weather {
  /** Which free service gave the forecast. */
  source: 'open-meteo' | 'met-norway';
  latitude: number;
  longitude: number;
  current: { temperature: number; code: number } | null;
  days: ForecastDay[];
  alerts: Alert[];
}

export interface MoneySummary {
  spent: number;
  earned: number;
  profit: number;
  by_category: { category: string; amount: number }[];
  by_plot: { plot_id: number; name: string; crop: string; status: string; spent: number; earned: number; profit: number }[];
}

export interface Expense {
  id: number;
  plot_id: number | null;
  plot_name: string | null;
  category: string;
  amount: number;
  spent_on: string;
  note: string | null;
}

export interface Harvest {
  id: number;
  plot_id: number | null;
  plot_name: string | null;
  crop: string;
  quantity: number;
  unit: string;
  income: number;
  harvested_on: string;
  note: string | null;
}

export interface DiagnosisResult {
  is_plant: boolean;
  crop: string;
  healthy: boolean;
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  problems: { name: string; type: string; likelihood: string; signs: string }[];
  actions: string[];
  prevention: string[];
  see_expert: boolean;
  photo_tip: string;
}

export interface Diagnosis {
  id: number;
  plot_id: number | null;
  plot_name?: string | null;
  crop: string | null;
  created_at: string;
  result: DiagnosisResult;
}

export interface MarketPrice {
  market_id: number;
  market: string;
  county: string;
  price_per_kg: number;
  source: 'sample' | 'farmer';
  reports: number;
  updated_on: string;
}

export interface CropPrices {
  crop: string;
  prices: MarketPrice[];
  median_per_kg: number | null;
  trend: { week_ending: string; median_per_kg: number | null; reports: number }[];
}
