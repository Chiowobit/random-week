// Random Week
// Este archivo gestiona la lógica principal de la aplicación.
// La idea es separar responsabilidades: almacenamiento, tareas, planificación,
// configuración semanal y temporizadores. Cada bloque pequeño intenta tener una
// única responsabilidad para que el código sea más fácil de mantener.

// Este bloque define los nombres de los días y las claves del almacenamiento local.
// DAY_NAMES se usa para recorrer la semana y para crear la vista semanal.
const DAY_NAMES = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

const SCHEDULE_MINUTE_STEP = 15;
const SCHEDULE_MAX_SESSION_MINUTES = 90;
const SCHEDULE_LANE_WIDTH = 168;

// Mantiene los colores de categoría iguales en las notas del corcho y del horario.
const TASK_NOTE_COLORS = {
  hogar: "yellow",
  estudios: "blue",
  trabajo: "pink",
  recados: "lavender",
  ocio: "mint",
  autocuidado: "peach",
};

// STORAGE_KEYS guarda las llaves utilizadas en localStorage.
// Así evitamos mezclar datos de tareas, configuración, historial y temporizador.
const STORAGE_KEYS = {
  tasks: "randomWeek.tasks",
  weekConfig: "randomWeek.weekConfig",
  weekAvailability: "randomWeek.weekAvailability",
  scheduleView: "randomWeek.scheduleView",
  scheduleHistory: "randomWeek.scheduleHistory",
  history: "randomWeek.history",
  timer: "randomWeek.timer",
  completionSettings: "randomWeek.completionSettings",
  promptedEvents: "randomWeek.promptedEvents",
  visualTheme: "randomWeek.visualTheme",
};

// El catálogo describe cada capa sin ligarlas entre sí.
// Las opciones reservadas se identifican, pero permanecen desactivadas:
// localStorage no se considera un método seguro para desbloquear contenido comercial.
const THEME_CATALOG = {
  background: [
    { id: "space", label: "Espacio", free: true },
    { id: "cork", label: "Corcho clásico", free: true },
    { id: "forest", label: "Bosque · futuro paquete", free: false },
    { id: "ocean", label: "Océano · futuro paquete", free: false },
  ],
  stickyNotes: [
    { id: "galaxy", label: "Galaxia", free: true },
    { id: "pastel", label: "Pastel", free: true },
    { id: "neon", label: "Neón · futuro paquete", free: false },
  ],
  decorations: [
    { id: "flowers", label: "Flores", free: true },
    { id: "none", label: "Sin decoración", free: true },
    { id: "stars", label: "Estrellas · futuro paquete", free: false },
    { id: "moons", label: "Lunas · futuro paquete", free: false },
    { id: "tape-clips", label: "Cinta y clips · futuro paquete", free: false },
  ],
  interface: [
    { id: "lavender", label: "Lavanda", free: true },
    { id: "pink", label: "Rosa", free: true },
    { id: "blue", label: "Azul", free: true },
    { id: "green", label: "Verde", free: true },
  ],
};

// El estado visual es independiente de tareas, sesiones y disponibilidad.
const DEFAULT_THEME_PREFERENCES = {
  background: "space",
  stickyNotes: "galaxy",
  decorations: "flowers",
  interface: "lavender",
};

// defaultWeekConfig define la configuración inicial de cada día.
// Muestra horas disponibles, energía esperada y si ese día se considera descanso.
const defaultWeekConfig = {
  lunes: { availableMinutes: 180, energy: "medio", rest: false },
  martes: { availableMinutes: 220, energy: "medio", rest: false },
  miercoles: { availableMinutes: 160, energy: "bajo", rest: false },
  jueves: { availableMinutes: 200, energy: "alto", rest: false },
  viernes: { availableMinutes: 240, energy: "medio", rest: false },
  sabado: { availableMinutes: 180, energy: "alto", rest: false },
  domingo: { availableMinutes: 90, energy: "bajo", rest: true },
};

const DEFAULT_DAY_SCHEDULES = {
  lunes: { startTime: "09:00", endTime: "18:00" },
  martes: { startTime: "09:00", endTime: "18:00" },
  miercoles: { startTime: "10:00", endTime: "20:00" },
  jueves: { startTime: "09:00", endTime: "18:00" },
  viernes: { startTime: "09:00", endTime: "17:00" },
  sabado: { startTime: "10:00", endTime: "16:00" },
  domingo: { startTime: "10:00", endTime: "14:00" },
};

// state es el estado global de la aplicación.
// Aquí se guardan las tareas, la configuración semanal y el temporizador actual.
const state = {
  tasks: loadStoredItems(STORAGE_KEYS.tasks, defaultTasks()),
  weekConfig: loadStoredItems(STORAGE_KEYS.weekConfig, defaultWeekConfig),
  weekAvailability: loadWeekAvailability(),
  scheduleView: loadStoredItems(STORAGE_KEYS.scheduleView, "cork"),
  scheduleHistory: loadScheduleHistory(),
  scheduleResult: { schedule: [], unscheduled: [], conflicts: [], generated: false },
  history: loadStoredItems(STORAGE_KEYS.history, []),
  timer: loadStoredItems(STORAGE_KEYS.timer, getEmptyTimer()),
  completionSettings: loadCompletionSettings(),
  promptedEvents: loadPromptedEvents(),
  themePreferences: loadThemePreferences(),
  selectedTaskId: null,
};

// elements guarda referencias a los elementos del DOM.
// Así evitamos repetir document.getElementById varias veces en el código.
const elements = {
  taskForm: document.getElementById("task-form"),
  taskId: document.getElementById("task-id"),
  taskTitle: document.getElementById("task-title"),
  taskCategory: document.getElementById("task-category"),
  taskPriority: document.getElementById("task-priority"),
  taskDuration: document.getElementById("task-duration"),
  taskDifficulty: document.getElementById("task-difficulty"),
  taskFrequency: document.getElementById("task-frequency"),
  taskStartDate: document.getElementById("task-start-date"),
  taskScheduledDate: document.getElementById("task-scheduled-date"),
  taskDueDate: document.getElementById("task-due-date"),
  taskStartTime: document.getElementById("task-start-time"),
  taskScheduleType: document.getElementById("task-schedule-type"),
  taskPreferredTime: document.getElementById("task-preferred-time"),
  taskPreferredStartTime: document.getElementById("task-preferred-start-time"),
  taskFixedDayEnabled: document.getElementById("task-fixed-day-enabled"),
  taskFixedDay: document.getElementById("task-fixed-day"),
  fixedDayContainer: document.getElementById("fixed-day-container"),
  resetFormBtn: document.getElementById("reset-form-btn"),
  taskList: document.getElementById("task-list"),
  corkViewButton: document.getElementById("cork-view-button"),
  scheduleViewButton: document.getElementById("schedule-view-button"),
  corkView: document.getElementById("cork-view"),
  scheduleView: document.getElementById("schedule-view"),
  weeklySchedule: document.getElementById("weekly-schedule"),
  scheduleNoteDialog: document.getElementById("schedule-note-dialog"),
  scheduleNoteContent: document.getElementById("schedule-note-content"),
  scheduleNoteDetails: document.getElementById("schedule-note-details"),
  scheduleNoteActions: document.getElementById("schedule-note-actions"),
  scheduleMessages: document.getElementById("schedule-messages"),
  generateScheduleButton: document.getElementById("generate-schedule-button"),
  completionSettings: document.getElementById("completion-settings"),
  completionMode: document.getElementById("completion-mode"),
  askOnScheduledDate: document.getElementById("ask-on-scheduled-date"),
  askOnDeadline: document.getElementById("ask-on-deadline"),
  askOnTimerFinish: document.getElementById("ask-on-timer-finish"),
  weekConfig: document.getElementById("week-config"),
  copyAvailabilitySource: document.getElementById("copy-availability-source"),
  copyAvailabilityButton: document.getElementById("copy-availability-button"),
  deadlineList: document.getElementById("deadline-list"),
  timerTaskSelect: document.getElementById("timer-task-select"),
  timerMode: document.getElementById("timer-mode"),
  timerDuration: document.getElementById("timer-duration"),
  timerDisplay: document.getElementById("timer-display"),
  timerStatus: document.getElementById("timer-status"),
  corkBoard: document.getElementById("cork-board"),
  weeklyProgress: document.getElementById("weekly-progress"),
  themeBackground: document.getElementById("theme-background"),
  themeStickyNotes: document.getElementById("theme-sticky-notes"),
  themeDecorations: document.getElementById("theme-decorations"),
  themeInterface: document.getElementById("theme-interface"),
  themePreviewBoard: document.getElementById("theme-preview-board"),
  themeStatus: document.getElementById("theme-status"),
  resetThemeButton: document.getElementById("reset-theme-button"),
  startTimerBtn: document.getElementById("start-timer-btn"),
  pauseTimerBtn: document.getElementById("pause-timer-btn"),
  resumeTimerBtn: document.getElementById("resume-timer-btn"),
  finishTimerBtn: document.getElementById("finish-timer-btn"),
  cancelTimerBtn: document.getElementById("cancel-timer-btn"),
};

initializeApp();

// initializeApp arranca la app.
// Primero conecta eventos; después rellena el selector del temporizador y pinta interfaz.
function initializeApp() {
  // Cuando el navegador termina de cargar el DOM, vinculamos todos los eventos.
  bindEvents();
  populateTimerSelect();
  initializeThemeSettings();
  if (!["cork", "schedule"].includes(state.scheduleView)) state.scheduleView = "cork";
  applyThemePreferences();
  renderAll();
  processDateCompletionEvents();
  state.completionEventTicker = setInterval(processDateCompletionEvents, 60 * 1000);
}

// bindEvents conecta cada botón y cada formulario con la función que debe ejecutarse.
function bindEvents() {
  elements.taskForm.addEventListener("submit", handleTaskSubmit);
  elements.resetFormBtn.addEventListener("click", resetTaskForm);
  elements.taskFixedDayEnabled.addEventListener("change", toggleFixedDayInput);
  elements.taskList.addEventListener("click", handleTaskListClick);
  elements.corkBoard.addEventListener("click", handleTaskCompletionClick);
  elements.weeklySchedule.addEventListener("click", handleScheduleClick);
  elements.scheduleNoteDialog.addEventListener("click", handleScheduleNoteAction);
  // El atajo explícito hace que Escape cierre la ficha incluso en navegadores
  // que no implementan de forma uniforme el evento cancel del elemento dialog.
  elements.scheduleNoteDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      elements.scheduleNoteDialog.close();
    }
  });
  elements.scheduleNoteDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    elements.scheduleNoteDialog.close();
  });
  elements.corkViewButton.addEventListener("click", () => setScheduleView("cork"));
  elements.scheduleViewButton.addEventListener("click", () => setScheduleView("schedule"));
  elements.generateScheduleButton.addEventListener("click", () => {
    generateWeeklySchedule({ confirmManual: true });
    setScheduleView("schedule");
  });
  elements.completionSettings.addEventListener("change", handleCompletionSettingsChange);
  elements.weekConfig.addEventListener("input", handleWeekConfigInput);
  elements.weekConfig.addEventListener("change", handleWeekConfigInput);
  elements.copyAvailabilityButton.addEventListener("click", copyAvailabilityToDays);
  elements.timerTaskSelect.addEventListener("change", handleTimerTaskChange);
  elements.timerMode.addEventListener("change", syncTimerModeDefault);
  elements.startTimerBtn.addEventListener("click", startTimer);
  elements.pauseTimerBtn.addEventListener("click", pauseTimer);
  elements.resumeTimerBtn.addEventListener("click", resumeTimer);
  elements.finishTimerBtn.addEventListener("click", finishTimer);
  elements.cancelTimerBtn.addEventListener("click", cancelTimer);
  elements.themeBackground.addEventListener("change", handleThemePreferenceChange);
  elements.themeStickyNotes.addEventListener("change", handleThemePreferenceChange);
  elements.themeDecorations.addEventListener("change", handleThemePreferenceChange);
  elements.themeInterface.addEventListener("change", handleThemePreferenceChange);
  elements.resetThemeButton.addEventListener("click", restoreDefaultTheme);

  // Si el navegador lo permite, podemos mostrar notificaciones del temporizador.
  if ("Notification" in window) {
    Notification.requestPermission().catch(() => {
      // No es necesario romper la app si el usuario bloquea la notificación.
    });
  }
}

