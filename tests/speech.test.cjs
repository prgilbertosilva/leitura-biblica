const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup({ supported = true, voices = [], speakError = false } = {}) {
  const nodes = new Map();
  const timers = new Map();
  let timerId = 0;
  const calls = [];
  const synth = {
    paused: false,
    getVoices: () => voices,
    addEventListener(name, handler) { this[name] = handler; },
    cancel() {
      calls.push('cancel');
      // Android may dispatch the cancellation event immediately.
      const previous = this.current;
      this.current = null;
      previous?.onerror?.({ error: 'interrupted' });
    },
    resume() { calls.push('resume'); this.paused = false; },
    pause() { throw new Error('Native pause must not be used on Android'); },
    speak(utterance) {
      if (speakError) throw new Error('Unavailable engine');
      calls.push(utterance);
      this.current = utterance;
    },
  };
  const window = {
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  if (supported) window.speechSynthesis = synth;
  const context = vm.createContext({
    window, URL, Intl, Map, Set,
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    document: {
      currentScript: { src: 'https://example.test/leitura-biblica/app.js?v=test' },
      querySelector(id) {
        if (!nodes.has(id)) nodes.set(id, {
          textContent: '', innerText: '', classList: { toggle() {} },
          setAttribute() {},
        });
        return nodes.get(id);
      },
    },
  });
  const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  vm.runInContext(source.replace(/^init\(\);/m, '') + `\nthis.api = {
    state, speechState, toggleSpeech, stopSpeech, splitSpeechText,
    preferredPortugueseVoice, primeSpeechVoices, updateSpeechButton,
    speechTextForReading, scriptureFromBible
  };`, context);
  const api = context.api;
  api.state.active = {
    date: '2026-07-16', oldTestament: 'Eclesiastes 7-8', newTestament: 'Colossenses 3',
    message: 'Reflexão antes da leitura. '.repeat(40),
  };
  nodes.get('#oldText').innerText = 'Há tempo para tudo. '.repeat(80);
  nodes.get('#newText').innerText = 'Busquem as coisas do alto. '.repeat(50);
  return {
    ...api, context, nodes, synth, calls, timers,
    flush(delay) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay !== delay) continue;
        timers.delete(id);
        timer.fn();
      }
    },
    spoken: () => calls.filter(item => typeof item === 'object'),
  };
}

test('long readings play every short chunk in order and return to idle', () => {
  const t = setup();
  const expected = t.splitSpeechText(t.speechTextForReading(t.state.active));
  t.toggleSpeech();
  assert.equal(t.spoken().length, 1, 'first speak must run synchronously in the tap');
  for (let i = 0; i < expected.length; i++) {
    const utterance = t.synth.current;
    assert.equal(utterance.text, expected[i]);
    assert.ok(utterance.text.length <= 180);
    assert.equal(utterance.lang, 'pt-BR');
    utterance.onstart();
    utterance.onend();
    t.flush(60);
  }
  assert.equal(t.spoken().length, expected.length);
  assert.equal(t.speechState.speaking, false);
  assert.equal(t.timers.size, 0);
});

test('Android pause cancels and continue replays only the current short chunk', () => {
  const t = setup();
  t.toggleSpeech();
  const old = t.synth.current;
  t.toggleSpeech();
  assert.equal(t.speechState.paused, true);
  assert.equal(t.timers.size, 0);
  t.toggleSpeech();
  const current = t.synth.current;
  assert.notEqual(current, old);
  assert.equal(current.text, old.text);
  old.onend();
  old.onerror({ error: 'interrupted' });
  assert.equal(t.speechState.utterance, current);
  assert.equal(t.speechState.chunkIndex, 0);
});

test('pausing between chunks preserves the next unread chunk', () => {
  const t = setup();
  t.toggleSpeech();
  t.synth.current.onend();
  const next = t.speechState.chunks[1];
  t.toggleSpeech();
  t.flush(60);
  assert.equal(t.spoken().length, 1);
  t.toggleSpeech();
  assert.equal(t.synth.current.text, next);
});

test('stopping for navigation prevents old callbacks and timers from changing a new reading', () => {
  const t = setup();
  t.toggleSpeech();
  const old = t.synth.current;
  old.onend();
  t.stopSpeech();
  t.flush(60);
  assert.equal(t.spoken().length, 1);
  t.state.active.message = 'Outra leitura.';
  t.toggleSpeech();
  const current = t.synth.current;
  old.onerror({ error: 'canceled' });
  old.onend();
  assert.equal(t.speechState.utterance, current);
  assert.equal(t.speechState.chunkIndex, 0);
});

