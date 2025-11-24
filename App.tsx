import React, { useState, useCallback, useEffect, useRef } from 'react';
import VisualInsights from './components/VisualInsights';
import ChatInterface from './components/ChatInterface';
import { analyzeMarketImages } from './services/gemini';
import { AnalysisResponse, ChatMessage, VisualizationData } from './types';
import { INITIAL_VISUALIZATION_DATA } from './constants';
import { Remarkable } from 'remarkable';

const md = new Remarkable();

const App: React.FC = () => {
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [visualizationData, setVisualizationData] = useState<VisualizationData>(INITIAL_VISUALIZATION_DATA);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  
  // Email state
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (newFiles.length === 0) return;

    setImages(prev => [...prev, ...newFiles]);
    
    // Create previews
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Handle global paste event (Ctrl+V)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Check if clipboard has files and if they are images
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const imageFiles = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
        
        if (imageFiles.length > 0) {
           e.preventDefault(); // Prevent default browser handling (e.g., opening image in new tab)
           const dt = new DataTransfer();
           imageFiles.forEach(f => dt.items.add(f));
           handleFiles(dt.files);
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [handleFiles]);

  const handleUploadBtnClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  // Handle explicit paste button click
  const handlePasteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event from bubbling to file input

    // Check if API is available first
    if (!navigator.clipboard || !navigator.clipboard.read) {
        alert("当前环境不支持按钮读取剪贴板。\n请直接使用键盘快捷键 Ctrl+V (Mac系统为 Cmd+V) 进行粘贴。");
        return;
    }

    try {
      // @ts-ignore - NavigatorClipboard API type definition workaround
      const clipboardItems = await navigator.clipboard.read();
      const imageFiles: File[] = [];
      
      for (const item of clipboardItems) {
        // Some browsers support clipboardItem.types, others don't in the same way
        // We filter for image types
        const imageTypes = item.types.filter((type: string) => type.startsWith('image/'));
        for (const type of imageTypes) {
          const blob = await item.getType(type);
          const file = new File([blob], `pasted-image-${Date.now()}.png`, { type });
          imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
         const dt = new DataTransfer();
         imageFiles.forEach(f => dt.items.add(f));
         handleFiles(dt.files);
      } else {
        alert("剪贴板中没有图片。\n提示：请截图或复制图片后，在此页面直接按 Ctrl+V (Cmd+V) 粘贴。");
      }
    } catch (err: any) {
      console.warn("Clipboard read access denied or failed:", err);
      // Specific user-friendly error message for permission/policy blocks
      alert("浏览器安全策略限制了按钮访问剪贴板。\n\n解决方案：\n请直接按下键盘上的 Ctrl+V (Mac用户按 Cmd+V) 即可成功粘贴图片。");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const clearImages = () => {
    setImages([]);
    setImagePreviews([]);
    setAnalysisResult(null);
    setVisualizationData(INITIAL_VISUALIZATION_DATA);
    setMessages([]);
    setEmailStatus('idle');
  };

  const simulateEmailSend = (recipient: string) => {
    setEmailStatus('sending');
    setTimeout(() => {
        setEmailStatus('sent');
        // Reset status after a few seconds
        setTimeout(() => setEmailStatus('idle'), 5000);
    }, 2000);
  };

  const runAnalysis = async () => {
    if (images.length === 0) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    setEmailStatus('idle');
    
    try {
      const result = await analyzeMarketImages(images);
      setAnalysisResult(result);
      if (result.visualizationData) {
        setVisualizationData(result.visualizationData);
      }
      
      // Add initial analysis to chat
      setMessages(prev => [
        ...prev,
        {
          id: `analysis-${Date.now()}`,
          role: 'model',
          text: "我已识别图表内容，并结合最新的联网搜索信息完成了关联分析。请查看中间的详细报告。",
          timestamp: Date.now()
        }
      ]);

      // Handle Automatic Email Logic
      if (email && email.trim() !== '') {
        simulateEmailSend(email);
      }

    } catch (error) {
      console.error("Analysis failed", error);
      alert("分析失败。请检查您的 API Key 和网络连接。");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadReport = () => {
    if (!analysisResult?.markdownReport) return;
    const blob = new Blob([analysisResult.markdownReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market_insight_report_${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate Mailto Link for manual fallback
  const getMailtoLink = () => {
    if (!analysisResult?.markdownReport || !email) return '#';
    const subject = encodeURIComponent(`市场洞察 AI 分析报告 - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(analysisResult.markdownReport);
    return `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="h-screen bg-[#0f172a] text-slate-200 flex flex-col overflow-hidden overscroll-none">
      {/* Header */}
      <header className="flex-shrink-0 w-full z-50 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5 h-14">
        <div className="max-w-[1920px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20 text-xs">
              MI
            </div>
            <h1 className="font-bold text-lg tracking-tight text-white">市场洞察 AI (MarketInsight)</h1>
          </div>
          <div className="text-xs text-slate-400 hidden sm:block">
            Gemini 2.5 Flash 驱动
          </div>
        </div>
      </header>

      {/* Main Layout - 3 Column Dashboard 
          Mobile: overflow-y-auto (scrolls whole page)
          Desktop (lg): overflow-hidden (fixed page, inner scroll)
      */}
      <main className="flex-1 max-w-[1920px] mx-auto w-full flex flex-col overflow-y-auto lg:overflow-hidden p-4 lg:p-6">
        
        {/* Function Guide - Compact */}
        <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-xs text-slate-400 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">1</span>
                <span>左侧：上传今日图表（支持粘贴），查看实时情绪仪表盘。</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center">2</span>
                <span>中间：阅读 AI 生成的深度市场本质分析报告。</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">3</span>
                <span>右侧：与 AI 助教互动，深挖细节 (Cmd/Ctrl+Enter 发送)。</span>
            </div>
        </div>

        {/* Dynamic Grid Container 
            Mobile: min-h-0 not strictly needed as it flows, but helps.
            Desktop: flex-1 min-h-0 to constrain height to parent.
        */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          
          {/* LEFT COLUMN: Input & Visualization (3 cols) 
              Desktop: h-full with overflow-y-auto
          */}
          <div className="lg:col-span-3 flex flex-col gap-4 lg:h-full lg:overflow-y-auto pr-1 custom-scrollbar">
            
            {/* Visualization */}
            <div className="glass-panel rounded-xl border border-slate-700/50 shadow-lg flex-shrink-0">
               <VisualInsights data={visualizationData} />
            </div>

            {/* Upload Area */}
            <div 
              className={`flex-1 min-h-[200px] border-2 border-dashed rounded-xl p-4 transition-all duration-300 flex flex-col items-center gap-3 relative ${
                dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                multiple 
                accept="image/*" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
                onChange={handleUploadChange}
                title="点击选择图片，或将图片拖拽至此"
              />
              
              <div className="relative z-10 w-full flex flex-col h-full pointer-events-none">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">图表上传</h3>
                  
                  {imagePreviews.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                       <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-2">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                       </div>
                       <p className="text-sm text-slate-500 mb-4">点击或拖拽上传图片</p>
                       
                       {/* Paste Button (Pointer events auto to allow clicking) */}
                       <button
                         onClick={handlePasteClick}
                         className="pointer-events-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs text-slate-300 flex items-center gap-2 transition-all shadow-sm hover:text-white"
                       >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                          </svg>
                          从剪贴板粘贴 (Ctrl+V)
                       </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col gap-2">
                       <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[200px] custom-scrollbar">
                          {imagePreviews.map((src, idx) => (
                            <div key={idx} className="relative aspect-video rounded-md overflow-hidden border border-slate-600 bg-black/50 group">
                              <img src={src} alt="Preview" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ))}
                       </div>
                       
                       <div className="flex gap-2 mt-auto">
                           <button 
                              onClick={(e) => { e.preventDefault(); clearImages(); }}
                              className="pointer-events-auto px-3 py-2 text-xs text-red-400 hover:text-white hover:bg-red-500/20 rounded border border-red-500/30 flex items-center justify-center transition-colors"
                              title="清空所有"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                           
                           <button
                             onClick={handleUploadBtnClick}
                             className="pointer-events-auto flex-1 text-xs text-blue-300 hover:text-white hover:bg-blue-600/20 py-2 rounded border border-blue-500/30 flex items-center justify-center gap-1 transition-colors"
                           >
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                             </svg>
                             上传
                           </button>

                           <button
                             onClick={handlePasteClick}
                             className="pointer-events-auto flex-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 py-2 rounded border border-slate-600 flex items-center justify-center gap-1 transition-colors"
                           >
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                             </svg>
                             粘贴
                           </button>
                       </div>
                    </div>
                  )}

                  {!analyzing && imagePreviews.length > 0 && (
                    <div className="w-full space-y-3 mt-3 pointer-events-auto">
                        {/* Email Input */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-500">
                                    <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                                    <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                                </svg>
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="接收分析报告的邮箱..."
                                className="w-full bg-slate-900/50 border border-slate-700 text-xs text-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-blue-500 placeholder:text-slate-600 transition-colors"
                            />
                        </div>

                        <button 
                          onClick={runAnalysis}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-3 rounded-lg transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
                        >
                          {analysisResult ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                              </svg>
                              更新分析
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                              </svg>
                              开始分析
                            </>
                          )}
                        </button>
                    </div>
                  )}
                  {analyzing && (
                    <div className="w-full bg-slate-800 text-slate-400 text-sm py-3 rounded-lg flex items-center justify-center gap-2 cursor-wait mt-3 animate-pulse">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      识别图表 & 联网搜索中...
                    </div>
                  )}

                  {/* Email Status Indicator (Mock) */}
                  {emailStatus !== 'idle' && (
                    <div className={`mt-2 w-full text-xs text-center py-2 rounded border flex items-center justify-center gap-2 ${
                        emailStatus === 'sending' ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 
                        emailStatus === 'sent' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'text-slate-400'
                    }`}>
                        {emailStatus === 'sending' && (
                            <>
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                正在发送邮件到 {email}...
                            </>
                        )}
                        {emailStatus === 'sent' && (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                </svg>
                                邮件已发送! (模拟)
                            </>
                        )}
                    </div>
                  )}
                  
                  {/* Actual Mailto fallback link if email was provided */}
                  {emailStatus === 'sent' && analysisResult && (
                      <a href={getMailtoLink()} target="_blank" rel="noreferrer" className="text-[10px] text-slate-500 hover:text-blue-400 underline text-center block mt-1">
                          收不到? 点此调用本地邮件客户端发送
                      </a>
                  )}
              </div>
            </div>
          </div>

          {/* CENTER COLUMN: Analysis Report (6 cols) 
              Desktop: h-full
          */}
          <div className="lg:col-span-6 lg:h-full flex flex-col bg-slate-800/40 rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl relative min-h-[500px]">
             {/* Header */}
             <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
                <h3 className="font-semibold text-lg text-slate-100 flex items-center gap-2">
                    <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                    市场本质深度分析
                </h3>
                <button 
                    onClick={handleDownloadReport}
                    disabled={!analysisResult}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 hover:text-white text-slate-400 text-xs transition-colors ${!analysisResult ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 12.75l-3-3m0 0l-3 3m3-3v7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    导出报告
                </button>
             </div>

             {/* Content */}
             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-900/20">
                {analysisResult ? (
                   <>
                      <div className="prose prose-invert prose-lg max-w-none prose-p:leading-relaxed prose-headings:text-blue-100 prose-strong:text-blue-300 prose-li:text-slate-300">
                         <div dangerouslySetInnerHTML={{ __html: md.render(analysisResult.markdownReport) }} />
                      </div>
                      
                      {/* Grounding Links */}
                      {analysisResult.groundingLinks && analysisResult.groundingLinks.length > 0 && (
                        <div className="mt-12 pt-6 border-t border-slate-700/50">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">参考新闻来源</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {analysisResult.groundingLinks.map((link, i) => (
                              <a key={i} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-slate-400 hover:text-blue-400 transition-colors p-2 rounded bg-slate-800/50 hover:bg-slate-800 border border-transparent hover:border-slate-600 truncate">
                                <span className="flex-shrink-0 w-4 h-4 bg-slate-700 rounded-full flex items-center justify-center text-[10px]">{i+1}</span>
                                <span className="truncate">{link.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                   </>
                ) : (
                   <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center border border-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8 text-slate-600">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-lg font-medium text-slate-400">等待分析</p>
                        <p className="text-sm text-slate-600 max-w-xs mx-auto mt-2">请在左侧上传或粘贴市场图表，我将为您生成专业的市场本质分析报告。</p>
                      </div>
                   </div>
                )}
             </div>
          </div>

          {/* RIGHT COLUMN: Chat Interface (3 cols) 
              Desktop: h-full
          */}
          <div className="lg:col-span-3 lg:h-full h-[600px] min-h-0">
            <ChatInterface messages={messages} setMessages={setMessages} />
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;