// defaultTasks crea un conjunto inicial de tareas para probar la app sin empezar desde cero.
function defaultTasks() {
  // Dejamos algunas tareas de ejemplo para que la app tenga una semana útil
  // apenas se abre. Si el usuario elimina todas, se podrán crear nuevas.
  const today = new Date();
  const isoToDateInput = (offsetDays) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offsetDays);
    return getDateInputValue(date);
  };

  return [
    {
      id: generateId(),
      title: "Estudiar",
      category: "estudios",
      priority: "alta",
      durationMinutes: 90,
      difficulty: 2,
      frequency: "semanal",
      preferredDays: ["martes", "jueves"],
      fixedDay: "",
      startDate: isoToDateInput(1),
      scheduledDate: isoToDateInput(1),
      startTime: "",
      scheduleType: "flexible",
      scheduleSessions: [],
      scheduleSource: "",
      dueDate: isoToDateInput(5),
      completed: false,
      active: true,
      timeWorkedMinutes: 0,
      remainingMinutes: 90,
    },
    {
      id: generateId(),
      title: "Ordenar la casa",
      category: "hogar",
      priority: "media",
      durationMinutes: 45,
      difficulty: 1,
      frequency: "semanal",
      preferredDays: ["sabado"],
      fixedDay: "",
      startDate: isoToDateInput(0),
      scheduledDate: isoToDateInput(0),
      startTime: "",
      scheduleType: "flexible",
      scheduleSessions: [],
      scheduleSource: "",
      dueDate: isoToDateInput(7),
      completed: false,
      active: true,
      timeWorkedMinutes: 0,
      remainingMinutes: 45,
    },
    {
      id: generateId(),
      title: "Revisión del proyecto profesional",
      category: "trabajo",
      priority: "urgente",
      durationMinutes: 120,
      difficulty: 3,
      frequency: "una_vez",
      preferredDays: ["viernes"],
      fixedDay: "",
      startDate: isoToDateInput(2),
      scheduledDate: isoToDateInput(2),
      startTime: "",
      scheduleType: "flexible",
      scheduleSessions: [],
      scheduleSource: "",
      dueDate: isoToDateInput(4),
      completed: false,
      active: true,
      timeWorkedMinutes: 0,
      remainingMinutes: 120,
    },
  ];
}

// Estos ajustes no modifican el estado de tareas: definen solo el modo y los avisos.
function getDefaultCompletionSettings() {
  return {
    mode: "manual",
    askOnScheduledDate: false,
    askOnDeadline: false,
    askOnTimerFinish: false,
  };
}

function loadCompletionSettings() {
  const defaults = getDefaultCompletionSettings();
  const stored = loadStoredItems(STORAGE_KEYS.completionSettings, defaults);
  const validModes = ["manual", "automatico", "preguntar"];
  const settings = stored && typeof stored === "object" ? stored : {};

  return {
    ...defaults,
    ...settings,
    mode: validModes.includes(settings.mode) ? settings.mode : defaults.mode,
    askOnScheduledDate: settings.askOnScheduledDate === true,
    askOnDeadline: settings.askOnDeadline === true,
    askOnTimerFinish: settings.askOnTimerFinish === true,
  };
}

function loadPromptedEvents() {
  const promptedEvents = loadStoredItems(STORAGE_KEYS.promptedEvents, []);
  return new Set(Array.isArray(promptedEvents) ? promptedEvents : []);
}

function loadWeekAvailability() {
  const stored = loadStoredItems(STORAGE_KEYS.weekAvailability, {});
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
}

function loadScheduleHistory() {
  const stored = loadStoredItems(STORAGE_KEYS.scheduleHistory, {});
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
}

// getEmptyTimer devuelve el estado inicial del temporizador.
// Cuando no hay una sesión activa, todo queda en valores por defecto.
function getEmptyTimer() {
  return {
    isRunning: false,
    taskId: null,
    mode: "pomodoro",
    durationMinutes: 25,
    remainingSeconds: 25 * 60,
    finishTimestamp: null,
    startedAt: null,
    totalSeconds: 25 * 60,
    status: "sin_iniciar",
  };
}

