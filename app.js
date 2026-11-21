'use strict';

const STORAGE_KEY = 'chrono-renfo-routines-v1';
const PREP_SECONDS = 10;
const APP_VERSION = 3;

const $ = id => document.getElementById(id);
const screens = ['home-screen', 'detail-screen', 'editor-screen', 'workout-screen'];
let routines = loadRoutines();
let selectedRoutineId = null;
let editorRoutine = null;
let workout = null;
let timerInterval = null;
let wakeLock = null;
let audioContext = null;
let toastTimer = null;

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function defaultRoutine() {
  return {
    id: uid(),
    name: 'Ma routine',
    rounds: 1,
    interRoundRest: 30,
    exercises: [
      { id: uid(), name: 'Pompes', duration: 30, restAfter: 30 },
      { id: uid(), name: 'Abdos', duration: 30, restAfter: 30 },
      { id: uid(), name: 'Tractions', duration: 30, restAfter: 0 }
    ]
  };
}

function normalizeRoutine(routine) {
  const exercises = Array.isArray(routine?.exercises) ? routine.exercises : [];
  return {
    id: typeof routine?.id === 'string' ? routine.id : uid(),
    name: typeof routine?.name === 'string' && routine.name.trim() ? routine.name : 'Routine sans nom',
    rounds: clampInt(routine?.rounds, 1, 20, 1),
    interRoundRest: clampInt(routine?.interRoundRest, 0, 3600, 30),
    exercises: exercises.map((ex, i) => ({
      id: typeof ex.id === 'string' ? ex.id : uid(),
      name: typeof ex.name === 'string' && ex.name.trim() ? ex.name : `Exercice ${i + 1}`,
      duration: clampInt(ex.duration, 1, 3600, 30),
      restAfter: clampInt(ex.restAfter, 0, 3600, 30)
    }))
  };
}

function loadRoutines() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(parsed) && parsed.length) return parsed.map(normalizeRoutine); 
  } catch (_) {}
  return [];
}

function saveRoutines() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
}

function showScreen(id) {
  screens.forEach(screen => $(screen).classList.toggle('active', screen === id));
}

function formatSeconds(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} min ${rest} s` : `${m} min`;
}

function clock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function routineTotal(routine) {
  const rounds = clampInt(routine.rounds, 1, 20, 1);
  const oneRound = routine.exercises.reduce((sum, ex, i) => sum + Number(ex.duration || 0) + (i < routine.exercises.length - 1 ? Number(ex.restAfter || 0) : 0), 0);
  return oneRound * rounds + Math.max(0, rounds - 1) * Number(routine.interRoundRest || 0);
}

function buildSequence(routine) {
  const sequence = [];
  const rounds = clampInt(routine.rounds, 1, 20, 1);
  for (let round = 0; round < rounds; round++) {
    routine.exercises.forEach((ex, i) => {
      const duration = Math.max(1, Number(ex.duration) || 1);
      sequence.push({ type: 'exercise', title: ex.name || `Exercice ${i + 1}`, duration, exerciseIndex: i, roundIndex: round });
      if (i < routine.exercises.length - 1) {
        const rest = Math.max(0, Number(ex.restAfter) || 0);
        if (rest > 0) sequence.push({ type: 'rest', title: 'Récupération', duration: rest, exerciseIndex: i, roundIndex: round });
      }
    });
    if (round < rounds - 1) {
      const rest = Math.max(0, Number(routine.interRoundRest) || 0);
      if (rest > 0) sequence.push({ type: 'rest', title: 'Récupération entre les tours', duration: rest, roundIndex: round });
    }
  }
  return sequence;
}

function renderHome() {
  const list = $('routine-list');
  const empty = $('empty-state');
  list.innerHTML = '';
  empty.classList.toggle('hidden', routines.length > 0);
  if (!routines.length) return;

  routines.forEach(routine => {
    const card = document.createElement('article');
    card.className = 'routine-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Afficher le détail de ${routine.name}`);
    const count = routine.exercises.length;
    const rounds = clampInt(routine.rounds, 1, 20, 1);
    card.innerHTML = `
      <div class="routine-card-main">
        <div class="routine-card-copy">
          <h2>${escapeHtml(routine.name)}</h2>
          <div class="meta">${count} exercice${count > 1 ? 's' : ''} · ${rounds} tour${rounds > 1 ? 's' : ''} · ${formatSeconds(routineTotal(routine))}</div>
        </div>
        <button class="launch-button" type="button" data-id="${escapeAttr(routine.id)}" aria-label="Lancer ${escapeAttr(routine.name)}"><span>▶</span></button>
      </div>`;
    card.addEventListener('click', () => openDetail(routine.id));
    card.addEventListener('keydown', e => {
      if (e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(routine.id); }
    });
    card.querySelector('.launch-button').addEventListener('click', e => {
      e.stopPropagation();
      startWorkout(routine);
    });
    list.appendChild(card);
  });
}