test('voice selection prefers local Brazilian Portuguese and never forces an unrelated language', () => {
  const en = { lang: 'en-US' };
  const remote = { lang: 'pt-BR', localService: false };
  const local = { lang: 'pt_BR', localService: true };
  assert.equal(setup({ voices: [en, remote, local] }).preferredPortugueseVoice(), local);
  assert.equal(setup({ voices: [en] }).preferredPortugueseVoice(), null);
});

test('empty voices do not defer initial speak; voiceschanged updates following chunks', () => {
  const voices = [];
  const t = setup({ voices });
  t.primeSpeechVoices();
  t.toggleSpeech();
  assert.equal(t.spoken().length, 1);
  assert.equal(t.synth.current.voice, undefined);
  const local = { lang: 'pt-BR', localService: true };
  voices.push(local);
  t.synth.voiceschanged();
  t.synth.current.onend();
  t.flush(60);
  assert.equal(t.synth.current.voice, local);
});

test('an unavailable voice retries the same text once with the default engine', () => {
  const t = setup({ voices: [{ lang: 'pt-BR' }] });
  t.toggleSpeech();
  const first = t.synth.current;
  first.onerror({ error: 'voice-unavailable' });
  t.flush(60);
  const retry = t.synth.current;
  assert.equal(retry.text, first.text);
  assert.equal(retry.voice, undefined);
  retry.onerror({ error: 'language-unavailable' });
  t.flush(60);
  assert.equal(t.spoken().length, 2);
  assert.equal(t.speechState.speaking, false);
  assert.match(t.nodes.get('#audioStatus').textContent, /Texto para voz/);
});

test('a silent engine times out and leaves a useful message and working retry button', () => {
  const t = setup();
  t.toggleSpeech();
  t.flush(10000);
  assert.equal(t.speechState.speaking, false);
  assert.equal(t.timers.size, 0);
  assert.match(t.nodes.get('#audioStatus').textContent, /Chrome/);
  t.toggleSpeech();
  assert.equal(t.spoken().length, 2);
  assert.equal(t.nodes.get('#audioStatus').textContent, '');
});

test('autoplay denial, exceptions and unsupported embedded browsers have visible recovery', () => {
  const t = setup();
  t.toggleSpeech();
  t.synth.current.onerror({ error: 'not-allowed' });
  assert.match(t.nodes.get('#audioStatus').textContent, /Toque novamente/);
  const unavailable = setup({ speakError: true });
  unavailable.toggleSpeech();
  assert.equal(unavailable.speechState.speaking, false);
  const embedded = setup({ supported: false });
  embedded.updateSpeechButton();
  assert.equal(embedded.nodes.get('#listenButton').disabled, true);
  assert.match(embedded.nodes.get('#audioStatus').textContent, /WhatsApp/);
});

test('an existing native paused state is released before speaking', () => {
  const t = setup();
  t.synth.paused = true;
  t.toggleSpeech();
  assert.ok(t.calls.indexOf('resume') < t.calls.indexOf(t.synth.current));
});

test('punctuation, whitespace and very long tokens split without losing content', () => {
  const t = setup();
  for (const text of ['', 'Um: dois; três! Quatro? Fim.', 'á'.repeat(1000), 'Palavra '.repeat(200)]) {
    const chunks = t.splitSpeechText(text);
    assert.ok(chunks.every(chunk => chunk.length > 0 && chunk.length <= 180));
    assert.equal(chunks.join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
  }
});

test('all registered readings preserve complete Bible text in bounded audio chunks', () => {
  const t = setup();
  for (const file of ['leituras.js', 'biblia-nvi.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../data', file), 'utf8'), t.context);
  }
  const readings = t.context.window.LEITURAS_DATA;
  assert.ok(readings.length > 0);
  for (const reading of readings) {
    for (const [reference, id] of [[reading.oldTestament, '#oldText'], [reading.wisdom, '#wisdomText'], [reading.newTestament, '#newText']]) {
      t.nodes.get(id).innerText = reference ? t.scriptureFromBible(reference)
        .map(chapter => [chapter.title, ...chapter.verses.map(verse => verse.t)].join(' ')).join(' ') : '';
    }
    const text = t.speechTextForReading(reading);
    const chunks = t.splitSpeechText(text);
    assert.ok(chunks.every(chunk => chunk.length <= 180), reading.date);
    assert.equal(chunks.join('').replace(/\s/g, ''), text.replace(/\s/g, ''), reading.date);
  }
});
