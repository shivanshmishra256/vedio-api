const { generateScenes } = require('../services/ai.service');
const { generateAudio } = require('../services/audio.service');
const { generateSceneVideo, mergeVideosWithAudio } = require('../services/video.service');
const { getLatestFinalVideoPath, applyVideoEdits } = require('../services/edit.service');
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
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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
        sceneIndex,
        requestId
      );
      scene.audio_path = audioPath || null;

      // Generate Video
      const videoPath = await generateSceneVideo(scene, sceneIndex, requestId);
      scene.video_path = videoPath || null;
    }

    // Step 4: Merge videos with audio and combine into final video
    console.log('Merging videos with audio...');
    let finalVideoUrl = null;
    try {
      const finalVideoPath = await mergeVideosWithAudio(scenes, requestId);
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
      request_id: requestId,
      final_video_url: finalVideoUrl,
      scenes: responseScenes
    });
  } catch (error) {
    console.error('Controller Error:', error.message);
    return res.status(500).json({ error: 'Failed to generate scenes and videos', details: error.message });
  }
};

const toLocalOutputPath = (inputValue) => {
  if (!inputValue) {
    return null;
  }

  const projectRoot = path.join(__dirname, '..');
  const normalized = String(inputValue).trim();

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('/outputs/')) {
    const localPath = path.join(projectRoot, normalized.replace(/^\//, ''));
    return localPath;
  }

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      if (parsed.pathname.startsWith('/outputs/')) {
        return path.join(projectRoot, parsed.pathname.replace(/^\//, ''));
      }
    } catch (error) {
      return null;
    }
  }

  return null;
};

const handleEditVideo = async (req, res) => {
  try {
    const { instruction, video_url } = req.body || {};

    if (!instruction || !String(instruction).trim()) {
      return res.status(400).json({ error: 'Instruction is required' });
    }

    let inputPath = toLocalOutputPath(video_url);
    if (!inputPath) {
      inputPath = getLatestFinalVideoPath();
    }

    if (!inputPath) {
      return res.status(404).json({ error: 'No input video found. Generate a video first or pass video_url.' });
    }

    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const { outputPath, edits } = await applyVideoEdits(inputPath, instruction, requestId);

    return res.status(200).json({
      message: 'Video edited successfully',
      request_id: requestId,
      input_video_url: toPublicUrl(req, inputPath),
      edited_video_url: toPublicUrl(req, outputPath),
      edit_plan: edits
    });
  } catch (error) {
    console.error('Edit Controller Error:', error.message);
    return res.status(500).json({ error: 'Failed to edit video', details: error.message });
  }
};

module.exports = { handleGenerate, handleEditVideo };
