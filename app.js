const state = {
  readings: [],
  readingByDate: new Map(),
  active: null,
};

const appBaseUrl = new URL("./", document.currentScript.src);

const els = {
  title: document.querySelector("#pageTitle"),
  dayLabel: document.querySelector("#dayLabel"),
  summary: document.querySelector("#summaryText"),
  oldBlock: document.querySelector("#oldTestamentBlock"),
  wisdomBlock: document.querySelector("#wisdomBlock"),
  newBlock: document.querySelector("#newTestamentBlock"),
  oldReference: document.querySelector("#oldReference"),
  wisdomReference: document.querySelector("#wisdomReference"),
  newReference: document.querySelector("#newReference"),
  oldText: document.querySelector("#oldText"),
  wisdomText: document.querySelector("#wisdomText"),
  newText: document.querySelector("#newText"),
  reflection: document.querySelector("#reflectionText"),
  doneButton: document.querySelector("#doneButton"),
  doneNote: document.querySelector("#doneNote"),
  previousLink: document.querySelector("#previousLink"),
  nextLink: document.querySelector("#nextLink"),
  homeLink: document.querySelector("#homeLink"),
  todayButton: document.querySelector("#todayButton"),
  themeButton: document.querySelector("#themeButton"),
  shareButton: document.querySelector("#shareButton"),
  readingDatePicker: document.querySelector("#readingDatePicker"),
  openDateButton: document.querySelector("#openDateButton"),
  decreaseFontButton: document.querySelector("#decreaseFontButton"),
  increaseFontButton: document.querySelector("#increaseFontButton"),
  fontSizeLabel: document.querySelector("#fontSizeLabel"),
};

init();

async function init() {
  applySavedTheme();
  applySavedFontScale();
  bindActions();

  state.readings = await loadReadings();
  state.readingByDate = new Map(state.readings.map((reading) => [reading.date, reading]));

  const date = getDateFromPath() || todayIso();
  const reading = resolveAllowedReading(date);
  if (date > todayIso() && reading) {
    replaceUrlForDate(reading.date);
  }
  renderReading(reading);
}

async function loadReadings() {
  if (Array.isArray(window.LEITURAS_DATA)) {
    return window.LEITURAS_DATA;
  }

  const response = await fetch(new URL("data/leituras.json", appBaseUrl));
  return response.json();
}

function renderReading(reading) {
  state.active = reading;
  const formattedDate = formatDate(reading.date);
  const references = [reading.oldTestament, reading.wisdom, reading.newTestament].filter(Boolean);

  document.title = `Clube de Leitura da Biblia PIBA - ${formattedDate}`;
  els.dayLabel.textContent = `Leitura para hoje: ${formattedDate}`;
  els.title.textContent = references.join(" e ");
  els.summary.textContent = `Leia os capitulos na propria pagina, acompanhe a reflexao e marque a leitura como concluida ao terminar.`;

  renderSection(els.oldBlock, els.oldReference, els.oldText, reading.oldTestament, reading.oldText);
  renderSection(els.wisdomBlock, els.wisdomReference, els.wisdomText, reading.wisdom, reading.wisdomText);
  renderSection(els.newBlock, els.newReference, els.newText, reading.newTestament, reading.newText);

  els.reflection.textContent = reading.message || "Senhor, guia nossa mente e nosso coracao pela tua Palavra hoje.";

  const currentIndex = state.readings.findIndex((item) => item.date === reading.date);
  setNavLink(els.previousLink, state.readings[currentIndex - 1]);
  setNavLink(els.nextLink, readingAllowedByDate(state.readings[currentIndex + 1]) ? state.readings[currentIndex + 1] : null);
  els.homeLink.href = urlForDate(todayIso());
  updateDatePicker(reading);

  updateDoneState();
}

function renderSection(block, referenceEl, textEl, reference, scriptureText) {
  block.hidden = !reference;
  if (!reference) return;

  referenceEl.textContent = humanizeReference(reference);
  renderScriptureText(textEl, scriptureText, reference);
}

function renderScriptureText(container, value, reference) {
  container.replaceChildren();
  const textValue = value || scriptureFromBible(reference);

  if (!textValue) {
    const note = document.createElement("p");
    note.className = "scripture-empty";
    note.textContent = "Texto ainda nao encontrado na base local da Biblia.";
    container.append(note);
    return;
  }

  const blocks = Array.isArray(textValue) ? textValue : String(textValue).split(/\n{2,}/);
  for (const block of blocks) {
    if (block && typeof block === "object" && block.title && Array.isArray(block.verses)) {
      container.append(createChapterText(block));
    } else {
      const paragraph = document.createElement("p");
      paragraph.textContent = String(block).trim();
      container.append(paragraph);
    }
  }
}

