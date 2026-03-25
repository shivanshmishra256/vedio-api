const form = document.getElementById('generateForm');
const submitBtn = document.getElementById('submitBtn');
const statusText = document.getElementById('statusText');
const resultSection = document.getElementById('resultSection');
const finalVideoLink = document.getElementById('finalVideoLink');
const scenesContainer = document.getElementById('scenesContainer');
const finalVideoPreview = document.getElementById('finalVideoPreview');
const editForm = document.getElementById('editForm');
const editInstructionInput = document.getElementById('editInstruction');
const editBtn = document.getElementById('editBtn');
const editStatusText = document.getElementById('editStatusText');
const editResult = document.getElementById('editResult');
const editedVideoLink = document.getElementById('editedVideoLink');
const editedVideoPreview = document.getElementById('editedVideoPreview');

const REQUEST_TIMEOUT_MS = 180000;
let latestVideoUrl = null;

const setStatus = (message, type = '') => {
  statusText.textContent = message;
  statusText.className = `status ${type}`.trim();
};

const setEditStatus = (message, type = '') => {
  editStatusText.textContent = message;
  editStatusText.className = `status ${type}`.trim();
};

const safeText = (value, fallback = '-') => {
  const text = String(value ?? '').trim();
  return text.length ? text : fallback;
};

const parseApiResponse = async (response) => {
  const raw = await response.text();
  if (!raw || !raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (parseError) {
    const statusLabel = response.statusText || 'Server Error';
    throw new Error(`Server returned invalid response (${response.status} ${statusLabel}).`);
  }
};

const postJsonWithFallback = async (paths, payload, signal) => {
  let lastError = null;

  for (const endpoint of paths) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal
      });

      const data = await parseApiResponse(response);
      if (response.ok) {
        return { response, data, endpoint };
      }

      const message = data.details || data.error || `Request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.endpoint = endpoint;

      if (response.status === 404 || response.status === 405) {
        lastError = error;
        continue;
      }

      throw error;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }

      if (error.status === 404 || error.status === 405) {
        lastError = error;
        continue;
      }

      lastError = error;
      break;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Unable to reach video API endpoint.');
};

const createInfoLine = (label, value) => {
  const p = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${label}:`;
  p.appendChild(strong);
  p.append(` ${safeText(value)}`);
  return p;
};

const createMediaLink = (label, url) => {
  const p = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${label}:`;
  p.appendChild(strong);

  if (!url) {
    p.append(' Not available');
    return p;
  }

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = ' Open';
  p.appendChild(link);
  return p;
};

const renderScenes = (scenes) => {
  scenesContainer.innerHTML = '';

  scenes.forEach((scene, idx) => {
    const card = document.createElement('article');
    card.className = 'scene-card';

    const sceneNo = scene.scene_number || idx + 1;
    const title = document.createElement('h3');
    title.textContent = `Scene ${sceneNo}`;
    card.appendChild(title);

    card.appendChild(createInfoLine('Description', scene.scene_description));
    card.appendChild(createInfoLine('Characters', scene.characters));
    card.appendChild(createInfoLine('Environment', scene.environment));
    card.appendChild(createInfoLine('Camera', scene.camera_angle));
    card.appendChild(createInfoLine('Mood', scene.mood));
    card.appendChild(createMediaLink('Audio', scene.audio_url));
    card.appendChild(createMediaLink('Video', scene.video_url));

    if (scene.video_url) {
      const video = document.createElement('video');
      video.className = 'scene-video';
      video.controls = true;
      video.src = scene.video_url;
      card.appendChild(video);
    }

    if (scene.audio_url) {
      const audio = document.createElement('audio');
      audio.className = 'scene-audio';
      audio.controls = true;
      audio.src = scene.audio_url;
      card.appendChild(audio);
    }

    scenesContainer.appendChild(card);
  });
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    text: String(formData.get('text') || '').trim(),
    language: String(formData.get('language') || 'english').toLowerCase(),
    voice: String(formData.get('voice') || 'male').toLowerCase(),
    duration: Number(formData.get('duration') || 10)
  };

  if (!payload.text) {
    setStatus('Please enter text prompt.', 'error');
    return;
  }

  if (!Number.isFinite(payload.duration) || payload.duration < 3 || payload.duration > 120) {
    setStatus('Duration must be between 3 and 120 seconds.', 'error');
    return;
  }

  setStatus('Generating scenes, audio and video...');
  submitBtn.disabled = true;
  resultSection.classList.add('hidden');
  finalVideoLink.classList.add('hidden');
  finalVideoPreview.classList.add('hidden');
  finalVideoPreview.removeAttribute('src');
  latestVideoUrl = null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const { data } = await postJsonWithFallback(['/api/generate', '/generate'], payload, controller.signal);

    const scenes = Array.isArray(data.scenes) ? data.scenes : [];
    renderScenes(scenes);

    if (data.final_video_url) {
      finalVideoLink.href = data.final_video_url;
      finalVideoLink.classList.remove('hidden');
      finalVideoPreview.src = data.final_video_url;
      finalVideoPreview.classList.remove('hidden');
      latestVideoUrl = data.final_video_url;
    } else if (scenes.length > 0 && scenes[0].video_url) {
      latestVideoUrl = scenes[0].video_url;
    }

    resultSection.classList.remove('hidden');
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    setStatus(`Generation completed in ${elapsedSeconds}s.`, 'success');
    setEditStatus('Prompt do aur Edit Video dabao.', 'success');
  } catch (error) {
    if (error.name === 'AbortError') {
      setStatus('Request timed out. Try shorter text or duration.', 'error');
    } else {
      setStatus(error.message || 'Generation failed.', 'error');
    }
  } finally {
    clearTimeout(timeoutId);
    submitBtn.disabled = false;
  }
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const instruction = String(editInstructionInput.value || '').trim();

  if (!instruction) {
    setEditStatus('Please enter edit instruction.', 'error');
    return;
  }

  if (!latestVideoUrl) {
    setEditStatus('Pehle video generate karo, phir edit prompt do.', 'error');
    return;
  }

  setEditStatus('AI assistant is editing your video...');
  editBtn.disabled = true;
  editResult.classList.add('hidden');
  editedVideoLink.classList.add('hidden');
  editedVideoPreview.classList.add('hidden');
  editedVideoPreview.removeAttribute('src');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const { data } = await postJsonWithFallback(
      ['/api/edit-video', '/edit-video'],
      { instruction, video_url: latestVideoUrl },
      controller.signal
    );

    const editedUrl = data.edited_video_url;
    if (!editedUrl) {
      throw new Error('Edited video URL missing in response.');
    }

    editedVideoLink.href = editedUrl;
    editedVideoLink.classList.remove('hidden');
    editedVideoPreview.src = editedUrl;
    editedVideoPreview.classList.remove('hidden');
    editResult.classList.remove('hidden');
    latestVideoUrl = editedUrl;
    setEditStatus('Editing completed successfully.', 'success');
  } catch (error) {
    if (error.name === 'AbortError') {
      setEditStatus('Edit request timed out. Try a shorter command.', 'error');
    } else {
      setEditStatus(error.message || 'Video edit failed.', 'error');
    }
  } finally {
    clearTimeout(timeoutId);
    editBtn.disabled = false;
  }
});