// generateId crea un identificador único para cada tarea.
// Se usa para no mezclar tareas con nombres parecidos.
function generateId() {
  return `task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

// loadStoredItems intenta leer un valor de localStorage.
// Si no existe, devuelve un valor de respaldo para que la app no falle.
function loadStoredItems(key, fallbackValue) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallbackValue;
  } catch (error) {
    console.warn("No se pudo leer localStorage:", error);
    return fallbackValue;
  }
}

// saveStoredItems guarda los datos para que persistan al recargar la página.
function saveStoredItems(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Valida cada capa por separado para ignorar valores antiguos o manipulados.
function normalizeThemePreferences(candidate) {
  const normalized = { ...DEFAULT_THEME_PREFERENCES };
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return normalized;
  }

  Object.keys(DEFAULT_THEME_PREFERENCES).forEach((layer) => {
    const isAvailable = THEME_CATALOG[layer].some(
      (option) => option.id === candidate[layer] && option.free
    );
    if (isAvailable) normalized[layer] = candidate[layer];
  });
  return normalized;
}

// Lee la preferencia visual con una clave propia; no mezcla datos de tareas ni temporizadores.
function loadThemePreferences() {
  try {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.visualTheme);
    return normalizeThemePreferences(savedTheme ? JSON.parse(savedTheme) : DEFAULT_THEME_PREFERENCES);
  } catch (error) {
    console.error("No se pudieron leer las preferencias visuales; se usará el tema inicial.", error);
    return { ...DEFAULT_THEME_PREFERENCES };
  }
}

// Genera los selectores desde el catálogo para que añadir opciones no duplique HTML.
function initializeThemeSettings() {
  const layerElements = {
    background: elements.themeBackground,
    stickyNotes: elements.themeStickyNotes,
    decorations: elements.themeDecorations,
    interface: elements.themeInterface,
  };

  Object.entries(layerElements).forEach(([layer, select]) => {
    select.dataset.themeLayer = layer;
    select.innerHTML = THEME_CATALOG[layer]
      .map((option) => `
        <option value="${option.id}" ${option.free ? "" : "disabled"}>
          ${escapeHtml(option.label)}${option.free ? " · Gratis" : ""}
        </option>
      `)
      .join("");
    select.value = state.themePreferences[layer];
  });

  renderThemePreview();
}

// Aplica cuatro atributos independientes al elemento raíz para que CSS combine capas.
function applyThemePreferences() {
  const root = document.documentElement;
  if (!root) return;

  root.dataset.themeBackground = state.themePreferences.background;
  root.dataset.themeStickyNotes = state.themePreferences.stickyNotes;
  root.dataset.themeDecorations = state.themePreferences.decorations;
  root.dataset.themeInterface = state.themePreferences.interface;

  document.querySelectorAll("[data-theme-sample]").forEach((sample) => {
    const layer = sample.dataset.themeSample;
    sample.dataset.value = state.themePreferences[layer];
  });
  renderThemePreview();
}

// La vista previa es solo presentación: no cambia ni guarda información de tareas.
function renderThemePreview() {
  elements.themePreviewBoard.innerHTML = `
    <article class="theme-preview__note post-it post-it--lavender">
      <span class="theme-preview__pin" aria-hidden="true"></span>
      <p class="eyebrow">Vista de ejemplo</p>
      <h4>Preparar una semana bonita</h4>
      <span class="task-tag">Estudios</span>
      <span class="task-tag">45 minutos</span>
    </article>
    <p class="theme-preview__caption">Fondo, papel, decoración e interfaz se combinan por separado.</p>
  `;
}

// Cambia solo la capa elegida, conserva las otras tres y guarda la combinación aparte.
function handleThemePreferenceChange(event) {
  const layer = event.currentTarget.dataset.themeLayer;
  const selection = THEME_CATALOG[layer]?.find((option) =>
    option.id === event.currentTarget.value && option.free
  );
  if (!selection) {
    event.currentTarget.value = state.themePreferences[layer];
    elements.themeStatus.textContent = "Esa opción no está disponible en esta versión.";
    return;
  }

  state.themePreferences[layer] = selection.id;
  applyThemePreferences();
  try {
    localStorage.setItem(STORAGE_KEYS.visualTheme, JSON.stringify(state.themePreferences));
    elements.themeStatus.textContent = "Tema actualizado y guardado en este navegador.";
  } catch (error) {
    elements.themeStatus.textContent = "El tema se aplicó, pero el navegador no pudo guardarlo.";
    console.error("No se pudieron guardar las preferencias visuales.", error);
  }
}

// Recupera el conjunto inicial, sin tocar el resto del almacenamiento de la aplicación.
function restoreDefaultTheme() {
  state.themePreferences = { ...DEFAULT_THEME_PREFERENCES };
  Object.entries({
    background: elements.themeBackground,
    stickyNotes: elements.themeStickyNotes,
    decorations: elements.themeDecorations,
    interface: elements.themeInterface,
  }).forEach(([layer, select]) => {
    select.value = state.themePreferences[layer];
  });
  applyThemePreferences();

  try {
    localStorage.setItem(STORAGE_KEYS.visualTheme, JSON.stringify(state.themePreferences));
    elements.themeStatus.textContent = "Se restauró la combinación inicial.";
  } catch (error) {
    elements.themeStatus.textContent = "El tema inicial se aplicó, pero no se pudo guardar.";
    console.error("No se pudieron guardar las preferencias visuales restauradas.", error);
  }
}

// renderAll repinta toda la interfaz con los datos actuales del estado.
function renderAll() {
  renderTaskList();
  renderCompletionSettings();
  renderScheduleSettings();
  renderWeekConfig();
  renderDeadlines();
  renderTimer();
  renderCorkBoard();
  renderWeeklySchedule();
  renderScheduleView();
}

function setScheduleView(view) {
  state.scheduleView = view;
  saveStoredItems(STORAGE_KEYS.scheduleView, view);
  renderScheduleView();
}

function renderScheduleView() {
  const showSchedule = state.scheduleView === "schedule";
  elements.corkView.classList.toggle("hidden", showSchedule);
  elements.scheduleView.classList.toggle("hidden", !showSchedule);
  elements.corkViewButton.setAttribute("aria-pressed", String(!showSchedule));
  elements.scheduleViewButton.setAttribute("aria-pressed", String(showSchedule));
}

function renderScheduleSettings() {
  const messageItems = [
    ...state.scheduleResult.conflicts.map(({ task, date, reason }) =>
      `<li><strong>${escapeHtml(task.title)}</strong> (${formatDate(date)}): ${escapeHtml(reason)}</li>`
    ),
    ...state.scheduleResult.unscheduled.map(({ task, reason }) =>
      `<li><strong>${escapeHtml(task.title)}</strong>: ${escapeHtml(reason)}</li>`
    ),
  ];
  elements.scheduleMessages.innerHTML = messageItems.length
    ? `<ul>${messageItems.join("")}</ul>`
    : state.scheduleResult.generated || state.tasks.some((task) => getTaskSessions(task).length)
      ? '<p class="schedule-success">No hay conflictos ni tareas pendientes de ubicar.</p>'
      : '<p>Genera el horario para colocar las tareas flexibles en los huecos disponibles.</p>';
}

// renderCorkBoard representa en el tablero el estado real de las tareas guardadas.
function renderCorkBoard() {
  const currentWeek = getCurrentWeekDates();
  const tasksByDay = new Map(currentWeek.map(({ date }) => [getDateInputValue(date), []]));
  const activeTasks = state.tasks.filter((task) => task.active);

  activeTasks.forEach((task) => {
    const scheduledDate = getTaskScheduledDate(task);
    if (!scheduledDate) return;
    const dayTasks = tasksByDay.get(getDateInputValue(scheduledDate));
    if (dayTasks) dayTasks.push(task);
  });

  elements.corkBoard.innerHTML = currentWeek.map(({ date, dayName }) => {
    const dayTasks = tasksByDay.get(getDateInputValue(date));
    const config = state.weekConfig[dayName] || defaultWeekConfig[dayName];
    const totalMinutes = dayTasks.reduce((sum, task) => sum + task.durationMinutes, 0);
    const notes = dayTasks.length
      ? dayTasks.map((task, index) => renderTaskPostIt(task, index, date)).join("")
      : '<p class="empty-day">Un espacio para respirar</p>';

    return `
      <section class="cork-day" aria-label="${capitalize(dayName)}, ${formatDate(date)}">
        <header class="cork-day__heading">
          <div class="cork-day__title-row">
            <h3>${capitalize(dayName)}</h3>
            <time class="cork-day__date">${formatDate(date)}</time>
          </div>
          <div class="cork-day__stats">
            <span>${dayTasks.length} ${dayTasks.length === 1 ? "tarea" : "tareas"}</span>
            <span>${totalMinutes} min</span>
          </div>
          <span class="energy-chip">Energía: ${capitalize(config.energy)}</span>
        </header>
        <div class="cork-day__notes">${notes}</div>
      </section>
    `;
  }).join("");

  const completedCount = activeTasks.filter(isTaskCompleted).length;
  const unscheduledCount = state.scheduleResult.unscheduled.length;
  elements.weeklyProgress.textContent =
    `Completadas: ${completedCount} de ${activeTasks.length} tareas activas` +
    (unscheduledCount ? ` · ${unscheduledCount} sin horario` : "");
}

// Agrupa intervalos que se cruzan y asigna a cada uno la primera columna libre.
// Las columnas se reutilizan al terminar un bloque; un bloque puede abarcar
// columnas contiguas si ninguna tarea de esas columnas coincide con él.
function distributeScheduleColumns(items) {
  const sorted = items
    .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start)
    .sort((a, b) => a.start - b.start || b.end - a.end || a.task.id.localeCompare(b.task.id));
  const result = [];
  let component = [];
  let componentEnd = -1;

  const placeComponent = () => {
    if (!component.length) return;
    const laneEnds = [];
    component.forEach((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = item.end;
      item.column = lane;
    });

    component.forEach((item) => {
      let span = 1;
      for (let lane = item.column + 1; lane < laneEnds.length; lane += 1) {
        const laneHasOverlap = component.some((other) =>
          other.column === lane && intervalsOverlap(item.start, item.end, other.start, other.end)
        );
        if (laneHasOverlap) break;
        span += 1;
      }
      item.columnSpan = span;
      item.columnCount = laneEnds.length;
      item.conflicts = component
        .filter((other) => other !== item && intervalsOverlap(item.start, item.end, other.start, other.end))
        .map((other) => other.task.title);
      result.push(item);
    });
    component = [];
    componentEnd = -1;
  };

  sorted.forEach((item) => {
    if (component.length && item.start >= componentEnd) placeComponent();
    component.push({ ...item });
    componentEnd = Math.max(componentEnd, item.end);
  });
  placeComponent();

  items.filter((item) => !Number.isFinite(item.start) || !Number.isFinite(item.end) || item.end <= item.start)
    .forEach((item) => result.push({ ...item, column: 0, columnSpan: 1, columnCount: 1, conflicts: [] }));
  return result;
}

// Devuelve la clase de color segura para una categoría, usando amarillo si es nueva o desconocida.
function getTaskColorClass(category) {
  return TASK_NOTE_COLORS[category] || "yellow";
}

function renderWeeklySchedule() {
  const weekDates = getCurrentWeekDates();
  // La escala deja bloques distinguibles sin inventar altura que oculte intervalos.
  const pixelsPerMinute = 1.2;
  const sessions = state.tasks
    .filter((task) => task.active && !isTaskCompleted(task))
    .flatMap((task) => getTaskSessions(task).map((session, sessionIndex) => ({ task, session, sessionIndex })));
  const runningTimerSession = getRunningTimerSession();
  if (runningTimerSession) sessions.push(runningTimerSession);

  // El eje se amplía a la disponibilidad y a todos los bloques para no recortar
  // horarios válidos configurados antes de las 06:00 o después de las 23:00.
  const visibleTimes = weekDates.flatMap(({ dayName }) => {
    const config = getDayScheduleConfig(dayName);
    return [
      config.startTime,
      config.endTime,
      ...config.unavailablePeriods.flatMap((period) => [period.start, period.end]),
    ];
  }).concat(sessions.flatMap(({ session }) => [session.startTime, session.endTime]))
    .map(timeToMinutes)
    .filter((minute) => minute !== null);
  const scheduleStart = Math.floor(Math.min(...visibleTimes) / 60) * 60;
  const scheduleEnd = Math.min(24 * 60, Math.ceil(Math.max(...visibleTimes) / 60) * 60);
  const rangeEnd = scheduleEnd > scheduleStart ? scheduleEnd : Math.min(24 * 60, scheduleStart + 60);
  const gridHeight = (rangeEnd - scheduleStart) * pixelsPerMinute;

  const timeScale = [];
  for (let hour = Math.ceil(scheduleStart / 60); hour * 60 <= rangeEnd; hour += 1) {
    const top = (hour * 60 - scheduleStart) * pixelsPerMinute;
    timeScale.push(`<span class="schedule-time-label" style="top:${top}px">${String(hour).padStart(2, "0")}:00</span>`);
  }

  // Calculamos una distribución independiente por día para dar al carril el ancho
  // que necesita. El contenedor desplazable podrá mostrar todas las columnas.
  const scheduleDays = weekDates.map(({ date, dayName }) => {
    const dateKey = getDateInputValue(date);
    const config = getDayScheduleConfig(dayName);
    const daySessions = sessions.filter(({ session }) => session.date === dateKey);
    const layout = distributeScheduleColumns(daySessions.map((item) => ({
      ...item,
      start: timeToMinutes(item.session.startTime),
      end: timeToMinutes(item.session.endTime),
    })));
    const laneCount = layout.reduce((max, item) => Math.max(max, item.columnCount), 1);
    return { date, dayName, dateKey, config, layout, laneCount };
  });
  const scheduleColumnWidths = scheduleDays
    .map(({ laneCount }) => `minmax(${laneCount * SCHEDULE_LANE_WIDTH}px, 1fr)`)
    .join(" ");

  elements.weeklySchedule.innerHTML = `
    <div class="schedule-grid" style="--schedule-grid-height:${gridHeight}px;grid-template-columns:56px ${scheduleColumnWidths}">
      <div class="schedule-time-column"><div class="schedule-day-heading">Hora</div><div class="schedule-time-scale">${timeScale.join("")}</div></div>
      ${scheduleDays.map(({ date, dayName, config, layout, laneCount }) => {
        const availabilityStart = timeToMinutes(config.startTime);
        const availabilityEnd = timeToMinutes(config.endTime);
        const bands = config.dayOff
          ? `<div class="schedule-unavailable schedule-day-off" style="top:0;height:${gridHeight}px">Día de descanso</div>`
          : `
            <div class="schedule-availability" style="top:${Math.max(0, availabilityStart - scheduleStart) * pixelsPerMinute}px;height:${Math.max(0, Math.min(rangeEnd, availabilityEnd) - Math.max(scheduleStart, availabilityStart)) * pixelsPerMinute}px"></div>
            ${config.unavailablePeriods.map((period) => {
              const start = timeToMinutes(period.start);
              const end = timeToMinutes(period.end);
              const clippedStart = Math.max(scheduleStart, start);
              const clippedEnd = Math.min(rangeEnd, end);
              if (clippedEnd <= clippedStart) return "";
              return `<div class="schedule-unavailable" style="top:${(clippedStart - scheduleStart) * pixelsPerMinute}px;height:${(clippedEnd - clippedStart) * pixelsPerMinute}px">${escapeHtml(period.label)}</div>`;
            }).join("")}
          `;
        const taskBlocks = layout.map(({ task, session, sessionIndex, start, end, column, columnSpan, conflicts: visualOverlaps }) => {
          if (start === null || end === null || end <= start) return "";
          const top = (start - scheduleStart) * pixelsPerMinute;
          const height = (end - start) * pixelsPerMinute;
          const type = task.scheduleType === "fixed" ? "schedule-task--fixed" : "";
          if (task.id === "active-timer") {
            return `<div class="schedule-task schedule-task--timer" style="top:${top}px;height:${height}px;left:${column * SCHEDULE_LANE_WIDTH + 3}px;width:${columnSpan * SCHEDULE_LANE_WIDTH - 6}px"><strong>Temporizador en curso</strong><span>${session.startTime}-${session.endTime}</span></div>`;
          }
          const planningConflict = state.scheduleResult.conflicts.some((conflict) =>
            conflict.task.id === task.id && conflict.date === session.date
          );
          const categoryClass = `post-it--${getTaskColorClass(task.category)}`;
          return `
            <button type="button" class="schedule-task ${type} ${categoryClass}${planningConflict ? " schedule-task--conflict" : ""}"
              style="top:${top}px;height:${height}px;left:${column * SCHEDULE_LANE_WIDTH + 3}px;width:${columnSpan * SCHEDULE_LANE_WIDTH - 6}px"
              data-action="open-note" data-task-id="${escapeHtml(task.id)}" data-session-index="${sessionIndex}"
              aria-haspopup="dialog" aria-label="Abrir nota: ${escapeHtml(task.title)}, ${session.startTime}, ${session.durationMinutes} minutos${visualOverlaps.length ? ", coincide visualmente con otra tarea" : ""}${planningConflict ? ", conflicto de planificación" : ""}"
              data-has-conflict="${planningConflict}"
              title="${escapeHtml(task.title)} · ${session.startTime}-${session.endTime}. Pulsa para abrir detalles.">
              <strong>${escapeHtml(task.title)}</strong>
              <span>${session.startTime} · ${session.durationMinutes} min</span>
              <span class="schedule-task__open-hint">Abrir nota ↗</span>
              ${planningConflict ? '<span class="schedule-task__conflict">Conflicto</span>' : ""}
            </button>
            ${session.breakMinutes ? `<span class="schedule-break" style="top:${(end - scheduleStart) * pixelsPerMinute}px;height:${session.breakMinutes * pixelsPerMinute}px">Descanso</span>` : ""}
          `;
        }).join("");

        return `
          <section class="schedule-day-column" aria-label="${capitalize(dayName)}, ${formatDate(date)}">
            <header class="schedule-day-heading"><strong>${capitalize(dayName)}</strong><span>${formatDate(date)}</span></header>
            <div class="schedule-time-grid" style="height:${gridHeight}px;--schedule-hour-height:${60 * pixelsPerMinute}px;min-width:${laneCount * SCHEDULE_LANE_WIDTH}px">
              ${bands}
              ${taskBlocks}
              ${timeScale.map((_, hourIndex) =>
                `<span class="schedule-hour-line" style="top:${hourIndex * 60 * pixelsPerMinute}px"></span>`
              ).join("")}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

// Cada post-it se construye desde la tarea guardada, no desde datos de demostración.
function renderTaskPostIt(task, index, assignedDate) {
  const colorClass = getTaskColorClass(task.category);
  const rotation = [-1.2, 0.8, -0.5][index % 3];
  const completed = isTaskCompleted(task);
  const completedClass = completed ? " post-it--done" : "";
  const completedMark = completed ? '<span class="post-it__check" aria-label="Completada">✓</span>' : "";
  const dueLabel = task.dueDate
    ? `<span class="post-it__deadline">Límite: ${formatDate(task.dueDate)}</span>`
    : "";
  const overdueLabel = isTaskOverdue(task) ? '<span class="overdue-label">Retrasada</span>' : "";
  const firstSession = getTaskSessions(task)[0];
  const scheduledLabel = task.scheduledDate
    ? `Programada: ${formatDate(task.scheduledDate)}${firstSession ? ` · ${firstSession.startTime}-${firstSession.endTime}` : ""}`
    : `Asignada: ${formatDate(assignedDate)}`;

  return `
    <article class="post-it post-it--${colorClass}${completedClass}"
      style="--note-rotation: ${rotation}deg"
      aria-label="${escapeHtml(task.title)}, ${completed ? "completada" : "pendiente"}">
      <h4 class="post-it__title">
        ${completedMark}
        <span class="post-it__title-text">${escapeHtml(task.title)}</span>
      </h4>
      <div class="post-it__meta">
        <span class="task-tag">${capitalize(task.category)}</span>
        <span class="task-tag">Prioridad: ${escapeHtml(task.priority)}</span>
        <span class="task-tag">${task.durationMinutes} min</span>
      </div>
      <span class="post-it__scheduled">${scheduledLabel}</span>
      ${dueLabel}
      ${overdueLabel}
      <button type="button" class="small-btn ${completed ? "secondary-btn" : "primary-btn"}"
        data-action="toggle-completion" data-task-id="${escapeHtml(task.id)}"
        aria-pressed="${completed}">${completed ? "Reabrir tarea" : "Marcar completada"}</button>
    </article>
  `;
}

// renderTaskList pinta todas las tareas en la lista visible del usuario.
// Si no hay tareas, muestra un mensaje claro en lugar de dejar el espacio vacío.
function renderTaskList() {
  if (!state.tasks.length) {
    elements.taskList.innerHTML = "<p class='empty-state'>Todavía no hay tareas. Añade la primera.</p>";
    return;
  }

  elements.taskList.innerHTML = state.tasks
    .map((task) => {
      const preferredDays = task.preferredDays && task.preferredDays.length ? task.preferredDays.join(", ") : "Sin preferencia";
      const completed = isTaskCompleted(task);
      const sessions = getTaskSessions(task);
      const scheduleDescription = sessions.length
        ? sessions.map((session) => `${formatDate(session.date)} ${session.startTime}-${session.endTime}`).join(" · ")
        : "Sin horario asignado";
      return `
        <article class="task-card" data-task-card-id="${escapeHtml(task.id)}">
          <div class="task-header">
            <strong>${escapeHtml(task.title)}</strong>
            <span class="badge ${task.category}">${capitalize(task.category)}</span>
          </div>

          <div class="task-meta">
            <span class="priority-${task.priority}">${capitalize(task.priority)}</span>
            <span>${task.durationMinutes} min</span>
            <span>Dificultad ${task.difficulty}</span>
          </div>

          <div class="task-meta">
            <span>Programada: ${task.scheduledDate ? formatDate(task.scheduledDate) : "Sin fecha programada"}</span>
            <span>${escapeHtml(scheduleDescription)}</span>
            <span>Horario ${task.scheduleType === "fixed" ? "fijo" : "flexible"}</span>
            <span>${task.startDate ? `Disponible desde: ${formatDate(task.startDate)}` : "Sin fecha inicial de disponibilidad"}</span>
            <span>${task.dueDate ? `Límite: ${formatDate(task.dueDate)}` : "Sin fecha límite"}</span>
            <span>${completed ? "Completada" : "Pendiente"}</span>
            ${isTaskOverdue(task) ? '<span class="overdue-label">Retrasada</span>' : ""}
            <span>${task.active ? "Activa" : "Inactiva"}</span>
          </div>

          <div class="task-meta">
            <span>Prefiere: ${escapeHtml(preferredDays)}</span>
          </div>

          <div class="task-actions">
            <button type="button" class="small-btn ${completed ? "secondary-btn" : "primary-btn"}" data-action="toggle-completion" data-task-id="${escapeHtml(task.id)}" aria-pressed="${completed}">${completed ? "Reabrir tarea" : "Marcar completada"}</button>
            <button type="button" class="small-btn secondary-btn" data-action="toggle-task" data-task-id="${task.id}">${task.active ? "Desactivar" : "Activar"}</button>
            <button type="button" class="small-btn secondary-btn" data-action="edit-task" data-task-id="${task.id}">Editar</button>
            <button type="button" class="small-btn secondary-btn" data-action="reschedule-task" data-task-id="${task.id}">Reprogramar</button>
            <button type="button" class="small-btn danger-btn" data-action="delete-task" data-task-id="${task.id}">Eliminar</button>
            <button type="button" class="small-btn primary-btn" data-action="select-timer-task" data-task-id="${task.id}">Usar timer</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCompletionSettings() {
  const settings = state.completionSettings;
  elements.completionMode.value = settings.mode;
  elements.askOnScheduledDate.checked = settings.askOnScheduledDate;
  elements.askOnDeadline.checked = settings.askOnDeadline;
  elements.askOnTimerFinish.checked = settings.askOnTimerFinish;
}

// renderWeekConfig crea una tarjeta por cada día de la semana.
// Esto permite ajustar tiempo disponible, energía y descanso por día.
function renderWeekConfig() {
  const copyOptions = DAY_NAMES.map((dayName) =>
    `<option value="${dayName}">${capitalize(dayName)}</option>`
  ).join("");
  elements.copyAvailabilitySource.innerHTML = copyOptions;

  elements.weekConfig.innerHTML = DAY_NAMES.map((dayName) => {
    const config = getDayScheduleConfig(dayName);
    const unavailableText = config.unavailablePeriods
      .map((period) => `${period.start}-${period.end}${period.label ? ` ${period.label}` : ""}`)
      .join("\n");
    return `
      <div class="day-card schedule-config-card">
        <div class="day-header">
          <h3>${capitalize(dayName)}</h3>
          <span class="badge">${config.energy}</span>
        </div>

        <div class="two-columns">
          <label>Desde
            <input type="time" value="${config.startTime}" data-day="${dayName}" data-field="startTime" />
          </label>
          <label>Hasta
            <input type="time" value="${config.endTime}" data-day="${dayName}" data-field="endTime" />
          </label>
        </div>
        <label>Periodos sin disponibilidad
          <textarea rows="3" data-day="${dayName}" data-field="unavailablePeriods" placeholder="12:00-13:00 Comida">${escapeHtml(unavailableText)}</textarea>
        </label>
        <div class="two-columns">
          <label>Descanso entre tareas (min)
            <input type="number" min="0" max="120" step="5" value="${config.breakMinutes}" data-day="${dayName}" data-field="breakMinutes" />
          </label>
          <label class="toggle-row">
            <input type="checkbox" data-day="${dayName}" data-field="breakEnabled" ${config.breakEnabled ? "checked" : ""} />
            Reservar descansos
          </label>
        </div>
        <label class="toggle-row">
          <input type="checkbox" data-day="${dayName}" data-field="dayOff" ${config.dayOff ? "checked" : ""} />
          Día completo de descanso / sin disponibilidad
        </label>

        <label>
          Minutos disponibles
          <input type="number" min="0" max="720" value="${config.availableMinutes}" data-day="${dayName}" data-field="availableMinutes" />
        </label>

        <label>
          Energía esperada
          <select data-day="${dayName}" data-field="energy">
            <option value="bajo" ${config.energy === "bajo" ? "selected" : ""}>Bajo</option>
            <option value="medio" ${config.energy === "medio" ? "selected" : ""}>Medio</option>
            <option value="alto" ${config.energy === "alto" ? "selected" : ""}>Alto</option>
          </select>
        </label>

        <label class="toggle-row">
          <input type="checkbox" data-day="${dayName}" data-field="rest" ${config.rest ? "checked" : ""} />
          Descanso / disponibilidad reducida
        </label>
      </div>
    `;
  }).join("");
}

// renderDeadlines muestra las tareas activas ordenadas por fecha límite.
function renderDeadlines() {
  const upcoming = state.tasks
    .filter((task) => task.active && task.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 8);

  if (!upcoming.length) {
    elements.deadlineList.innerHTML = "<li class='deadline-item'>No hay tareas con fecha límite.</li>";
    return;
  }

  elements.deadlineList.innerHTML = upcoming
    .map(
      (task) => {
        const overdue = isTaskOverdue(task);
        return `
        <li class="deadline-item">
          <span>${escapeHtml(task.title)}</span>
          <span>${overdue ? '<strong class="overdue-label">Retrasada</strong>' : ""} <strong>${formatDate(task.dueDate)}</strong></span>
        </li>
      `;
      }
    )
    .join("");
}

function renderTimer() {
  populateTimerSelect();

  const timer = state.timer;
  const totalSeconds = Math.max(0, timer.totalSeconds || 0);
  const remaining = Math.max(0, timer.remainingSeconds || 0);

  elements.timerMode.value = timer.mode || "pomodoro";
  elements.timerDuration.value = timer.durationMinutes || 25;
  elements.timerDisplay.textContent = formatSeconds(remaining || totalSeconds);
  elements.timerStatus.textContent = getTimerStatusText(timer);

  const activeTask = getTaskById(timer.taskId || state.selectedTaskId || state.tasks[0]?.id);
  if (activeTask) {
    elements.timerTaskSelect.value = activeTask.id;
  }

  // Deshabilitamos botones según el estado del temporizador para tomar decisiones
  // más explícitas en la interfaz.
  const running = !!timer.isRunning;
  elements.pauseTimerBtn.disabled = !running;
  elements.resumeTimerBtn.disabled = running || timer.remainingSeconds === 0 || timer.status !== "pausado";
  elements.startTimerBtn.disabled = running;
  elements.finishTimerBtn.disabled =
    !timer.taskId || (!running && timer.status === "sin_iniciar") || timer.status === "finalizado";
}

function populateTimerSelect() {
  if (!state.tasks.length) {
    elements.timerTaskSelect.innerHTML = '<option value="">Sin tareas</option>';
    return;
  }

  const currentValue = state.selectedTaskId || state.timer.taskId || state.tasks[0].id;
  elements.timerTaskSelect.innerHTML = state.tasks
    .map(
      (task) =>
        `<option value="${task.id}" ${task.id === currentValue ? "selected" : ""}>${escapeHtml(task.title)}</option>`
    )
    .join("");
}

function handleTaskSubmit(event) {
  event.preventDefault();

  const title = elements.taskTitle.value.trim();
  if (!title) {
    alert("Debes escribir un nombre para la tarea.");
    return;
  }

  const id = elements.taskId.value || generateId();
  const existingTask = state.tasks.find((item) => item.id === id);
  const durationMinutes = Number(elements.taskDuration.value) || 30;
  const scheduledDate = elements.taskScheduledDate.value;
  const startTime = elements.taskStartTime.value;
  const scheduleType = elements.taskScheduleType.value || "flexible";
  if (scheduleType === "fixed" && (!scheduledDate || !startTime)) {
    alert("Un horario fijo necesita un día programado y una hora de inicio.");
    return;
  }

  const existingSessions = existingTask ? getTaskSessions(existingTask) : [];
  const scheduleChanged = existingTask
    ? scheduleType !== (existingTask.scheduleType || "flexible") ||
      (Boolean(startTime) && (
        existingTask.scheduledDate !== scheduledDate ||
        (existingSessions[0]?.startTime || "") !== startTime ||
        existingTask.durationMinutes !== durationMinutes
      )) ||
      (existingSessions.length > 0 && !startTime)
    : Boolean(startTime);
  let proposedSession = null;
  if (startTime && scheduledDate) {
    const start = timeToMinutes(startTime);
    const sessionDuration = existingTask && existingTask.durationMinutes === durationMinutes
      ? getTaskRemainingMinutes(existingTask)
      : Math.max(0, durationMinutes - (existingTask?.timeWorkedMinutes || 0));
    const end = start === null ? null : start + sessionDuration;
    if (end === null || end > 24 * 60) {
      alert("La duración supera el final del día. Elige una hora de inicio anterior.");
      return;
    }
    proposedSession = {
      date: scheduledDate,
      startTime,
      endTime: minutesToTime(end),
      durationMinutes: sessionDuration,
      breakMinutes: 0,
    };
  }

  const task = {
    id,
    title,
    category: elements.taskCategory.value,
    priority: elements.taskPriority.value,
    durationMinutes,
    difficulty: Number(elements.taskDifficulty.value) || 2,
    frequency: elements.taskFrequency.value,
    preferredDays: Array.from(document.querySelectorAll('input[name="preferredDays"]:checked')).map((input) => input.value),
    startDate: elements.taskStartDate.value,
    scheduledDate,
    dueDate: elements.taskDueDate.value,
    startTime,
    endTime: proposedSession ? proposedSession.endTime : "",
    scheduleType,
    preferredTime: elements.taskPreferredTime.value || "cualquiera",
    preferredStartTime: elements.taskPreferredStartTime.value,
    scheduleSessions: existingTask ? (existingTask.scheduleSessions || []) : [],
    scheduleSource: existingTask ? (existingTask.scheduleSource || "") : "",
    fixedDay: elements.taskFixedDayEnabled.checked ? elements.taskFixedDay.value : "",
    completed: existingTask ? isTaskCompleted(existingTask) : false,
    active: existingTask ? existingTask.active : true,
    timeWorkedMinutes: existingTask ? existingTask.timeWorkedMinutes : 0,
    remainingMinutes: existingTask
      ? (existingTask.durationMinutes === durationMinutes
        ? existingTask.remainingMinutes
        : Math.max(0, durationMinutes - (existingTask.timeWorkedMinutes || 0)))
      : durationMinutes,
  };

  if (scheduleChanged) {
    if (!proposedSession) {
      task.scheduleSessions = [];
      task.scheduleSource = "";
    } else {
      const conflicts = getManualScheduleConflicts(task, proposedSession);
      if (conflicts.length) {
        const alternatives = findAlternativeScheduleSlots(task);
        if (!alternatives.length) {
          alert(`Conflicto de horario: ${conflicts.join(" ")} No hay alternativas disponibles antes de la fecha límite.`);
          return;
        }
        const alternative = alternatives[0];
        const accepted = window.confirm(
          `Conflicto: ${conflicts.join(" ")}\nAlternativa disponible: ${formatDate(alternative.date)} ${alternative.startTime}-${alternative.endTime}.\n¿Usar esta alternativa?`
        );
        if (!accepted) return;
        task.scheduledDate = alternative.date;
        task.startTime = alternative.startTime;
        task.endTime = alternative.endTime;
        task.scheduleType = "flexible";
        task.scheduleSource = "manual";
        task.scheduleSessions = [{ ...alternative, breakMinutes: 0 }];
      } else {
        task.scheduleSessions = [proposedSession];
        task.scheduleSource = "manual";
      }
    }
  }

  const existingIndex = state.tasks.findIndex((item) => item.id === id);
  if (existingIndex >= 0) {
    state.tasks[existingIndex] = { ...state.tasks[existingIndex], ...task };
  } else {
    state.tasks.push(task);
  }

  saveStoredItems(STORAGE_KEYS.tasks, state.tasks);
  resetTaskForm();
  renderAll();
}

function resetTaskForm() {
  elements.taskForm.reset();
  elements.taskId.value = "";
  elements.taskDuration.value = 60;
  elements.taskDifficulty.value = 2;
  elements.taskPriority.value = "media";
  elements.taskCategory.value = "hogar";
  elements.taskStartTime.value = "";
  elements.taskScheduleType.value = "flexible";
  elements.taskPreferredTime.value = "cualquiera";
  elements.taskPreferredStartTime.value = "";
  elements.taskFixedDayEnabled.checked = false;
  toggleFixedDayInput();
}

function toggleFixedDayInput() {
  const isVisible = elements.taskFixedDayEnabled.checked;
  elements.fixedDayContainer.classList.toggle("hidden", !isVisible);
}

function handleTaskListClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const { action, taskId } = button.dataset;
  if (!taskId) return;

  if (action === "toggle-completion") {
    handleTaskCompletionClick(event);
    return;
  }

  if (action === "delete-task") {
    state.tasks = state.tasks.filter((task) => task.id !== taskId);
    saveStoredItems(STORAGE_KEYS.tasks, state.tasks);
    renderAll();
    return;
  }

  if (action === "toggle-task") {
    const task = getTaskById(taskId);
    if (!task) return;
    task.active = !task.active;
    saveStoredItems(STORAGE_KEYS.tasks, state.tasks);
    renderAll();
    return;
  }

  if (action === "select-timer-task") {
    state.selectedTaskId = taskId;
    state.timer.taskId = taskId;
    saveStoredItems(STORAGE_KEYS.timer, state.timer);
    renderTimer();
    return;
  }

  if (action === "edit-task") {
    const task = getTaskById(taskId);
    if (!task) return;
    populateTaskForm(task);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (action === "reschedule-task") {
    const task = getTaskById(taskId);
    if (!task) return;
    populateTaskForm(task);
    elements.taskScheduleType.value = "flexible";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function populateTaskForm(task) {
  elements.taskId.value = task.id;
  elements.taskTitle.value = task.title;
  elements.taskCategory.value = task.category;
  elements.taskPriority.value = task.priority;
  elements.taskDuration.value = task.durationMinutes;
  elements.taskDifficulty.value = String(task.difficulty);
  elements.taskFrequency.value = task.frequency;
  elements.taskStartDate.value = task.startDate || "";
  const firstSession = getTaskSessions(task)[0];
  elements.taskScheduledDate.value = firstSession?.date || task.scheduledDate || "";
  elements.taskDueDate.value = task.dueDate || "";
  elements.taskStartTime.value = firstSession?.startTime || task.startTime || "";
  elements.taskScheduleType.value = task.scheduleType || "flexible";
  elements.taskPreferredTime.value = task.preferredTime || "cualquiera";
  elements.taskPreferredStartTime.value = task.preferredStartTime || "";
  elements.taskFixedDayEnabled.checked = Boolean(task.fixedDay);
  elements.taskFixedDay.value = task.fixedDay || "";
  toggleFixedDayInput();

  document.querySelectorAll('input[name="preferredDays"]').forEach((input) => {
    input.checked = (task.preferredDays || []).includes(input.value);
  });
}

function handleScheduleClick(event) {
  const button = event.target.closest("button[data-action='open-note']");
  if (!button) return;
  event.stopPropagation();
  const task = getTaskById(button.dataset.taskId);
  if (!task) return;

  const session = getTaskSessions(task)[Number(button.dataset.sessionIndex)] || getTaskSessions(task)[0];
  if (!session) return;
  openScheduleNote(task, session);
}

function openScheduleNote(task, session) {
  const workedMinutes = Math.max(0, Number(task.timeWorkedMinutes) || 0);
  const remainingMinutes = getTaskRemainingMinutes(task);
  const progress = task.durationMinutes
    ? Math.min(100, Math.round(workedMinutes / task.durationMinutes * 100))
    : 0;
  const completed = isTaskCompleted(task);
  // Una coincidencia indica que las notas se dibujan en paralelo; por sí sola
  // no se presenta como conflicto de planificación.
  const visualCoincidences = state.tasks
    .filter((otherTask) => otherTask.id !== task.id && otherTask.active && !isTaskCompleted(otherTask))
    .filter((otherTask) => getTaskSessions(otherTask).some((otherSession) =>
      otherSession.date === session.date &&
      intervalsOverlap(
        timeToMinutes(session.startTime),
        timeToMinutes(session.endTime),
        timeToMinutes(otherSession.startTime),
        timeToMinutes(otherSession.endTime)
      )
    ))
    .map((otherTask) => otherTask.title);
  const planningConflicts = state.scheduleResult.conflicts
    .filter((conflict) => conflict.task.id === task.id && conflict.date === session.date)
    .map((conflict) => conflict.reason);
  const coincidenceMessage = visualCoincidences.length
    ? `<p class="schedule-note__coincidence">Comparte franja horaria con: ${visualCoincidences.map(escapeHtml).join(", ")}. Las notas se muestran en columnas paralelas.</p>`
    : "";
  const conflictMessage = planningConflicts.length
    ? `<p class="schedule-note__warning" role="alert">Conflicto de planificación: ${planningConflicts.map(escapeHtml).join(" ")}</p>`
    : "";
  const sessionIndex = getTaskSessions(task).indexOf(session);
  elements.scheduleNoteContent.className = `schedule-note post-it post-it--${getTaskColorClass(task.category)}`;

  elements.scheduleNoteDetails.innerHTML = `
    <p class="eyebrow">Nota del horario · ${formatDate(session.date)}</p>
    <h2 id="schedule-note-title">${escapeHtml(task.title)}</h2>
    ${coincidenceMessage}
    ${conflictMessage}
    <dl class="schedule-note__facts">
      <div><dt>Categoría</dt><dd>${escapeHtml(capitalize(task.category || "otro"))}</dd></div>
      <div><dt>Horario</dt><dd>${session.startTime}-${session.endTime} · ${session.durationMinutes} min</dd></div>
      <div><dt>Prioridad</dt><dd>${escapeHtml(capitalize(task.priority || "media"))}</dd></div>
      <div><dt>Fecha límite</dt><dd>${task.dueDate ? formatDate(task.dueDate) : "Sin fecha límite"}</dd></div>
      <div><dt>Progreso</dt><dd>${workedMinutes} min trabajados · ${remainingMinutes} min restantes (${progress}%)</dd></div>
      <div><dt>Estado</dt><dd>${completed ? "Completada" : isTaskOverdue(task) ? "Pendiente · retrasada" : "Pendiente"}</dd></div>
    </dl>
    <div class="schedule-note__progress" role="progressbar" aria-label="Progreso de la tarea" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
      <span style="width:${progress}%"></span>
    </div>
  `;
  elements.scheduleNoteActions.innerHTML = `
    <button type="button" class="primary-btn" data-action="dialog-edit" data-task-id="${escapeHtml(task.id)}">Editar</button>
    <button type="button" class="secondary-btn" data-action="dialog-move" data-task-id="${escapeHtml(task.id)}" data-session-index="${sessionIndex}">Mover</button>
    <button type="button" class="secondary-btn" data-action="dialog-complete" data-task-id="${escapeHtml(task.id)}" aria-pressed="${completed}">${completed ? "Reabrir tarea" : "Completar"}</button>
    <button type="button" class="secondary-btn" data-action="dialog-details" data-task-id="${escapeHtml(task.id)}">Ver ficha completa</button>
  `;
  elements.scheduleNoteDialog.showModal();
  elements.scheduleNoteDialog.querySelector("[data-action='close-note']").focus();
}

function handleScheduleNoteAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    if (event.target === elements.scheduleNoteDialog) elements.scheduleNoteDialog.close();
    return;
  }
  event.stopPropagation();
  const { action, taskId } = button.dataset;
  if (action === "close-note") {
    elements.scheduleNoteDialog.close();
    return;
  }
  const task = getTaskById(taskId);
  if (!task) return;

  if (action === "dialog-complete") {
    elements.scheduleNoteDialog.close();
    updateTaskCompletion(task, !isTaskCompleted(task));
    return;
  }
  if (action === "dialog-edit" || action === "dialog-move") {
    const session = getTaskSessions(task)[Number(button.dataset.sessionIndex)] || getTaskSessions(task)[0];
    elements.scheduleNoteDialog.close();
    populateTaskForm(task);
    if (action === "dialog-move" && session) {
      elements.taskScheduledDate.value = session.date;
      elements.taskStartTime.value = session.startTime;
      elements.taskScheduleType.value = "flexible";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (action === "dialog-details") {
    elements.scheduleNoteDialog.close();
    const card = Array.from(elements.taskList.querySelectorAll("[data-task-card-id]"))
      .find((item) => item.dataset.taskCardId === taskId);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
}

// Comprueba la nueva ubicación contra la disponibilidad, los periodos ocupados y
// todas las sesiones existentes, sin mover ni sobrescribir ninguna otra tarea.
function getManualScheduleConflicts(task, proposedSession) {
  const conflicts = [];
  const start = timeToMinutes(proposedSession.startTime);
  const end = timeToMinutes(proposedSession.endTime);
  const date = parseDateInput(proposedSession.date);
  const dayName = getCurrentWeekDates().find(({ date: weekDate }) =>
    getDateInputValue(weekDate) === proposedSession.date
  )?.dayName;
  if (start === null || end === null || !date || !dayName) {
    return ["El día o la hora no pertenecen a la semana visible."];
  }

  const config = getDayScheduleConfig(dayName);
  const dayStart = timeToMinutes(config.startTime);
  const dayEnd = timeToMinutes(config.endTime);
  if (config.dayOff || start < dayStart || end > dayEnd) {
    conflicts.push(`El horario está fuera de la disponibilidad de ${dayName}.`);
  }
  if (task.startDate && proposedSession.date < task.startDate) {
    conflicts.push("La tarea aún no está disponible en ese día.");
  }
  if (task.dueDate && proposedSession.date > task.dueDate) {
    conflicts.push("El día elegido queda después de la fecha límite.");
  }
  const occupiedEnd = Math.min(dayEnd, end + (config.breakEnabled ? config.breakMinutes : 0));
  if (config.unavailablePeriods.some((period) =>
    intervalsOverlap(start, end, timeToMinutes(period.start), timeToMinutes(period.end))
  )) {
    conflicts.push("El horario coincide con un periodo de indisponibilidad.");
  }

  state.tasks.filter((otherTask) =>
    otherTask.id !== task.id && otherTask.active && !isTaskCompleted(otherTask)
  ).forEach((otherTask) => {
    getTaskSessions(otherTask).forEach((session) => {
      if (
        session.date === proposedSession.date &&
        intervalsOverlap(start, occupiedEnd, timeToMinutes(session.startTime), timeToMinutes(session.endTime) + (config.breakEnabled ? config.breakMinutes : 0))
      ) {
        conflicts.push(`Se solapa con «${otherTask.title}» (${session.startTime}-${session.endTime}).`);
      }
    });
  });
  const runningTimer = getRunningTimerSession();
  if (runningTimer && runningTimer.session.date === proposedSession.date) {
    if (intervalsOverlap(
      start,
      occupiedEnd,
      timeToMinutes(runningTimer.session.startTime),
      timeToMinutes(runningTimer.session.endTime)
    )) {
      conflicts.push("El horario coincide con el temporizador que está en curso.");
    }
  }
  return conflicts;
}

function findAlternativeScheduleSlots(task) {
  const weekDates = getCurrentWeekDates();
  const occupancy = new Map();
  state.tasks.filter((otherTask) =>
    otherTask.id !== task.id && otherTask.active && !isTaskCompleted(otherTask)
  ).forEach((otherTask) => {
    getTaskSessions(otherTask).forEach((session) => {
      if (!occupancy.has(session.date)) occupancy.set(session.date, []);
      const sessionEnd = timeToMinutes(session.endTime);
      const dayName = weekDates.find(({ date }) => getDateInputValue(date) === session.date)?.dayName;
      const config = dayName ? getDayScheduleConfig(dayName) : null;
      occupancy.get(session.date).push({
        start: timeToMinutes(session.startTime),
        end: sessionEnd + (config?.breakEnabled ? config.breakMinutes : 0),
        duration: sessionEnd - timeToMinutes(session.startTime),
        type: "task",
        label: otherTask.title,
      });
    });
  });

  const duration = getTaskRemainingMinutes(task) || Number(task.durationMinutes) || 30;
  return getCandidateScheduleDates(task, weekDates)
    .map((entry) => ({ entry, slot: findScheduleSlot(task, entry, duration, occupancy) }))
    .filter(({ slot }) => slot)
    .sort((a, b) => b.slot.score - a.slot.score)
    .slice(0, 3)
    .map(({ entry, slot }) => ({
      date: getDateInputValue(entry.date),
      startTime: minutesToTime(slot.start),
      endTime: minutesToTime(slot.end),
      durationMinutes: duration,
    }));
}

function handleTaskCompletionClick(event) {
  const button = event.target.closest("button");
  if (!button || button.dataset.action !== "toggle-completion") return;

  const task = getTaskById(button.dataset.taskId);
  if (!task) return;
  updateTaskCompletion(task, !isTaskCompleted(task));
}

function updateTaskCompletion(task, completed) {
  task.completed = completed;
  if ("status" in task) task.status = completed ? "completed" : "pending";
  saveStoredItems(STORAGE_KEYS.tasks, state.tasks);
  renderAll();
}

// En modo Preguntar los eventos abren una confirmación; nunca cambian el estado por sí solos.
function processDateCompletionEvents(today = getDateInputValue(new Date())) {
  if (state.completionSettings.mode !== "preguntar") return;

  state.tasks.forEach((task) => {
    if (!task.active || isTaskCompleted(task)) return;

    if (state.completionSettings.askOnScheduledDate && task.scheduledDate && task.scheduledDate <= today) {
      requestCompletionConfirmation(task, "askOnScheduledDate", "la fecha programada", task.scheduledDate);
    }

    if (!isTaskCompleted(task) && state.completionSettings.askOnDeadline && task.dueDate && task.dueDate <= today) {
      requestCompletionConfirmation(task, "askOnDeadline", "la fecha límite", task.dueDate);
    }
  });
}

function requestCompletionConfirmation(task, setting, eventLabel, eventDate) {
  if (state.completionSettings.mode !== "preguntar" || !state.completionSettings[setting] || isTaskCompleted(task)) {
    return;
  }

  const promptKey = `${task.id}:${setting}:${eventDate}`;
  if (state.promptedEvents.has(promptKey)) return;

  // Se persiste la solicitud para no repetirla en cada repintado ni al recargar.
  state.promptedEvents.add(promptKey);
  saveStoredItems(STORAGE_KEYS.promptedEvents, Array.from(state.promptedEvents));
  if (window.confirm(`Se ha cumplido ${eventLabel} para «${task.title}». ¿Quieres marcarla como completada?`)) {
    updateTaskCompletion(task, true);
  }
}

function handleCompletionSettingsChange(event) {
  const setting = event.target.dataset.completionSetting;
  if (!setting) return;

  if (setting === "mode") {
    state.completionSettings.mode = event.target.value;
  } else {
    state.completionSettings[setting] = event.target.checked;
  }

  saveStoredItems(STORAGE_KEYS.completionSettings, state.completionSettings);
  renderCompletionSettings();
  processDateCompletionEvents();
}

function handleWeekConfigInput(event) {
  const target = event.target;
  const dayName = target.dataset.day;
  if (!dayName) return;

  const { field } = target.dataset;
  if (event.type === "input") return;

  const current = getDayScheduleConfig(dayName);
  const updated = { ...current, unavailablePeriods: current.unavailablePeriods.map((period) => ({ ...period })) };

  if (field === "startTime" || field === "endTime") updated[field] = target.value;
  if (field === "breakMinutes") updated.breakMinutes = Number(target.value);
  if (field === "breakEnabled" || field === "dayOff" || field === "rest") updated[field] = target.checked;
  if (field === "energy") updated.energy = target.value;
  if (field === "availableMinutes") updated.availableMinutes = Number(target.value) || 0;
  if (field === "unavailablePeriods") {
    const parsed = parseUnavailablePeriods(target.value);
    if (!parsed.valid) {
      alert(parsed.error);
      renderWeekConfig();
      return;
    }
    updated.unavailablePeriods = parsed.periods;
  }

  const validationError = validateDayScheduleConfig(updated);
  if (validationError) {
    alert(validationError);
    renderWeekConfig();
    return;
  }

  const applyToCurrentWeek = window.confirm(
    "¿Aplicar el cambio y reorganizar también la semana actual? Aceptar = semana actual; Cancelar = solo semanas futuras."
  );
  if (!state.weekAvailability[getCurrentWeekKey()]) {
    state.weekAvailability[getCurrentWeekKey()] = getAllDayScheduleConfigs();
  }

  const baseConfig = state.weekConfig[dayName] || defaultWeekConfig[dayName];
  state.weekConfig[dayName] = { ...baseConfig, ...updated };
  if (applyToCurrentWeek) {
    state.weekAvailability[getCurrentWeekKey()][dayName] = { ...updated };
  }
  if (field === "availableMinutes" || field === "energy" || field === "rest") {
    state.weekConfig[dayName][field] = updated[field];
  }

  saveStoredItems(STORAGE_KEYS.weekConfig, state.weekConfig);
  saveStoredItems(STORAGE_KEYS.weekAvailability, state.weekAvailability);
  if (applyToCurrentWeek) generateWeeklySchedule({ confirmManual: false });
  else renderAll();
}

function getDayScheduleConfig(dayName, weekKey = getCurrentWeekKey()) {
  const recurring = state.weekConfig[dayName] || defaultWeekConfig[dayName];
  const weekSpecific = state.weekAvailability[weekKey]?.[dayName] || {};
  return {
    ...defaultWeekConfig[dayName],
    ...DEFAULT_DAY_SCHEDULES[dayName],
    unavailablePeriods: [],
    breakEnabled: true,
    breakMinutes: 15,
    dayOff: false,
    ...recurring,
    ...weekSpecific,
    unavailablePeriods: Array.isArray(weekSpecific.unavailablePeriods)
      ? weekSpecific.unavailablePeriods
      : Array.isArray(recurring.unavailablePeriods)
        ? recurring.unavailablePeriods
        : [],
  };
}

function getAllDayScheduleConfigs() {
  return Object.fromEntries(DAY_NAMES.map((dayName) => [dayName, getDayScheduleConfig(dayName)]));
}

function getCurrentWeekKey() {
  return getDateInputValue(getCurrentWeekDates()[0].date);
}

function parseUnavailablePeriods(value) {
  const periods = [];
  for (const [index, rawLine] of String(value).split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})(?:\s+(.+))?$/.exec(line);
    if (!match) {
      return { valid: false, periods: [], error: `Formato incorrecto en la línea ${index + 1}. Usa HH:MM-HH:MM y, opcionalmente, un nombre.` };
    }
    const start = timeToMinutes(match[1]);
    const end = timeToMinutes(match[2]);
    if (start === null || end === null || end <= start) {
      return { valid: false, periods: [], error: `El periodo de la línea ${index + 1} debe terminar después de empezar.` };
    }
    periods.push({ start: match[1], end: match[2], label: match[3] || "No disponible" });
  }
  return { valid: true, periods };
}

function validateDayScheduleConfig(config) {
  const start = timeToMinutes(config.startTime);
  const end = timeToMinutes(config.endTime);
  if (start === null || end === null || end <= start) {
    return "La hora de inicio debe ser anterior a la hora máxima de finalización.";
  }
  if (!Number.isFinite(config.breakMinutes) || config.breakMinutes < 0 || config.breakMinutes > 120) {
    return "El descanso entre tareas debe estar entre 0 y 120 minutos.";
  }
  for (const period of config.unavailablePeriods) {
    const unavailableStart = timeToMinutes(period.start);
    const unavailableEnd = timeToMinutes(period.end);
    if (
      unavailableStart === null ||
      unavailableEnd === null ||
      unavailableStart < start ||
      unavailableEnd > end ||
      unavailableEnd <= unavailableStart
    ) {
      return `El periodo «${period.label}» debe estar dentro del horario disponible del día.`;
    }
  }
  return "";
}

function timeToMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

function minutesToTime(totalMinutes) {
  const safeMinutes = Math.max(0, Math.min(1439, totalMinutes));
  return `${String(Math.floor(safeMinutes / 60)).padStart(2, "0")}:${String(safeMinutes % 60).padStart(2, "0")}`;
}

function copyAvailabilityToDays() {
  const sourceDay = elements.copyAvailabilitySource.value;
  const targets = Array.from(document.querySelectorAll("[data-copy-day]:checked"))
    .map((input) => input.dataset.copyDay)
    .filter((dayName) => dayName !== sourceDay);
  if (!targets.length) {
    alert("Selecciona al menos un día de destino para copiar el horario.");
    return;
  }

  const source = getDayScheduleConfig(sourceDay);
  const applyToCurrentWeek = window.confirm(
    "¿Aplicar también a la semana actual y reorganizarla? Aceptar = semana actual; Cancelar = solo semanas futuras."
  );
  if (!state.weekAvailability[getCurrentWeekKey()]) {
    state.weekAvailability[getCurrentWeekKey()] = getAllDayScheduleConfigs();
  }

  targets.forEach((dayName) => {
    state.weekConfig[dayName] = {
      ...(state.weekConfig[dayName] || defaultWeekConfig[dayName]),
      ...source,
      unavailablePeriods: source.unavailablePeriods.map((period) => ({ ...period })),
    };
    if (applyToCurrentWeek) {
      state.weekAvailability[getCurrentWeekKey()][dayName] = {
        ...source,
        unavailablePeriods: source.unavailablePeriods.map((period) => ({ ...period })),
      };
    }
  });
  saveStoredItems(STORAGE_KEYS.weekConfig, state.weekConfig);
  saveStoredItems(STORAGE_KEYS.weekAvailability, state.weekAvailability);
  if (applyToCurrentWeek) generateWeeklySchedule({ confirmManual: false });
  else renderAll();
}

function getCurrentWeekDates() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMonday);

  return DAY_NAMES.map((dayName, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { date, dayName };
  });
}

// startDate limita disponibilidad; scheduledDate representa el día previsto de una tarea.
function getTaskScheduledDate(task) {
  if (task.scheduledDate) return parseDateInput(task.scheduledDate);
  const firstSession = getTaskSessions(task)[0];
  return firstSession ? parseDateInput(firstSession.date) : null;
}

function getDateInputValue(date) {
  if (typeof date === "string") return date.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(dateString) {
  const value = String(dateString).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return getDateInputValue(date) === value ? date : null;
}

// Leer tareas antiguas no las migra ni altera sus estados guardados.
function isTaskCompleted(task) {
  return task.completed === true || task.status === "completed" || task.status === "completada";
}

function isTaskOverdue(task, today = getDateInputValue(new Date())) {
  return Boolean(task.dueDate && !isTaskCompleted(task) && task.dueDate < today);
}

function getTaskSessions(task) {
  if (Array.isArray(task.scheduleSessions) && task.scheduleSessions.length) {
    return task.scheduleSessions;
  }
  if (task.scheduledDate && task.startTime) {
    const durationMinutes = Number(task.durationMinutes) || 30;
    return [{
      date: task.scheduledDate,
      startTime: task.startTime,
      durationMinutes,
      endTime: minutesToTime(timeToMinutes(task.startTime) + durationMinutes),
      breakMinutes: 0,
    }];
  }
  return [];
}

function getRunningTimerSession() {
  if (!state.timer.isRunning || !state.timer.finishTimestamp) return null;
  const now = new Date();
  const date = getDateInputValue(now);
  const start = now.getHours() * 60 + now.getMinutes();
  const end = Math.min(24 * 60, start + Math.ceil((state.timer.finishTimestamp - Date.now()) / 60000));
  if (end <= start || !getCurrentWeekDates().some((entry) => getDateInputValue(entry.date) === date)) return null;
  return {
    task: { id: "active-timer", title: "Temporizador en curso", scheduleType: "fixed" },
    session: {
      date,
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      durationMinutes: end - start,
      breakMinutes: 0,
    },
    sessionIndex: -1,
  };
}

function isTaskScheduleLocked(task) {
  return task.scheduleType === "fixed" || task.scheduleSource === "manual";
}

function getTaskRemainingMinutes(task) {
  if (Number.isFinite(task.remainingMinutes)) {
    return Math.max(0, Math.min(Number(task.durationMinutes) || 0, task.remainingMinutes));
  }
  return Math.max(0, (Number(task.durationMinutes) || 0) - (Number(task.timeWorkedMinutes) || 0));
}

// La planificación trabaja con intervalos en minutos desde medianoche; las horas
// se convierten al final. Así la detección de solapamientos usa una sola regla.
function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function getCandidateScheduleDates(task, weekDates) {
  const availableFrom = task.startDate ? parseDateInput(task.startDate) : null;
  const dueDate = task.dueDate ? parseDateInput(task.dueDate) : null;
  const fixedDate = task.fixedDay ? parseDateInput(task.fixedDay) : null;
  return weekDates.filter(({ date }) => {
    if (availableFrom && date < availableFrom) return false;
    if (dueDate && date > dueDate) return false;
    if (fixedDate && getDateInputValue(date) !== getDateInputValue(fixedDate)) return false;
    if (task.scheduleType === "fixed" && task.scheduledDate &&
        getDateInputValue(date) !== task.scheduledDate) return false;
    return true;
  });
}

function getDayIntervals(date, dayName, occupancy) {
  const config = getDayScheduleConfig(dayName);
  if (config.dayOff) return [];
  const dayStart = timeToMinutes(config.startTime);
  const dayEnd = timeToMinutes(config.endTime);
  const intervals = [...(occupancy.get(getDateInputValue(date)) || [])];
  config.unavailablePeriods.forEach((period) => {
    intervals.push({
      start: timeToMinutes(period.start),
      end: timeToMinutes(period.end),
      type: "unavailable",
      label: period.label || "No disponible",
    });
  });
  return intervals.filter((interval) => interval.start < dayEnd && interval.end > dayStart);
}

function findScheduleSlot(task, dateEntry, durationMinutes, occupancy) {
  const { date, dayName } = dateEntry;
  const config = getDayScheduleConfig(dayName);
  if (config.dayOff) return null;

  let dayStart = timeToMinutes(config.startTime);
  const dayEnd = timeToMinutes(config.endTime);
  if (getDateInputValue(date) === getDateInputValue(new Date())) {
    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    dayStart = Math.max(dayStart, Math.ceil(minutesNow / SCHEDULE_MINUTE_STEP) * SCHEDULE_MINUTE_STEP);
  }
  const intervals = getDayIntervals(date, dayName, occupancy);
  const buffer = config.breakEnabled ? config.breakMinutes : 0;
  const occupiedTasks = intervals.filter((interval) => interval.type === "task" || interval.type === "timer");
  const usedMinutes = intervals
    .filter((interval) => interval.type === "task" || interval.type === "timer")
    .reduce((sum, interval) => sum + (interval.duration || interval.end - interval.start), 0);
  // El descanso solo consume capacidad cuando separa dos sesiones ocupadas.
  const requiredBreakMinutes = Math.max(0, occupiedTasks.length) * buffer;
  if (usedMinutes + durationMinutes + requiredBreakMinutes > getDayCapacity(dayName)) return null;
  const preferredTime = task.preferredTime || "cualquiera";
  const preferredStart = timeToMinutes(task.preferredStartTime);
  let bestSlot = null;

  for (
    let start = dayStart;
    start + durationMinutes <= dayEnd;
    start += SCHEDULE_MINUTE_STEP
  ) {
    const end = start + durationMinutes;
    const occupiedEnd = Math.min(dayEnd, end + buffer);
    if (intervals.some((interval) => intervalsOverlap(start, end, interval.start, interval.end))) {
      continue;
    }

    let score = getTaskPriorityScore(task, date);
    if ((task.preferredDays || []).includes(dayName)) score += 12;
    if (task.scheduledDate === getDateInputValue(date)) score += 16;

    const energy = config.energy || "medio";
    if (Number(task.difficulty) >= 3 && energy === "alto") score += 12;
    if (Number(task.difficulty) <= 1 && energy === "bajo") score += 5;
    if (config.rest) score -= 15;

    if (preferredTime === "manana" && start < 12 * 60) score += 8;
    if (preferredTime === "tarde" && start >= 12 * 60 && start < 18 * 60) score += 8;
    if (preferredTime === "noche" && start >= 18 * 60) score += 8;
    if (preferredStart !== null) score -= Math.abs(start - preferredStart) / 30;
    const previousDays = state.scheduleHistory[task.id] || [];
    if (previousDays.includes(dayName)) score -= 4;
    score -= start / 10000;

    if (!bestSlot || score > bestSlot.score) {
      bestSlot = { start, end, occupiedEnd, score };
    }
  }
  return bestSlot;
}

function describeScheduleFailure(task, weekDates, fixedIntervals) {
  if (task.scheduleType === "fixed" && (!task.scheduledDate || !task.startTime)) {
    return "El horario es fijo, pero falta indicar día y hora de inicio.";
  }
  const deadline = task.dueDate ? parseDateInput(task.dueDate) : null;
  if (deadline && deadline < weekDates[0].date) return "La fecha límite ya pasó; no quedan días viables antes del límite.";
  if (fixedIntervals.some((interval) => interval.taskId === task.id)) {
    return "El compromiso fijo entra en conflicto con otro horario o con la disponibilidad.";
  }
  return "No hay un hueco suficiente dentro de la disponibilidad y antes de la fecha límite.";
}

function generateWeeklySchedule({ confirmManual = false } = {}) {
  if (confirmManual) {
    const manualTasks = state.tasks.filter((task) => task.active && !isTaskCompleted(task) && task.scheduleSource === "manual");
    if (manualTasks.length && !window.confirm("El nuevo cálculo conservará los horarios que colocaste manualmente y solo reorganizará tareas flexibles. ¿Continuar?")) {
      return state.scheduleResult;
    }
  }

  const weekDates = getCurrentWeekDates();
  const generatedTaskIds = new Set(
    state.tasks.filter((task) => task.active && !isTaskCompleted(task) && !isTaskScheduleLocked(task)).map((task) => task.id)
  );
  const dateByValue = new Map(weekDates.map((entry) => [getDateInputValue(entry.date), entry]));
  const occupancy = new Map();
  const conflicts = [];
  const unscheduled = [];
  const fixedIntervals = [];
  const schedule = [];

  const runningTimer = getRunningTimerSession();
  if (runningTimer) {
    const { session } = runningTimer;
    const entry = dateByValue.get(session.date);
    if (entry) {
      if (!occupancy.has(session.date)) occupancy.set(session.date, []);
      occupancy.get(session.date).push({
        start: timeToMinutes(session.startTime),
        end: timeToMinutes(session.endTime),
        duration: session.durationMinutes,
        type: "timer",
        label: "Temporizador en curso",
      });
      schedule.push({ ...session, type: "timer" });
      fixedIntervals.push({ taskId: "active-timer", start: timeToMinutes(session.startTime), end: timeToMinutes(session.endTime), date: session.date });
    }
  }

  state.tasks.forEach((task) => {
    if (!task.active || isTaskCompleted(task)) return;
    if (!isTaskScheduleLocked(task)) return;
    const sessions = getTaskSessions(task);
    if (!sessions.length && isTaskScheduleLocked(task)) {
      unscheduled.push({ task, reason: describeScheduleFailure(task, weekDates, fixedIntervals) });
      return;
    }
    if (isTaskScheduleLocked(task) && !task.scheduleSessions?.length) {
      task.scheduleSessions = sessions.map((session) => ({ ...session }));
      task.endTime = sessions[0]?.endTime || task.endTime || "";
    }

    sessions.forEach((session) => {
      const start = timeToMinutes(session.startTime);
      const end = timeToMinutes(session.endTime);
      const entry = dateByValue.get(session.date);
      if (start === null || end === null || end <= start || !entry) return;

      const dayKey = session.date;
      const dayName = entry.dayName;
      const dayConfig = getDayScheduleConfig(dayName);
      const dayStart = timeToMinutes(dayConfig.startTime);
      const dayEnd = timeToMinutes(dayConfig.endTime);
      const sessionInterval = {
        start,
        end: Math.min(dayEnd, end + (dayConfig.breakEnabled ? dayConfig.breakMinutes : 0)),
        duration: end - start,
        type: "task",
        taskId: task.id,
        label: task.title,
      };
      const overlaps = getDayIntervals(entry.date, dayName, occupancy)
        .filter((interval) => interval.type !== "break" && intervalsOverlap(start, end, interval.start, interval.end));
      const availabilityConflict =
        dayConfig.dayOff ||
        start < dayStart ||
        end > dayEnd ||
        dayConfig.unavailablePeriods.some((period) =>
          intervalsOverlap(start, end, timeToMinutes(period.start), timeToMinutes(period.end))
        );
      if (overlaps.length || availabilityConflict) {
        conflicts.push({
          task,
          date: dayKey,
          reason: overlaps.length ? `Se solapa con ${overlaps.map((item) => item.label).join(", ")}.` : "El horario está fuera de disponibilidad.",
        });
      }

      if (!occupancy.has(dayKey)) occupancy.set(dayKey, []);
      occupancy.get(dayKey).push(sessionInterval);
      fixedIntervals.push({ taskId: task.id, start, end, date: dayKey });
      const breakMinutes = dayConfig.breakEnabled
        ? Math.max(0, Math.min(dayConfig.breakMinutes, dayEnd - end))
        : 0;
      schedule.push({ task, date: dayKey, startTime: session.startTime, endTime: session.endTime, durationMinutes: session.durationMinutes, breakMinutes, type: "task" });
      if (breakMinutes > 0) {
        occupancy.get(dayKey).push({
          start: end,
          end: end + breakMinutes,
          type: "break",
          label: "Descanso",
        });
      }
    });
  });

  const tasksToPlan = state.tasks
    .filter((task) => task.active && !isTaskCompleted(task) && !isTaskScheduleLocked(task))
    .sort((a, b) => getTaskPriorityScore(b, weekDates[0].date) - getTaskPriorityScore(a, weekDates[0].date));

  tasksToPlan.forEach((task) => {
    task.scheduleSessions = [];
    task.scheduleSource = "";
    const remaining = getTaskRemainingMinutes(task);
    if (!remaining) return;

    let minutesLeft = remaining;
    let placedAny = false;
    while (minutesLeft > 0) {
      const duration = Math.min(SCHEDULE_MAX_SESSION_MINUTES, minutesLeft);
      const candidates = getCandidateScheduleDates(task, weekDates)
        .map((entry) => ({ ...entry, score: getTaskPriorityScore(task, entry.date) }))
        .sort((a, b) => b.score - a.score);
      const slots = candidates
        .map((entry) => ({ entry, slot: findScheduleSlot(task, entry, duration, occupancy) }))
        .filter((candidate) => candidate.slot)
        .sort((a, b) =>
          b.slot.score - a.slot.score ||
          getDateInputValue(a.entry.date).localeCompare(getDateInputValue(b.entry.date))
        );
      const selected = slots[0];
      if (!selected) break;

      const date = getDateInputValue(selected.entry.date);
      const session = {
        date,
        startTime: minutesToTime(selected.slot.start),
        endTime: minutesToTime(selected.slot.end),
        durationMinutes: duration,
        breakMinutes: Math.max(
          0,
          selected.slot.occupiedEnd - selected.slot.end
        ),
      };
      task.scheduleSessions.push(session);
      task.scheduleSource = "automatico";
      if (!occupancy.has(date)) occupancy.set(date, []);
      occupancy.get(date).push({
        start: selected.slot.start,
        end: selected.slot.occupiedEnd,
        duration,
        type: "task",
        taskId: task.id,
        label: task.title,
      });
      if (session.breakMinutes > 0) {
        occupancy.get(date).push({
          start: selected.slot.end,
          end: selected.slot.occupiedEnd,
          type: "break",
          label: "Descanso",
        });
      }
      schedule.push({ task, ...session, type: "task" });
      minutesLeft -= duration;
      placedAny = true;
    }

    if (placedAny) {
      const firstSession = task.scheduleSessions[0];
      task.scheduledDate = firstSession.date;
      task.startTime = firstSession.startTime;
      task.endTime = firstSession.endTime;
    }
    if (minutesLeft > 0) {
      unscheduled.push({
        task,
        reason: `${describeScheduleFailure(task, weekDates, fixedIntervals)} Quedan ${minutesLeft} min sin programar.`,
      });
    }
  });

  state.scheduleResult = { schedule, unscheduled, conflicts, generated: true };
  generatedTaskIds.forEach((taskId) => {
    const task = getTaskById(taskId);
    state.scheduleHistory[taskId] = Array.from(new Set((task?.scheduleSessions || []).map((session) =>
      weekDates.find(({ date }) => getDateInputValue(date) === session.date)?.dayName
    ).filter(Boolean)));
  });
  saveStoredItems(STORAGE_KEYS.tasks, state.tasks);
  saveStoredItems(STORAGE_KEYS.scheduleHistory, state.scheduleHistory);
  renderAll();
  const fixedConflicts = conflicts.filter(({ task }) => task.scheduleType === "fixed");
  if (fixedConflicts.length && window.confirm(
    `Hay ${fixedConflicts.length} conflicto(s) con horarios fijos. ¿Quieres abrir el primer compromiso para decidir cómo resolverlo?`
  )) {
    populateTaskForm(fixedConflicts[0].task);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return state.scheduleResult;
}

function getTaskPriorityScore(task, date) {
  const values = { baja: 1, media: 2, alta: 3, urgente: 4 };
  const priority = values[task.priority] || 2;
  if (!task.dueDate) return priority * 10;
  const dueDate = parseDateInput(task.dueDate);
  if (!dueDate) return priority * 10;
  const daysRemaining = Math.floor((dueDate - date) / (24 * 60 * 60 * 1000));
  return priority * 10 + Math.max(0, 14 - daysRemaining) * 2;
}

function getDayCapacity(dayName) {
  const config = getDayScheduleConfig(dayName);
  if (config.dayOff) return 0;
  const baseCapacity = Number(config.availableMinutes);
  const energyModifiers = { bajo: 0.7, medio: 1, alto: 1.15 };
  const modifier = energyModifiers[config.energy] || 1;
  const availableCapacity = Math.round((Number.isFinite(baseCapacity) ? baseCapacity : 120) * modifier);
  return config.rest ? Math.min(availableCapacity, 90) : availableCapacity;
}

function handleTimerTaskChange(event) {
  state.selectedTaskId = event.target.value;
  state.timer.taskId = event.target.value;
  saveStoredItems(STORAGE_KEYS.timer, state.timer);
  renderTimer();
}

function syncTimerModeDefault() {
  const mode = elements.timerMode.value;
  if (mode === "pomodoro") {
    elements.timerDuration.value = 25;
  }
  if (mode === "continuo") {
    elements.timerDuration.value = 45;
  }
  if (mode === "objetivo") {
    elements.timerDuration.value = 60;
  }
}

// startTimer inicia una sesión de temporizador para la tarea seleccionada.
function startTimer() {
  const taskId = elements.timerTaskSelect.value || state.tasks[0]?.id;
  if (!taskId) {
    alert("Primero crea una tarea antes de iniciar el temporizador.");
    return;
  }

  const mode = elements.timerMode.value;
  const durationMinutes = Number(elements.timerDuration.value) || 25;
  const totalSeconds = Math.max(1, durationMinutes * 60);

  state.timer = {
    isRunning: true,
    taskId,
    mode,
    durationMinutes,
    remainingSeconds: totalSeconds,
    finishTimestamp: Date.now() + totalSeconds * 1000,
    startedAt: Date.now(),
    totalSeconds,
    status: "en_curso",
  };

  saveStoredItems(STORAGE_KEYS.timer, state.timer);
  renderTimer();
  renderWeeklySchedule();
  startTicker();
}

// startTicker actualiza la interfaz del tiempo cada 250ms.
// Aunque usa setInterval para renderizar, el cálculo real se basa en timestamps.
function startTicker() {
  // Aunque podemos usar setInterval para pintar el tiempo en pantalla, el tiempo
  // restante se calcula a partir de marcas de tiempo. Esto evita depender de un
  // reloj del navegador que pueda retrasarse o pausarse con el tab en segundo plano.
  if (state.timerTicker) {
    clearInterval(state.timerTicker);
  }

  state.timerTicker = setInterval(() => {
    if (!state.timer.isRunning) return;
    const difference = Math.max(0, state.timer.finishTimestamp - Date.now());
    const remainingSeconds = Math.ceil(difference / 1000);
    state.timer.remainingSeconds = remainingSeconds;

    if (remainingSeconds <= 0) {
      finishTimer();
      return;
    }

    renderTimer();
  }, 250);
}

function pauseTimer() {
  if (!state.timer.isRunning) return;

  const now = Date.now();
  const remainingMs = Math.max(0, state.timer.finishTimestamp - now);
  state.timer.remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  state.timer.isRunning = false;
  state.timer.status = "pausado";
  saveStoredItems(STORAGE_KEYS.timer, state.timer);
  renderTimer();
  renderWeeklySchedule();
}

function resumeTimer() {
  if (state.timer.isRunning || !state.timer.remainingSeconds) return;

  state.timer.isRunning = true;
  state.timer.finishTimestamp = Date.now() + state.timer.remainingSeconds * 1000;
  state.timer.status = "en_curso";
  saveStoredItems(STORAGE_KEYS.timer, state.timer);
  renderTimer();
  renderWeeklySchedule();
  startTicker();
}

function finishTimer() {
  if (state.timer.status === "finalizado" || state.timer.status === "sin_iniciar") return;
  clearInterval(state.timerTicker);

  const task = getTaskById(state.timer.taskId);
  if (task) {
    const workedSeconds = Math.max(0, state.timer.totalSeconds - state.timer.remainingSeconds);
    const workedMinutes = Math.max(1, Math.round(workedSeconds / 60));
    task.timeWorkedMinutes += workedMinutes;
    task.remainingMinutes = Math.max(0, task.durationMinutes - task.timeWorkedMinutes);
    state.history.push({
      type: "timer",
      taskId: task.id,
      title: task.title,
      minutes: workedMinutes,
      date: new Date().toISOString(),
    });
    saveStoredItems(STORAGE_KEYS.history, state.history);
    saveStoredItems(STORAGE_KEYS.tasks, state.tasks);
  }

  state.timer.isRunning = false;
  state.timer.remainingSeconds = 0;
  state.timer.status = "finalizado";
  saveStoredItems(STORAGE_KEYS.timer, state.timer);
  if (task) {
    requestCompletionConfirmation(
      task,
      "askOnTimerFinish",
      "el temporizador",
      String(state.timer.startedAt || getDateInputValue(new Date()))
    );
  }
  playAlarm();
  renderTimer();
  renderWeeklySchedule();

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Temporizador completado", {
      body: task ? `La sesión de trabajo de ${task.title} ha terminado.` : "Tu sesión de trabajo ha terminado.",
    });
  }
}

function cancelTimer() {
  clearInterval(state.timerTicker);
  state.timer = getEmptyTimer();
  saveStoredItems(STORAGE_KEYS.timer, state.timer);
  renderTimer();
  renderWeeklySchedule();
}

// playAlarm genera un sonido corto cuando termina el temporizador.
// Usa Web Audio API para crear un tono sin depender de archivos de audio externos.
function playAlarm() {
  // El sonido se genera con Web Audio API. Esto permite crear un tono corto sin
  // depender de archivos externos ni de librerías. El navegador solo permite
  // reproducir audio después de una interacción del usuario, por eso una sesión
  // de temporizador empieza al pulsar un botón y no al cargar la página.
  // Además, el navegador no garantiza alarmas cuando la pestaña está cerrada.
  // La Web Audio API puede quedarse sin ejecutarse en algunos modos de suspensión.
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gainNode.gain.value = 0.02;

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.2);
}

function getTaskById(taskId) {
  return state.tasks.find((task) => task.id === taskId);
}

function getTimerStatusText(timer) {
  if (!timer) return "Sin iniciar";
  if (timer.status === "en_curso") return "En curso";
  if (timer.status === "pausado") return "Pausado";
  if (timer.status === "finalizado") return "Finalizado";
  return "Sin iniciar";
}

function formatSeconds(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDate(dateString) {
  if (!dateString) return "Sin fecha";

  const date = dateString instanceof Date ? dateString : new Date(dateString.includes("T") ? dateString : `${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
