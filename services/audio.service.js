const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

let openai = null;

const getClient = () => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
};

// Voice mapping based on language + gender
const VOICE_MAP = {
  english: {
    male: 'onyx',     // deep tone
    female: 'nova'    // soft tone
  },
  hindi: {
    male: 'echo',     // deep tone, Hindi-compatible
    female: 'shimmer' // soft tone, Hindi-compatible
  }
};

const getVoice = (language, voice) => {
  const lang = VOICE_MAP[language] || VOICE_MAP['english'];
  return lang[voice] || lang['male'];
};

// Ensure output directory exists
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const generateAudio = async (sceneText, options, sceneNumber) => {
  try {
    const { language = 'english', voice = 'male' } = options;

    const selectedVoice = getVoice(language, voice);

    const outputDir = path.join(__dirname, '..', 'outputs', 'audio');
    ensureDir(outputDir);

    const fileName = `audio_scene_${sceneNumber}.mp3`;
    const filePath = path.join(outputDir, fileName);

    const response = await getClient().audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: selectedVoice,
      input: sceneText,
      response_format: 'mp3'
    });

    // Write audio buffer to file
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    console.log(`Audio generated: ${fileName}`);
    return filePath;
  } catch (error) {
    console.error(`Audio generation failed for scene ${sceneNumber}:`, error.message);
    return null;
  }
};

module.exports = { generateAudio };