function openDetail(id) {
  const routine = routines.find(r => r.id === id);
  if (!routine) return;
  selectedRoutineId = id;
  const sequence = buildSequence(routine);
  $('detail-content').innerHTML = `
    <h1 class="detail-title">${escapeHtml(routine.name)}</h1>
    <p class="detail-meta">${routine.exercises.length} exercice${routine.exercises.length > 1 ? 's' : ''} · ${clampInt(routine.rounds, 1, 20, 1)} tour${clampInt(routine.rounds, 1, 20, 1) > 1 ? 's' : ''} · ${formatSeconds(routineTotal(routine))}</p>
    <div class="sequence-list">
      ${sequence.map((item, i) => `
        <div class="sequence-item">
          <span class="sequence-number">${i + 1}</span>
          <div><div class="sequence-title">${escapeHtml(item.title)}</div><div class="sequence-type">${item.type === 'exercise' ? 'Exercice' : 'Récupération'}</div></div>
          <span class="sequence-duration">${clock(item.duration)}</span>
        </div>`).join('')}
    </div>
    <button id="detail-start" class="primary-button detail-start">Démarrer la séance</button>`;
  $('detail-start').addEventListener('click', () => startWorkout(routine));
  showScreen('detail-screen');
}

function openEditor(id = null) {
  const source = id ? routines.find(r => r.id === id) : defaultRoutine();
  if (!source) return;
  editorRoutine = JSON.parse(JSON.stringify(source));
  $('editor-heading').textContent = id ? 'Modifier la routine' : 'Nouvelle routine';
  $('routine-name').value = editorRoutine.name;
  $('routine-rounds').value = clampInt(editorRoutine.rounds, 1, 20, 1);
  $('inter-round-rest').value = clampInt(editorRoutine.interRoundRest, 0, 3600, 30);
  $('delete-routine').classList.toggle('hidden', !id);
  renderExerciseEditor();
  showScreen('editor-screen');
}

