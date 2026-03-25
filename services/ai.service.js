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

const buildFallbackScenes = (text, language, duration) => {
  const cleanText = String(text || '').trim();
  const parts = cleanText
    .split(/[.!?\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const source = parts.length > 0 ? parts : [cleanText || 'A cinematic visual story sequence'];
  const maxScenes = Math.min(4, Math.max(2, Math.ceil(duration / 5)));
  const selected = source.slice(0, maxScenes);

  return selected.map((line, index) => ({
    scene_number: index + 1,
    scene_description: line,
    characters: 'Primary and supporting characters',
    environment: 'Detailed 3D cinematic environment',
    camera_angle: index % 2 === 0 ? 'Wide shot' : 'Close-up',
    mood: index % 2 === 0 ? 'Epic and emotional' : 'Warm and engaging'
  }));
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
    const errorText = [
      error && error.message ? String(error.message) : '',
      error && error.status ? String(error.status) : '',
      error ? JSON.stringify(error) : ''
    ].join(' ');

    const isUpstreamAiFailure = /quota|rate|resource_exhausted|api key|unauthori|permission|429|generate_content|gemini/i.test(errorText);

    console.error('AI Service Error: Failed to generate scenes', error.message || error);

    if (isUpstreamAiFailure) {
      console.warn('Gemini request failed. Using fallback scene generation.');
      const { text, language, duration } = promptData;
      return buildFallbackScenes(text, language, duration);
    }

    console.warn('Unexpected AI formatting issue. Using fallback scene generation.');
    const { text, language, duration } = promptData;
    return buildFallbackScenes(text, language, duration);
  }
};

module.exports = { generateScenes };
