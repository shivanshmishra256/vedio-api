const { GoogleGenAI } = require('@google/genai');

let genai = null;

const getClient = () => {
  if (!genai) {
    genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genai;
};

const SYSTEM_PROMPT = `You are a professional cinematic scene writer. Convert user text into multiple short 3D animation scenes. Always respond with valid JSON only, no extra text or markdown.`;

const buildUserPrompt = (text, language, duration) => {
  return `Convert the following text into 3D animation scenes.
The scenes should be suitable for a ${duration}-second video.
Write scene descriptions in ${language}.

Return output as a JSON array like:
[
  {
    "scene_number": 1,
    "scene_description": "...",
    "characters": "...",
    "environment": "...",
    "camera_angle": "...",
    "mood": "..."
  }
]

Text:
${text}`;
};

const generateScenes = async (promptData) => {
  try {
    const { text, language, duration } = promptData;

    const response = await getClient().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: buildUserPrompt(text, language, duration),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
        maxOutputTokens: 2000
      }
    });

    const content = response.text.trim();

    // Clean markdown code fences if present
    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const scenes = JSON.parse(cleaned);
    return scenes;
  } catch (error) {
    console.error('AI Service Error:', error.message);
    throw new Error('Failed to generate scenes');
  }
};

module.exports = { generateScenes };