function renderExerciseEditor() {
  const list = $('exercise-editor-list');
  list.innerHTML = '';
  editorRoutine.exercises.forEach((ex, index) => {
    const el = document.createElement('div');
    el.className = 'exercise-editor';
    el.innerHTML = `
      <div class="exercise-editor-top">
        <input class="text-input exercise-name-input" maxlength="60" value="${escapeAttr(ex.name)}" placeholder="Nom de l'exercice">
        <div class="reorder-actions">
          <button data-action="up" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button data-action="down" ${index === editorRoutine.exercises.length - 1 ? 'disabled' : ''}>↓</button>
        </div>
      </div>
      <div class="editor-grid">
        <label><span class="input-caption">Durée</span><input class="number-input duration-input" type="number" min="1" max="3600" inputmode="numeric" value="${Number(ex.duration) || 1}"></label>
        <label><span class="input-caption">Récupération après</span><input class="number-input rest-input" type="number" min="0" max="3600" inputmode="numeric" value="${Number(ex.restAfter) || 0}" ${index === editorRoutine.exercises.length - 1 ? 'disabled' : ''}></label>
      </div>
      <button class="delete-exercise" data-action="delete">Supprimer cet exercice</button>`;
    list.appendChild(el);

    el.querySelector('.exercise-name-input').addEventListener('input', e => ex.name = e.target.value);
    el.querySelector('.duration-input').addEventListener('input', e => ex.duration = clampInt(e.target.value, 1, 3600, 30));
    el.querySelector('.rest-input').addEventListener('input', e => ex.restAfter = clampInt(e.target.value, 0, 3600, 30));
    el.querySelector('[data-action="up"]').addEventListener('click', () => moveExercise(index, -1));
    el.querySelector('[data-action="down"]').addEventListener('click', () => moveExercise(index, 1));
    el.querySelector('[data-action="delete"]').addEventListener('click', () => {
      if (editorRoutine.exercises.length === 1) return toast('Une routine doit avoir au moins un exercice.');
      editorRoutine.exercises.splice(index, 1);
      renderExerciseEditor();
    });
  });
}

function moveExercise(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= editorRoutine.exercises.length) return;
  [editorRoutine.exercises[index], editorRoutine.exercises[target]] = [editorRoutine.exercises[target], editorRoutine.exercises[index]];
  renderExerciseEditor();
}

function saveEditor() {
  const name = $('routine-name').value.trim() || 'Routine sans nom';
  editorRoutine.name = name;
  editorRoutine.rounds = clampInt($('routine-rounds').value, 1, 20, 1);
  editorRoutine.interRoundRest = clampInt($('inter-round-rest').value, 0, 3600, 30);
  editorRoutine.exercises.forEach((ex, i) => {
    ex.name = ex.name.trim() || `Exercice ${i + 1}`;
    ex.duration = clampInt(ex.duration, 1, 3600, 30);
    ex.restAfter = i === editorRoutine.exercises.length - 1 ? 0 : clampInt(ex.restAfter, 0, 3600, 30);
  });
  const existingIndex = routines.findIndex(r => r.id === editorRoutine.id);
  if (existingIndex >= 0) routines[existingIndex] = editorRoutine;
  else routines.push(editorRoutine);
  saveRoutines();
  renderHome();
  openDetail(editorRoutine.id);
  toast('Routine enregistrée');
}


function exportRoutines() {
  const payload = {
    app: 'Chrono Renfo',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    routines
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `chrono-renfo-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${routines.length} routine${routines.length > 1 ? 's' : ''} sauvegardée${routines.length > 1 ? 's' : ''}`);
}

function normalizeImportedRoutines(data) {
  const source = Array.isArray(data) ? data : data?.routines;
  if (!Array.isArray(source)) throw new Error('Format de sauvegarde invalide');
  const cleaned = source.map(r => ({
    id: typeof r.id === 'string' ? r.id : uid(),
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Routine sans nom',
    rounds: clampInt(r.rounds, 1, 20, 1),
    interRoundRest: clampInt(r.interRoundRest, 0, 3600, 30),
    exercises: Array.isArray(r.exercises) ? r.exercises.map((ex, i) => ({
      id: typeof ex.id === 'string' ? ex.id : uid(),
      name: typeof ex.name === 'string' && ex.name.trim() ? ex.name.trim() : `Exercice ${i + 1}`,
      duration: clampInt(ex.duration, 1, 3600, 30),
      restAfter: clampInt(ex.restAfter, 0, 3600, 30)
    })).filter(ex => ex.name) : []
  })).filter(r => r.exercises.length > 0);
  if (!cleaned.length) throw new Error('Aucune routine valide dans cette sauvegarde');
  return cleaned;
}

