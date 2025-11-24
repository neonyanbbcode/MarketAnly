import { VisualizationData } from './types';

export const GEMINI_MODEL = 'gemini-2.5-flash';

export const INITIAL_VISUALIZATION_DATA: VisualizationData = {
  sentimentScore: 50,
  volatilityIndex: 30,
  marketPhase: '等待数据',
  keySectors: [
    { name: '科技', trend: 'neutral', value: 0 },
    { name: '金融', trend: 'neutral', value: 0 },
    { name: '能源', trend: 'neutral', value: 0 },
    { name: '医疗', trend: 'neutral', value: 0 },
  ],
};