const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const DUMMY_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

const generateSceneVideo = async (scene, index, retryCount = 0) => {
  try {
    const outputDir = path.join(__dirname, '..', 'outputs', 'video');
    ensureDir(outputDir);
    const fileName = `scene_${index}.mp4`;
    const filePath = path.join(outputDir, fileName);

    console.log(`Generating video for scene ${index}...`);

    // Simulate calling an AI Video Generation API
    const payload = {
      prompt: scene.scene_description,
      style: '3D animation cinematic',
      camera: scene.camera_angle,
      mood: scene.mood
    };

    // If using a real API (like Replicate/Runway), you would make a POST request here
    // and extract the resulting video URL. We will use a fallback/dummy for now.
    const videoUrl = DUMMY_VIDEO_URL;

    // Download video
    const response = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`Video generated for scene ${index}: ${fileName}`);
    return filePath;
  } catch (error) {
    if (retryCount < 1) {
      console.log(`Video generation failed for scene ${index}. Retrying...`);
      return generateSceneVideo(scene, index, retryCount + 1);
    }
    console.error(`Error generating video for scene ${index}:`, error.message);
    return null;
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

const mergeVideosWithAudio = async (scenes) => {
  const mergedDir = path.join(__dirname, '..', 'outputs', 'merged');
  const finalDir = path.join(__dirname, '..', 'outputs', 'final');
  ensureDir(mergedDir);
  ensureDir(finalDir);

  const mergedClips = [];

  // 1. Merge audio and video for each scene
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const videoPath = scene.video_path || scene.video_url;
    const audioPath = scene.audio_path || scene.audio_url;

    if (videoPath) {
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
    throw new Error('No valid clips to merge for final video.');
  }

  const finalOutputPath = path.join(finalDir, 'final_video.mp4');
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