function importRoutines(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = normalizeImportedRoutines(JSON.parse(reader.result));
      const replace = confirm(`Restaurer ${imported.length} routine${imported.length > 1 ? 's' : ''} ?\n\nOK = remplacer les routines actuelles\nAnnuler = ajouter les routines sauvegardées`);
      if (replace) {
        routines = imported;
      } else {
        const existingNames = new Set(routines.map(r => r.name));
        imported.forEach(r => {
          const copy = JSON.parse(JSON.stringify(r));
          copy.id = uid();
          if (existingNames.has(copy.name)) copy.name = `${copy.name} (restaurée)`;
          copy.exercises.forEach(ex => ex.id = uid());
          routines.push(copy);
        });
      }
      saveRoutines();
      renderHome();
      toast('Sauvegarde restaurée');
    } catch (error) {
      toast('Sauvegarde invalide ou illisible');
    }
  };
  reader.onerror = () => toast('Impossible de lire le fichier');
  reader.readAsText(file);
}

function deleteRoutine(id) {
  const routine = routines.find(r => r.id === id);
  if (!routine) return;
  if (!confirm(`Supprimer « ${routine.name} » ?`)) return;
  routines = routines.filter(r => r.id !== id);
  saveRoutines();
  renderHome();
}

function deleteEditorRoutine() {
  if (!editorRoutine) return;
  const existing = routines.find(r => r.id === editorRoutine.id);
  if (!existing) return;
  if (!confirm(`Supprimer « ${existing.name} » ? Cette action est définitive.`)) return;
  routines = routines.filter(r => r.id !== existing.id);
  saveRoutines();
  editorRoutine = null;
  renderHome();
  showScreen('home-screen');
  toast('Routine supprimée');
}

async function startWorkout(routine) {
  const sequence = buildSequence(routine);
  if (!sequence.length) return;
  selectedRoutineId = routine.id;
  workout = {
    routine,
    sequence,
    position: -1,
    phase: 'prep',
    remaining: PREP_SECONDS,
    endsAt: Date.now() + PREP_SECONDS * 1000,
    paused: false,
    lastCue: null
  };
  $('workout-routine-name').textContent = routine.name;
  showScreen('workout-screen');
  initAudio();
  beep(660, 0.08);
  await requestWakeLock();
  clearInterval(timerInterval);
  timerInterval = setInterval(tickWorkout, 100);
  renderWorkout();
}

function tickWorkout() {
  if (!workout || workout.paused) return;
  const remaining = Math.max(0, Math.ceil((workout.endsAt - Date.now()) / 1000));
  workout.remaining = remaining;

  if (workout.phase === 'prep') {
    if (remaining <= 3 && remaining > 0 && workout.lastCue !== remaining) {
      workout.lastCue = remaining;
      beep(780, 0.06);
      vibrate(25);
    }
    if (remaining <= 0) {
      workout.position = 0;
      beginCurrentStage();
      return;
    }
  } else {
    if (remaining <= 3 && remaining > 0 && workout.lastCue !== remaining) {
      workout.lastCue = remaining;
      beep(760, 0.06);
      vibrate(25);
    }
    if (remaining <= 0) {
      advanceWorkout();
      return;
    }
  }
  renderWorkout();
}

function beginCurrentStage() {
  const stage = workout.sequence[workout.position];
  if (!stage) return finishWorkout();
  workout.phase = stage.type;
  workout.remaining = stage.duration;
  workout.endsAt = Date.now() + stage.duration * 1000;
  workout.lastCue = null;
  beep(stage.type === 'rest' ? 520 : 880, 0.12);
  vibrate(60);
  renderWorkout();
}

function advanceWorkout() {
  workout.position += 1;
  if (workout.position >= workout.sequence.length) {
    finishWorkout();
    return;
  }
  beginCurrentStage();
}

function finishWorkout() {
  clearInterval(timerInterval);
  timerInterval = null;
  releaseWakeLock();
  beep(980, 0.18);
  setTimeout(() => beep(1220, 0.18), 170);
  vibrate([80, 80, 180]);
  const name = workout?.routine?.name || 'Séance';
  workout = null;
  toast(`${name} terminée !`);
  renderHome();
  setTimeout(() => showScreen('home-screen'), 450);
}

