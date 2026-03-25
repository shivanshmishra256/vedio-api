const { generateScenes } = require('../services/ai.service');
const { generateAudio } = require('../services/audio.service');
const { generateSceneVideo, mergeVideosWithAudio } = require('../services/video.service');
const path = require('path');

const toPublicUrl = (req, absPath) => {
  if (!absPath) {
    return null;
  }

  const projectRoot = path.join(__dirname, '..');
  const relativePath = path.relative(projectRoot, absPath);
  if (!relativePath || relativePath.startsWith('..')) {
    return null;
  }

  const normalized = `/${relativePath.split(path.sep).join('/')}`;
  return `${req.protocol}://${req.get('host')}${normalized}`;
};

const handleGenerate = async (req, res) => {
  try {
    const { text, language, voice, duration } = req.body;

    // Validate text (required)
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Validate language
    const validLanguages = ['hindi', 'english'];
    const cleanLanguage = language ? language.toLowerCase() : 'english';

    if (language && !validLanguages.includes(cleanLanguage)) {
      return res.status(400).json({ error: 'Language must be "hindi" or "english"' });
    }

    // Validate voice
    const validVoices = ['male', 'female'];
    const cleanVoice = voice ? voice.toLowerCase() : 'male';

    if (voice && !validVoices.includes(cleanVoice)) {
      return res.status(400).json({ error: 'Voice must be "male" or "female"' });
    }

    // Build cleaned prompt data with defaults
    const promptData = {
      text: text.trim(),
      language: cleanLanguage,
      voice: cleanVoice,
      duration: duration && Number(duration) > 0 ? Number(duration) : 10
    };

    // Step 1: Generate scenes using AI
    console.log('Generating scenes...');
    const scenes = await generateScenes(promptData);

    // Step 2 & 3: Generate audio & video for each scene
    console.log('Generating audio and video for scenes...');
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneIndex = scene.scene_number || (i + 1);

      // Generate Audio
      const audioPath = await generateAudio(
        scene.scene_description,
        { language: cleanLanguage, voice: cleanVoice },
        sceneIndex
      );
      scene.audio_path = audioPath || null;

      // Generate Video
      const videoPath = await generateSceneVideo(scene, sceneIndex);
      scene.video_path = videoPath || null;
    }

    // Step 4: Merge videos with audio and combine into final video
    console.log('Merging videos with audio...');
    let finalVideoUrl = null;
    try {
      const finalVideoPath = await mergeVideosWithAudio(scenes);
      finalVideoUrl = toPublicUrl(req, finalVideoPath);
    } catch (mergeError) {
      console.error('Final merging failed:', mergeError.message);
      // We can continue and return what we have so far
    }

    const responseScenes = scenes.map((scene) => ({
      ...scene,
      audio_url: toPublicUrl(req, scene.audio_path),
      video_url: toPublicUrl(req, scene.video_path)
    }));

    return res.status(200).json({
      message: 'Video generated successfully',
      final_video_url: finalVideoUrl,
      scenes: responseScenes
    });
  } catch (error) {
    console.error('Controller Error:', error.message);
    return res.status(500).json({ error: 'Failed to generate scenes and videos', details: error.message });
  }
};

module.exports = { handleGenerate };
