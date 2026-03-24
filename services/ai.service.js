const OpenAI = require('openai');

let openai = null;

const getClient = () => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
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

    const response = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(text, language, duration) }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content.trim();

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
