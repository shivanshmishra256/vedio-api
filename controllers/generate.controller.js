const { generateScenes } = require('../services/ai.service');
const { generateAudio } = require('../services/audio.service');
const { generateSceneVideo, mergeVideosWithAudio } = require('../services/video.service');

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
      scene.audio_url = audioPath || null;

      // Generate Video
      const videoPath = await generateSceneVideo(scene, sceneIndex);
      scene.video_url = videoPath || null;
    }

    // Step 4: Merge videos with audio and combine into final video
    console.log('Merging videos with audio...');
    let finalVideoUrl = null;
    try {
      finalVideoUrl = await mergeVideosWithAudio(scenes);
    } catch (mergeError) {
      console.error('Final merging failed:', mergeError.message);
      // We can continue and return what we have so far
    }

    return res.status(200).json({
      message: 'Video generated successfully',
      final_video_url: finalVideoUrl,
      scenes
    });
  } catch (error) {
    console.error('Controller Error:', error.message);
    return res.status(500).json({ error: 'Failed to generate scenes and videos' });
  }
};

module.exports = { handleGenerate };
