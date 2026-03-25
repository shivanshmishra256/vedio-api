const form = document.getElementById('generateForm');
const submitBtn = document.getElementById('submitBtn');
const statusText = document.getElementById('statusText');
const resultSection = document.getElementById('resultSection');
const finalVideoLink = document.getElementById('finalVideoLink');
const scenesContainer = document.getElementById('scenesContainer');

const setStatus = (message, type = '') => {
  statusText.textContent = message;
  statusText.className = `status ${type}`.trim();
};

const renderScenes = (scenes) => {
  scenesContainer.innerHTML = '';

  scenes.forEach((scene, idx) => {
    const card = document.createElement('article');
    card.className = 'scene-card';

    const sceneNo = scene.scene_number || idx + 1;

    card.innerHTML = `
      <h3>Scene ${sceneNo}</h3>
      <p><strong>Description:</strong> ${scene.scene_description || '-'}</p>
      <p><strong>Characters:</strong> ${scene.characters || '-'}</p>
      <p><strong>Environment:</strong> ${scene.environment || '-'}</p>
      <p><strong>Camera:</strong> ${scene.camera_angle || '-'}</p>
      <p><strong>Mood:</strong> ${scene.mood || '-'}</p>
      <p><strong>Audio:</strong> ${scene.audio_url || 'Not available'}</p>
      <p><strong>Video:</strong> ${scene.video_url || 'Not available'}</p>
    `;

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

  setStatus('Generating scenes, audio and video...');
  submitBtn.disabled = true;
  resultSection.classList.add('hidden');
  finalVideoLink.classList.add('hidden');

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data.details || data.error || 'Request failed';
      throw new Error(message);
    }

    renderScenes(Array.isArray(data.scenes) ? data.scenes : []);

    if (data.final_video_url) {
      finalVideoLink.href = data.final_video_url;
      finalVideoLink.classList.remove('hidden');
    }

    resultSection.classList.remove('hidden');
    setStatus('Generation completed.', 'success');
  } catch (error) {
    setStatus(error.message || 'Generation failed.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
