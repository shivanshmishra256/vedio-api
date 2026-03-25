const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const REMOTE_FALLBACK_VIDEOS = [
  'https://www.w3schools.com/html/mov_bbb.mp4',
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
];

const COLOR_PALETTES = [
  { bg: 'navy', accent: 'deepskyblue' },
  { bg: 'darkgreen', accent: 'lightgreen' },
  { bg: 'darkred', accent: 'orange' },
  { bg: 'purple', accent: 'violet' },
  { bg: 'teal', accent: 'cyan' },
  { bg: 'maroon', accent: 'pink' }
];

const hashString = (value) => {
  let hash = 0;
  const input = String(value || 'scene');
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const isRemoteUrl = (value) => /^https?:\/\//i.test(String(value || ''));

const getFallbackVideoUrl = (sceneText, index) => {
  const hash = hashString(`${sceneText}-${index}`);
  const baseUrl = REMOTE_FALLBACK_VIDEOS[hash % REMOTE_FALLBACK_VIDEOS.length];
  return `${baseUrl}?scene=${index}&v=${hash}`;
};

const getSceneProfile = (sceneText, index) => {
  const hash = hashString(`${sceneText}-${index}`);
  const palette = COLOR_PALETTES[hash % COLOR_PALETTES.length];
  const duration = 3 + (hash % 4); // 3-6 seconds
  return {
    ...palette,
    duration,
    speed: 80 + (hash % 120)
  };
};

const createDynamicSceneClip = (filePath, profile) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=${profile.bg}:s=1280x720:d=${profile.duration}`)
      .inputFormat('lavfi')
      .videoFilters(['format=yuv420p'])
      .videoCodec('libx264')
      .outputOptions(['-r 24', '-preset veryfast', '-movflags +faststart'])
      .noAudio()
      .on('end', () => resolve(filePath))
      .on('error', (err) => reject(err))
      .save(filePath);
  });
};

const generateSceneVideo = async (scene, index, requestId = 'default', retryCount = 0) => {
  try {
    const outputDir = path.join(__dirname, '..', 'outputs', 'video', requestId);
    ensureDir(outputDir);
    const fileName = `scene_${index}.mp4`;
    const filePath = path.join(outputDir, fileName);

    console.log(`Generating video for scene ${index}...`);

    const profile = getSceneProfile(scene.scene_description, index);
    await createDynamicSceneClip(filePath, profile);

    console.log(`Video generated for scene ${index}: ${fileName}`);
    return filePath;
  } catch (error) {
    if (retryCount < 1) {
      console.log(`Video generation failed for scene ${index}. Retrying...`);
      return generateSceneVideo(scene, index, requestId, retryCount + 1);
    }
    console.error(`Error generating video for scene ${index}:`, error.message);
    const fallbackUrl = getFallbackVideoUrl(scene.scene_description, index);
    console.warn(`Using fallback remote video for scene ${index}: ${fallbackUrl}`);
    return fallbackUrl;
  }
};

const mergeAudioVideo = (videoPath, audioPath, outputPath) => {
  return new Promise((resolve, reject) => {
    // If audio is missing, just copy video
    if (!audioPath || !fs.existsSync(audioPath)) {
       fs.copyFileSync(videoPath, outputPath);
       return resolve(outputPath);
    }

    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v copy',
        '-c:a aac',
        '-map 0:v:0',
        '-map 1:a:0',
        '-shortest'
      ])
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => {
        console.error(`Error merging audio to video:`, err.message);
        reject(err);
      });
  });
};

const mergeVideosWithAudio = async (scenes, requestId = 'default') => {
  const mergedDir = path.join(__dirname, '..', 'outputs', 'merged', requestId);
  const finalDir = path.join(__dirname, '..', 'outputs', 'final', requestId);
  ensureDir(mergedDir);
  ensureDir(finalDir);

  const mergedClips = [];
  const remoteClips = [];

  // 1. Merge audio and video for each scene
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const videoPath = scene.video_path || scene.video_url;
    const audioPath = scene.audio_path || scene.audio_url;

    if (videoPath) {
      if (isRemoteUrl(videoPath)) {
        remoteClips.push(videoPath);
        continue;
      }

      if (!fs.existsSync(videoPath)) {
        continue;
      }

      console.log(`Merging audio+video for scene ${scene.scene_number || i + 1}...`);
      const mergedPath = path.join(mergedDir, `merged_scene_${scene.scene_number || i + 1}.mp4`);
      
      try {
        await mergeAudioVideo(videoPath, audioPath, mergedPath);
        mergedClips.push(mergedPath);
      } catch (err) {
        console.error(`Skipping scene ${scene.scene_number || i + 1} due to merge error.`);
      }
    }
  }

  // 2. Concatenate all merged clips into a final video
  if (mergedClips.length === 0) {
    if (remoteClips.length > 0) {
      return remoteClips[0];
    }
    throw new Error('No valid clips to merge for final video.');
  }

  const finalOutputPath = path.join(finalDir, `final_video_${requestId}.mp4`);
  console.log(`Concatenating ${mergedClips.length} clips into final video...`);

  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    mergedClips.forEach(clip => command.input(clip));

    command
      .on('end', () => {
        console.log('Final video merged successfully!');
        resolve(finalOutputPath);
      })
      .on('error', (err) => {
        console.error('Error concatenating final video:', err.message);
        reject(err);
      });

    // Handle single clip vs multiple clips
    if (mergedClips.length === 1) {
      command.save(finalOutputPath);
    } else {
      command.mergeToFile(finalOutputPath, path.join(__dirname, '..', 'outputs'));
    }
  });
};

module.exports = { generateSceneVideo, mergeVideosWithAudio };
