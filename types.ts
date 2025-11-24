export interface SectorData {
  name: string;
  trend: 'up' | 'down' | 'neutral';
  value: number; // -100 to 100 representing sentiment
}

export interface VisualizationData {
  sentimentScore: number; // 0 (Extreme Fear) to 100 (Extreme Greed)
  volatilityIndex: number; // 0 (Calm) to 100 (Chaotic)
  marketPhase: string; // e.g., "Accumulation", "Markup", "Distribution", "Markdown"
  keySectors: SectorData[];
}

export interface AnalysisResponse {
  markdownReport: string;
  visualizationData: VisualizationData | null;
  groundingLinks?: Array<{ title: string; url: string }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
