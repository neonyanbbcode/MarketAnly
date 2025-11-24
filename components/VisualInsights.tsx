import React, { useEffect, useState } from 'react';
import { VisualizationData } from '../types';

interface VisualInsightsProps {
  data: VisualizationData;
}

const VisualInsights: React.FC<VisualInsightsProps> = ({ data }) => {
  const [animatedSentiment, setAnimatedSentiment] = useState(0);

  useEffect(() => {
    // Simple animation for the sentiment needle
    const timeout = setTimeout(() => {
      setAnimatedSentiment(data.sentimentScore);
    }, 100);
    return () => clearTimeout(timeout);
  }, [data.sentimentScore]);

  // Calculate needle rotation: 0 = -90deg, 100 = 90deg
  const rotation = (animatedSentiment / 100) * 180 - 90;

  // Color logic for sentiment
  const getSentimentColor = (score: number) => {
    if (score < 25) return '#ef4444'; // Red (Fear)
    if (score < 45) return '#f97316'; // Orange
    if (score < 55) return '#eab308'; // Yellow (Neutral)
    if (score < 75) return '#84cc16'; // Lime
    return '#22c55e'; // Green (Greed)
  };

  const sentimentColor = getSentimentColor(data.sentimentScore);

  return (
    <div className="w-full flex flex-col gap-4 p-4">
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 pb-2">市场可视化仪表盘</h3>
      
      {/* 1. Market Sentiment Gauge */}
      <div className="bg-slate-800/50 rounded-lg p-4 flex flex-col items-center relative overflow-hidden group border border-slate-700/50">
        <h4 className="text-xs text-slate-500 mb-2 font-medium">市场情绪</h4>
        <div className="relative w-40 h-20 mt-1">
          {/* Gauge Background */}
          <svg viewBox="0 0 200 100" className="w-full h-full">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#334155" strokeWidth="20" strokeLinecap="round" />
            <path d="M 20 100 A 80 80 0 0 1 60 45" fill="none" stroke="#ef4444" strokeWidth="5" opacity="0.5" />
            <path d="M 140 45 A 80 80 0 0 1 180 100" fill="none" stroke="#22c55e" strokeWidth="5" opacity="0.5" />
          </svg>
          
          {/* Needle */}
          <div 
            className="absolute bottom-0 left-1/2 w-1 h-16 bg-white origin-bottom transition-transform duration-1000 ease-out"
            style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
          >
            <div className="w-2 h-2 bg-white rounded-full absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 shadow-lg shadow-white/50"></div>
          </div>
        </div>
        <div className="mt-2 text-xl font-bold flex items-baseline gap-2" style={{ color: sentimentColor }}>
          {Math.round(animatedSentiment)}
          <span className="text-xs text-slate-400 font-normal">
            {data.sentimentScore < 40 ? '恐慌' : data.sentimentScore > 60 ? '贪婪' : '中性'}
          </span>
        </div>
      </div>

      {/* 2. Volatility Wave */}
      <div className="bg-slate-800/50 rounded-lg p-4 flex flex-col items-center relative overflow-hidden border border-slate-700/50">
        <div className="flex justify-between w-full mb-1">
            <h4 className="text-xs text-slate-500 font-medium">波动率脉搏</h4>
            <span className={`text-sm font-bold ${data.volatilityIndex > 50 ? 'text-rose-400' : 'text-blue-400'}`}>{data.volatilityIndex}</span>
        </div>
        <div className="w-full flex items-center justify-center h-16 relative">
            <svg viewBox="0 0 200 60" className="w-full h-full overflow-visible">
              <path 
                d="M 0 30 Q 50 10 100 30 T 200 30" 
                fill="none" 
                stroke={data.volatilityIndex > 50 ? "#f43f5e" : "#3b82f6"} 
                strokeWidth="3"
                className="animate-pulse"
              >
                <animate 
                  attributeName="d" 
                  values="M 0 30 Q 50 10 100 30 T 200 30; M 0 30 Q 50 50 100 30 T 200 30; M 0 30 Q 50 10 100 30 T 200 30" 
                  dur={`${2 - (data.volatilityIndex/100)}s`} 
                  repeatCount="indefinite" 
                />
              </path>
            </svg>
        </div>
      </div>

      {/* 3. Market Phase Indicator */}
      <div className="bg-slate-800/50 rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden border border-slate-700/50">
          <div className="flex justify-between items-center z-10 border-b border-slate-700/50 pb-2">
              <h4 className="text-xs text-slate-500">当前阶段</h4>
              <div className="text-sm font-bold text-white tracking-tight bg-slate-700 px-2 py-0.5 rounded">
                  {data.marketPhase}
              </div>
          </div>
          <div className="z-10 flex justify-between px-2">
              {data.keySectors.map((sector, idx) => (
                  <div key={idx} className="flex flex-col items-center group cursor-help" title={`${sector.name}: ${sector.trend === 'up' ? '上涨' : sector.trend === 'down' ? '下跌' : '震荡'}`}>
                      <div 
                        className={`w-2 h-10 rounded-full relative overflow-hidden transition-all ${
                          sector.trend === 'up' ? 'bg-emerald-500/20' : sector.trend === 'down' ? 'bg-rose-500/20' : 'bg-slate-500/20'
                        }`}
                      >
                          <div 
                              className={`absolute bottom-0 w-full transition-all duration-1000 ${
                                  sector.trend === 'up' ? 'bg-emerald-500' : sector.trend === 'down' ? 'bg-rose-500' : 'bg-slate-500'
                              }`}
                              style={{ height: `${Math.abs(sector.value)}%` }}
                          />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 scale-90">{sector.name}</span>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

export default VisualInsights;