function scriptureFromBible(reference) {
  if (!window.BIBLIA_NVI) return "";
  return chaptersFromReference(reference).map((chapter) => {
    const key = `${chapter.book} ${chapter.chapter}`;
    return {
      title: key,
      verses: window.BIBLIA_NVI[key] || [],
    };
  }).filter((chapter) => chapter.verses.length > 0);
}

function createChapterText(chapter) {
  const wrapper = document.createElement("article");
  wrapper.className = "scripture-chapter";

  const heading = document.createElement("h3");
  heading.textContent = chapter.title;
  wrapper.append(heading);

  for (const verse of chapter.verses) {
    const paragraph = document.createElement("p");
    const number = document.createElement("sup");
    number.textContent = verse.v;
    paragraph.append(number, " ", verse.t);
    wrapper.append(paragraph);
  }

  return wrapper;
}

function chaptersFromReference(reference) {
  const parts = normalizeText(reference)
    .replace(/\s+/g, " ")
    .split(/\s*(?:\+|\u00b7)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chapters = [];
  let lastBook = "";

  for (const part of parts) {
    const parsed = parseReferencePart(part, lastBook);
    if (!parsed) continue;
    lastBook = parsed.book;
    for (let chapter = parsed.start; chapter <= parsed.end; chapter += 1) {
      chapters.push({ book: parsed.book, chapter });
    }
  }

  return chapters;
}

function parseReferencePart(part, fallbackBook) {
  const match = part.match(/^(.+?)\s+(\d+)(?::\d+)?(?:\s*[–-]\s*(\d+)(?::\d+)?)?$/);
  if (match) {
    const book = canonicalBookName(match[1].trim());
    return {
      book,
      start: Number(match[2]),
      end: Number(match[3] || match[2]),
    };
  }

  const continuation = part.match(/^(\d+)(?::\d+)?(?:\s*[–-]\s*(\d+)(?::\d+)?)?$/);
  if (continuation && fallbackBook) {
    return {
      book: fallbackBook,
      start: Number(continuation[1]),
      end: Number(continuation[2] || continuation[1]),
    };
  }

  return null;
}

function canonicalBookName(book) {
  const aliases = {
    Salmo: "Salmos",
    Proverbio: "Proverbios",
  };
  return aliases[book] || book;
}

function humanizeReference(value) {
  return value.replace(/[–-]/g, " a ");
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00ba/g, "")
    .replace(/\u00aa/g, "");
}

function bindActions() {
  els.doneButton.addEventListener("click", toggleDone);
  els.todayButton.addEventListener("click", () => navigateToDate(todayIso()));
  els.shareButton.addEventListener("click", shareReading);
  els.readingDatePicker.addEventListener("change", openSelectedDate);
  els.openDateButton.addEventListener("click", openSelectedDate);
  els.themeButton.addEventListener("click", toggleTheme);
  els.decreaseFontButton.addEventListener("click", () => changeFontScale(-1));
  els.increaseFontButton.addEventListener("click", () => changeFontScale(1));
  window.addEventListener("popstate", () => {
    const date = getDateFromPath() || todayIso();
    renderReading(resolveAllowedReading(date));
  });
}

function updateDatePicker(reading) {
  els.readingDatePicker.min = planStartDate();
  els.readingDatePicker.max = todayIso();
  els.readingDatePicker.value = reading.date;
}

function openSelectedDate() {
  const selectedDate = normalizeDateInput(els.readingDatePicker.value);
  if (!selectedDate) return;
  navigateToDate(selectedDate);
}

function normalizeDateInput(value) {
  if (!value) return "";
  const cleanValue = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) return cleanValue;

  const brazilianDate = cleanValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brazilianDate) {
    return `${brazilianDate[3]}-${brazilianDate[2]}-${brazilianDate[1]}`;
  }

  return cleanValue;
}

function planStartDate() {
  return state.readings[0]?.date || todayIso();
}

function toggleDone() {
  const completed = getCompleted();
  let markedAsDone = false;
  if (completed.has(state.active.date)) {
    completed.delete(state.active.date);
  } else {
    completed.add(state.active.date);
    markedAsDone = true;
  }
  localStorage.setItem("piba.completedReadings", JSON.stringify([...completed]));
  updateDoneState();
  if (markedAsDone) {
    openCompletionMessage();
  }
}

function updateDoneState() {
  const completed = getCompleted();
  const isDone = completed.has(state.active.date);
  els.doneButton.classList.toggle("is-done", isDone);
  els.doneButton.textContent = isDone ? "Leitura concluida" : "Conclui minha leitura";
  els.doneNote.textContent = isDone ? "Parabens! Sua leitura de hoje ficou registrada neste aparelho." : "";
}

