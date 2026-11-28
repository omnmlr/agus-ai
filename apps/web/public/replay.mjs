const replay = document.querySelector('[data-replay]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const command = replay.querySelector('[data-replay-command]');
const events = [...replay.querySelectorAll('[data-event]')];
const chapters = [...replay.querySelectorAll('[data-step]')];
const toggle = replay.querySelector('[data-replay-toggle]');
const toggleLabel = replay.querySelector('[data-replay-toggle-label]');
const progress = replay.querySelector('.replay-progress i');
const announcement = replay.querySelector('[data-replay-announcement]');
const chain = replay.querySelector('[data-replay-chain]');
const outputs = Object.fromEntries(['state', 'detail', 'evidence', 'value', 'device'].map(field =>
  [field, replay.querySelector('[data-replay-' + field + ']')]));
const timeline = events.map(event => ({
  at: Number(event.dataset.at), chapter: Number(event.dataset.chapter), screen: event.dataset.screen,
  title: event.querySelector('strong').textContent,
}));
const commandText = replay.dataset.command;
const duration = timeline.at(-1).at;
let time = 0;
let activeEvent = -1;
let activeChapter = -1;
let playing = false;
let inView = true;
let frame = 0;
let previous = null;
let logFrame = '';

function update() {
  const eventIndex = timeline.findLastIndex(event => event.at <= time);
  const event = timeline[eventIndex];
  if (eventIndex !== activeEvent) {
    activeEvent = eventIndex;
    replay.dataset.screen = event.screen;
    outputs.device.textContent = event.title;
    if (activeChapter !== event.chapter) {
      activeChapter = event.chapter;
      const chapter = chapters[activeChapter].dataset;
      for (const field of ['state', 'detail', 'evidence', 'value']) outputs[field].textContent = chapter[field];
      outputs.value.title = chapter.fullValue || chapter.value;
      chapters.forEach((button, index) => button.setAttribute('aria-pressed', String(activeChapter === index)));
      chain.hidden = activeChapter !== chapters.length - 1;
    }
  }
  const typing = playing && !reduced.matches && time < 1520;
  const nextText = typing ? commandText.slice(0, Math.floor(commandText.length * time / 1520)) : commandText;
  if (command.textContent !== nextText) command.textContent = nextText;
  const nextLogFrame = typing ? 'typing' : eventIndex;
  if (nextLogFrame !== logFrame) {
    logFrame = nextLogFrame;
    events.forEach((row, index) => { row.hidden = typing || index > eventIndex || index <= eventIndex - 4; });
  }
  progress.style.transform = 'scaleX(' + (time / duration) + ')';
}

function queue() {
  if (playing && inView && !document.hidden && !frame) frame = requestAnimationFrame(tick);
}

function playback(on) {
  playing = on;
  replay.dataset.playing = String(on);
  toggleLabel.textContent = on ? 'Pause replay' : time === duration ? 'Replay' : time > 0 ? 'Resume replay' : 'Play replay';
  cancelAnimationFrame(frame);
  frame = 0;
  previous = null;
  update();
  queue();
}

function tick(now) {
  frame = 0;
  if (previous !== null) time = Math.min(duration, time + Math.min(100, now - previous));
  previous = now;
  if (time === duration) {
    playback(false);
    announcement.textContent = 'Replay complete. The receipt attestation was verified on Solana Devnet.';
    return;
  }
  update();
  queue();
}

function choose(index) {
  time = timeline.findLast(event => event.chapter === index).at;
  playback(false);
  announcement.textContent = chapters[index].textContent + '. ' + outputs.state.textContent + '. ' + outputs.detail.textContent + '.';
}

toggle.addEventListener('click', () => {
  if (time === duration) time = 0;
  playback(!playing);
});
chapters.forEach((button, index) => {
  button.addEventListener('click', () => choose(index));
  button.addEventListener('keydown', event => {
    const direction = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[event.key];
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? chapters.length - 1
      : direction ? (index + direction + chapters.length) % chapters.length : null;
    if (next === null) return;
    event.preventDefault();
    choose(next);
    chapters[next].focus();
  });
});

function visibilityChanged() {
  cancelAnimationFrame(frame);
  frame = 0;
  previous = null;
  queue();
}
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    visibilityChanged();
  }, { threshold: .13 }).observe(replay);
}
document.addEventListener('visibilitychange', visibilityChanged);
reduced.addEventListener('change', update);
replay.querySelector('.replay-controls').hidden = false;
update();
