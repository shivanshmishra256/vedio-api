const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs');
const path = require('path');

// Voice mapping based on language + gender
const VOICE_MAP = {
  english: {
    male: 'en-US-GuyNeural',
    female: 'en-US-JennyNeural'
  },
  hindi: {
    male: 'hi-IN-MadhurNeural',
    female: 'hi-IN-SwaraNeural'
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

    const fileName = `audio_scene_${sceneNumber}`;
    const sceneDir = path.join(outputDir, fileName);
    ensureDir(sceneDir);

    const tts = new MsEdgeTTS();
    await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const { audioFilePath } = await tts.toFile(sceneDir, sceneText);
    const ext = path.extname(audioFilePath) || '.mp3';
    const finalPath = path.join(outputDir, `${fileName}${ext}`);

    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
    }

    fs.copyFileSync(audioFilePath, finalPath);
    console.log(`Audio generated: ${path.basename(finalPath)}`);
    return finalPath;
  } catch (error) {
    console.error(`Audio generation failed for scene ${sceneNumber}:`, error.message);
    return null;
  }
};

module.exports = { generateAudio };