function getCompleted() {
  try {
    return new Set(JSON.parse(localStorage.getItem("piba.completedReadings") || "[]"));
  } catch {
    return new Set();
  }
}

function setNavLink(link, reading) {
  link.hidden = !reading;
  if (!reading) return;
  link.href = urlForDate(reading.date);
  link.onclick = (event) => {
    event.preventDefault();
    navigateToDate(reading.date);
  };
}

function navigateToDate(date) {
  const reading = readingForSelectedDate(normalizeDateInput(date));
  if (!reading) return;
  renderReading(reading);
  pushUrlForDate(reading.date);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function readingForSelectedDate(date) {
  if (date > todayIso()) {
    return state.readingByDate.get(todayIso()) || latestAvailableReading();
  }
  const reading = state.readingByDate.get(date);
  if (!reading) {
    els.readingDatePicker.value = state.active?.date || todayIso();
    els.doneNote.textContent = "Nao ha leitura cadastrada para esta data.";
    return null;
  }
  return reading;
}

function resolveAllowedReading(date) {
  if (date > todayIso()) {
    return state.readingByDate.get(todayIso()) || latestAvailableReading();
  }
  return state.readingByDate.get(date) || latestAvailableReading() || state.readings[0];
}

function latestAvailableReading() {
  const today = todayIso();
  return [...state.readings].reverse().find((reading) => reading.date <= today);
}

function readingAllowedByDate(reading) {
  return Boolean(reading && reading.date <= todayIso());
}

async function shareReading() {
  const text = whatsappText(state.active);
  if (navigator.share) {
    await navigator.share({ text });
    return;
  }
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function openCompletionMessage() {
  const text = "Amém 🙏 Concluí minha leitura de hoje!";
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function whatsappText(reading) {
  const formattedDate = formatDate(reading.date);
  const lines = [
    `📖 Leitura para hoje: ${formattedDate}`,
    "Bom dia! ☀️",
    "",
    reading.oldTestament ? `📘 ${humanizeReference(reading.oldTestament)}` : "",
    reading.wisdom ? `📙 ${humanizeReference(reading.wisdom)}` : "",
    reading.newTestament ? `📗 ${humanizeReference(reading.newTestament)}` : "",
    "",
    `🔗 Acesse a leitura de hoje:`,
    absoluteUrlForDate(reading.date),
    "",
    `🌱📖 ${reading.message}`,
    "",
    "Leu tudinho? Deixe o seu amem 🙌🙏",
  ];
  return lines.filter((line) => line !== "").join("\n");
}

function getDateFromPath() {
  const hashMatch = window.location.hash.match(/^#(\d{4}-\d{2}-\d{2})$/);
  if (hashMatch) return hashMatch[1];

  const match = window.location.pathname.match(/(\d{4})\/(\d{2})\/(\d{2})\/?$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function urlForDate(date) {
  const [year, month, day] = date.split("-");
  return new URL(`${year}/${month}/${day}/`, appBaseUrl).pathname;
}

function pushUrlForDate(date) {
  updateUrlForDate(date, "pushState");
}

function replaceUrlForDate(date) {
  updateUrlForDate(date, "replaceState");
}

function updateUrlForDate(date, method) {
  try {
    if (window.location.protocol === "file:") {
      history[method]({}, "", `#${date}`);
      return;
    }
    history[method]({}, "", urlForDate(date));
  } catch {
    window.location.hash = date;
  }
}

function absoluteUrlForDate(date) {
  return new URL(urlForDate(date), window.location.origin).href;
}

function todayIso() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function formatDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function applySavedTheme() {
  const theme = readPreference("piba.theme", "light");
  document.documentElement.dataset.theme = theme;
  els.themeButton.textContent = theme === "dark" ? "Sol" : "Lua";
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  writePreference("piba.theme", next);
  els.themeButton.textContent = next === "dark" ? "Sol" : "Lua";
}

function applySavedFontScale() {
  const saved = Number(readPreference("piba.fontScale", "100"));
  setFontScale(Number.isFinite(saved) ? saved : 100);
}

function changeFontScale(step) {
  const current = Number(readPreference("piba.fontScale", "100"));
  setFontScale(current + (step * 10));
}

function setFontScale(value) {
  const scale = Math.min(150, Math.max(90, value));
  document.documentElement.style.setProperty("--reader-scale", scale / 100);
  document.documentElement.dataset.fontScale = String(scale);
  writePreference("piba.fontScale", String(scale));
  els.fontSizeLabel.textContent = `${scale}%`;
  els.decreaseFontButton.disabled = scale <= 90;
  els.increaseFontButton.disabled = scale >= 150;
}

function readPreference(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Keep controls working even when browser storage is unavailable.
  }
}
