const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const os = require('os');

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);

  const ffprobePath = ffmpegPath.replace(/ffmpeg(?:\.exe)?$/i, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
  if (fs.existsSync(ffprobePath)) {
    ffmpeg.setFfprobePath(ffprobePath);
  }
}

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const resolveWritableOutputDir = (requestId) => {
  const projectDir = path.join(__dirname, '..', 'outputs', 'edited', requestId);

  try {
    ensureDir(projectDir);
    fs.accessSync(projectDir, fs.constants.W_OK);
    return { dirPath: projectDir, isProjectPath: true };
  } catch (error) {
    const tempDir = path.join(os.tmpdir(), 'p4-edited', requestId);
    ensureDir(tempDir);
    return { dirPath: tempDir, isProjectPath: false };
  }
};

const walkFiles = (rootDir) => {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const items = fs.readdirSync(rootDir, { withFileTypes: true });
  const output = [];

  items.forEach((item) => {
    const fullPath = path.join(rootDir, item.name);
    if (item.isDirectory()) {
      output.push(...walkFiles(fullPath));
      return;
    }

    output.push(fullPath);
  });

  return output;
};

const getLatestFinalVideoPath = () => {
  const finalRoot = path.join(__dirname, '..', 'outputs', 'final');
  const mp4Files = walkFiles(finalRoot).filter((filePath) => filePath.toLowerCase().endsWith('.mp4'));

  if (mp4Files.length === 0) {
    return null;
  }

  mp4Files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return mp4Files[0];
};

const parseEditInstruction = (instruction) => {
  const raw = String(instruction || '').trim();
  const lower = raw.toLowerCase();

  const plan = {
    trimStart: null,
    trimEnd: null,
    speed: 1,
    mute: false,
    grayscale: false,
    flipH: false,
    flipV: false,
    caption: null
  };

  const trimRangeMatch = lower.match(/from\s+(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)?\s*(?:to|\-)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)?/i);
  if (trimRangeMatch) {
    const start = Number(trimRangeMatch[1]);
    const end = Number(trimRangeMatch[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      plan.trimStart = start;
      plan.trimEnd = end;
    }
  }

  const firstMatch = lower.match(/first\s+(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)/i);
  if (!trimRangeMatch && firstMatch) {
    const end = Number(firstMatch[1]);
    if (Number.isFinite(end) && end > 0) {
      plan.trimStart = 0;
      plan.trimEnd = end;
    }
  }

  const speedMatch = lower.match(/(\d+(?:\.\d+)?)\s*x/);
  if (speedMatch) {
    const speed = Number(speedMatch[1]);
    if (Number.isFinite(speed) && speed > 0.25 && speed <= 4) {
      plan.speed = speed;
    }
  }

  if (/faster|speed up/.test(lower) && plan.speed === 1) {
    plan.speed = 1.25;
  }

  if (/slower|slow down/.test(lower) && plan.speed === 1) {
    plan.speed = 0.8;
  }

  if (/mute|without sound|remove audio|no audio|silent/.test(lower)) {
    plan.mute = true;
  }

  if (/black and white|grayscale|grey scale|monochrome|b\/?w/.test(lower)) {
    plan.grayscale = true;
  }

  if (/flip horizontal|mirror|horizontal flip/.test(lower)) {
    plan.flipH = true;
  }

  if (/flip vertical|vertical flip/.test(lower)) {
    plan.flipV = true;
  }

  const quotedTextMatch = raw.match(/(?:add|put|show)\s+text\s+["'“”]?([^"'“”]+)["'“”]?/i);
  if (quotedTextMatch && quotedTextMatch[1]) {
    plan.caption = quotedTextMatch[1].trim();
  }

  const captionMatch = raw.match(/caption\s*[:\-]\s*(.+)$/i);
  if (!plan.caption && captionMatch && captionMatch[1]) {
    plan.caption = captionMatch[1].trim();
  }

  return plan;
};

const escapeDrawText = (value) => {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,');
};

const buildAudioTempoFilters = (speed) => {
  if (speed === 1) {
    return [];
  }

  const filters = [];
  let remaining = speed;

  while (remaining > 2) {
    filters.push('atempo=2.0');
    remaining /= 2;
  }

  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }

  filters.push(`atempo=${remaining.toFixed(3)}`);
  return filters;
};

const applyVideoEdits = async (inputPath, instruction, requestId) => {
  const edits = parseEditInstruction(instruction);

  const { dirPath: outputDir, isProjectPath } = resolveWritableOutputDir(requestId);
  const outputPath = path.join(outputDir, `edited_${requestId}.mp4`);

  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath);

    if (edits.trimStart !== null) {
      command.setStartTime(edits.trimStart);
    }

    if (edits.trimStart !== null && edits.trimEnd !== null && edits.trimEnd > edits.trimStart) {
      command.setDuration(edits.trimEnd - edits.trimStart);
    }

    const videoFilters = [];

    if (edits.grayscale) {
      videoFilters.push('hue=s=0');
    }

    if (edits.flipH) {
      videoFilters.push('hflip');
    }

    if (edits.flipV) {
      videoFilters.push('vflip');
    }

    if (edits.speed !== 1) {
      videoFilters.push(`setpts=${(1 / edits.speed).toFixed(4)}*PTS`);
    }

    if (edits.caption) {
      const safeCaption = escapeDrawText(edits.caption);
      videoFilters.push(`drawtext=text='${safeCaption}':fontcolor=white:fontsize=38:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=h-100`);
    }

    if (videoFilters.length > 0) {
      command.videoFilters(videoFilters);
    }

    if (edits.mute) {
      command.noAudio();
    } else if (edits.speed !== 1) {
      const atempoFilters = buildAudioTempoFilters(edits.speed);
      if (atempoFilters.length > 0) {
        command.audioFilters(atempoFilters);
      }
    }

    command
      .videoCodec('libx264')
      .outputOptions(['-movflags +faststart', '-pix_fmt yuv420p'])
      .on('end', () => resolve({ outputPath, edits, isProjectPath }))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
};

module.exports = {
  getLatestFinalVideoPath,
  applyVideoEdits
};
