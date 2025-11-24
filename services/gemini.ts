import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { AnalysisResponse, VisualizationData } from "../types";

// Helper to convert file to base64
export const fileToPart = (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const SYSTEM_INSTRUCTION = `
你是世界级的宏观对冲基金经理和技术分析大师。
你的核心能力是将**多张图表**放在一起进行**关联分析**（Cross-Asset Correlation Analysis），并结合**实时网络搜索**来验证你的假设。

**你的工作流程：**
1. **视觉识别**：首先准确识别每一张上传图片中的资产名称、代码（Ticker）、时间周期和当前技术形态。
2. **联网搜索**：针对识别出的资产，利用 Google Search 查找**今日/近期**的关键新闻、财报数据或宏观事件。
3. **逻辑关联**：不要孤立地分析每张图。你必须寻找图表之间的联系。例如：
   - 如果用户上传了“美元指数”和“黄金”，请分析美元走势如何影响黄金。
   - 如果用户上传了“英伟达”和“纳斯达克”，请分析权重股对指数的驱动。
4. **本质洞察**：透过现象看本质，解释资金流向和市场心理。

**内容排版要求：**
1. **结构清晰**：使用 Markdown 标题（###）分隔不同部分。
2. **突出重点**：关键结论、数据点或趋势名称必须使用**粗体**显示。
3. **留白美观**：在不同的逻辑段落之间，必须保留空白行。
4. **语言风格**：简体中文，专业、犀利、直击要害。

关键：你还必须在回复的最后生成一个特定的 JSON 块用于可视化。
JSON 块必须包裹在 \`\`\`json ... \`\`\` 代码块中。
JSON 结构必须是：
{
  "sentimentScore": number, // 0-100 (0=极端恐惧, 100=极端贪婪)
  "volatilityIndex": number, // 0-100 (高活跃度/波动 = 高分)
  "marketPhase": string, // 短语，如 "看涨突破", "回调", "盘整"
  "keySectors": [
    { "name": "板块名称", "trend": "up" | "down" | "neutral", "value": number (-100 to 100) }
  ]
}
`;

let chatInstance: Chat | null = null;
let genAIInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!genAIInstance) {
    if (!process.env.API_KEY) {
      throw new Error("API Key is missing in process.env");
    }
    genAIInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return genAIInstance;
};

export const analyzeMarketImages = async (files: File[]): Promise<AnalysisResponse> => {
  const ai = getAI();
  const imageParts = await Promise.all(files.map(fileToPart));

  const prompt = `
    请对上传的这 ${files.length} 张市场图表进行综合关联分析。

    请严格按照以下步骤思考并输出报告：

    ### 第一步：图表内容概览 (必须放在报告最前面)
    请依次对每一张图片进行一句话精准概括，格式如下：
    *   **图表 1 ([资产名称])**：[一句话概括当前形态或趋势，如：突破20日均线，量能放大]。
    *   **图表 2 ([资产名称])**：[一句话概括...]
    ...

    ### 第二步：图表识别与搜索验证
    *   **使用 Google Search** 搜索这些标的**今天**发生的突发新闻、政策变动或主力资金动向。
    *   (在报告中明确指出你搜索到了什么关键信息来支撑你的分析)。

    ### 第三步：生成深度分析报告
    请按以下结构输出 Markdown：

    ### 1. 核心本质总结 (Executive Summary)
    (一句话概括多张图表共同反映的市场核心逻辑，例如：“在降息预期落空的背景下，科技股与避险资产出现罕见的同跌现象。”)

    ### 2. 跨图表关联分析 (Correlation Logic)
    (不要单独描述图A和图B。请分析它们的关系：A图的下跌是否导致了B图的上涨？它们是否受到同一个宏观因子的驱动？)

    ### 3. 关键技术形态与搜索印证
    (结合图表中的支撑/阻力位，以及搜索到的新闻。例如：“图表显示触及200日均线反弹，且搜索显示今日刚好公布了利好的回购计划。”)

    ### 4. 交易心理与策略建议
    (当前市场情绪是恐慌还是贪婪？主力在洗盘还是出货？)

    最后，请务必生成 JSON 可视化数据块。
  `;

  // Note: Grounding requires the tools config. 
  // We CANNOT use responseSchema/responseMimeType when using tools (Search).
  // So we rely on the prompt to format the JSON.
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      role: 'user',
      parts: [...imageParts, { text: prompt }]
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
    },
  });

  const fullText = response.text || "";
  
  // Extract Grounding Metadata
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const groundingLinks = groundingChunks
    .map(chunk => chunk.web)
    .filter(web => web && web.uri && web.title)
    .map(web => ({ title: web!.title!, url: web!.uri! }));

  // Parse JSON from text
  const jsonMatch = fullText.match(/```json\n([\s\S]*?)\n```/);
  let visualizationData: VisualizationData | null = null;
  let markdownReport = fullText;

  if (jsonMatch && jsonMatch[1]) {
    try {
      visualizationData = JSON.parse(jsonMatch[1]);
      // Remove the JSON block from the display text to keep it clean
      markdownReport = fullText.replace(jsonMatch[0], '').trim();
    } catch (e) {
      console.error("Failed to parse visualization JSON", e);
    }
  }

  // Initialize chat session with this context
  chatInstance = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: { systemInstruction: SYSTEM_INSTRUCTION },
    history: [
      { role: 'user', parts: [...imageParts, { text: prompt }] },
      { role: 'model', parts: [{ text: fullText }] }
    ]
  });

  return {
    markdownReport,
    visualizationData,
    groundingLinks
  };
};

export const sendChatMessage = async (message: string): Promise<string> => {
  if (!chatInstance) {
    // Fallback if chat wasn't initialized (e.g. user chats before upload)
    const ai = getAI();
    chatInstance = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });
  }

  const response = await chatInstance.sendMessage({ message });
  return response.text || "我无法生成回复。";
};