function renderWorkout() {
  if (!workout) return;
  let title = 'Prêt ?';
  let stageLabel = 'PRÉPARATION';
  let currentDuration = PREP_SECONDS;
  let next = workout.sequence[0];
  let progressPosition = 0;

  if (workout.phase !== 'prep') {
    const current = workout.sequence[workout.position];
    title = current?.title || 'Terminé';
    stageLabel = current?.type === 'rest' ? 'RÉCUPÉRATION' : 'EXERCICE';
    currentDuration = current?.duration || 1;
    next = workout.sequence[workout.position + 1];
    progressPosition = workout.position + 1;
  }

  $('stage-label').textContent = stageLabel;
  $('current-title').textContent = title;
  $('timer').textContent = String(workout.remaining);
  $('next-title').textContent = next ? next.title : 'Fin de la séance';
  $('next-duration').textContent = next ? clock(next.duration) : '✓';
  $('progress-text').textContent = `${Math.min(progressPosition, workout.sequence.length)} / ${workout.sequence.length}`;
  const elapsedRatio = currentDuration ? 1 - (workout.remaining / currentDuration) : 0;
  const completed = workout.phase === 'prep' ? 0 : workout.position / workout.sequence.length;
  const currentPart = (Math.max(0, Math.min(1, elapsedRatio))) / workout.sequence.length;
  $('progress-bar').style.width = `${Math.min(100, (completed + currentPart) * 100)}%`;
}

function togglePause() {
  if (!workout) return;
  if (!workout.paused) {
    workout.remaining = Math.max(0, Math.ceil((workout.endsAt - Date.now()) / 1000));
    workout.paused = true;
    $('pause-workout').textContent = '▶';
    releaseWakeLock();
  } else {
    workout.endsAt = Date.now() + workout.remaining * 1000;
    workout.paused = false;
    workout.lastCue = null;
    $('pause-workout').textContent = 'Ⅱ';
    requestWakeLock();
  }
  renderWorkout();
}

function skipWorkout() {
  if (!workout || workout.phase === 'prep') {
    if (workout) { workout.position = 0; beginCurrentStage(); }
    return;
  }
  advanceWorkout();
}

function stopWorkout() {
  clearInterval(timerInterval);
  timerInterval = null;
  releaseWakeLock();
  workout = null;
  renderHome();
  showScreen('home-screen');
}

function initAudio() {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch (_) {}
}

function beep(frequency, duration) {
  if (!audioContext) return;
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.13, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  } catch (_) {}
}

function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) {}
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}
function escapeAttr(value) { return escapeHtml(value); }

$('backup-routines').addEventListener('click', exportRoutines);
$('restore-routines').addEventListener('click', () => $('restore-file').click());
$('restore-file').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file) importRoutines(file);
  e.target.value = '';
});
$('add-routine').addEventListener('click', () => openEditor());
$('empty-add').addEventListener('click', () => openEditor());
$('edit-routine').addEventListener('click', () => openEditor(selectedRoutineId));
$('save-routine').addEventListener('click', saveEditor);
$('delete-routine').addEventListener('click', deleteEditorRoutine);
$('add-exercise').addEventListener('click', () => {
  editorRoutine.exercises.push({ id: uid(), name: `Exercice ${editorRoutine.exercises.length + 1}`, duration: 30, restAfter: 30 });
  renderExerciseEditor();
});
$('pause-workout').addEventListener('click', togglePause);
$('skip-workout').addEventListener('click', skipWorkout);
$('stop-workout').addEventListener('click', stopWorkout);
document.querySelectorAll('[data-back="home"]').forEach(btn => btn.addEventListener('click', () => { renderHome(); showScreen('home-screen'); }));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && workout && !workout.paused) requestWakeLock();
});

renderHome();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
