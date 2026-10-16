const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const applicationScript = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

function makeTask(overrides = {}) {
  return {
    id: "task-test",
    title: "Tarea de prueba",
    category: "estudios",
    priority: "media",
    durationMinutes: 60,
    difficulty: 2,
    frequency: "una_vez",
    preferredDays: [],
    fixedDay: "",
    startDate: localDateInput(new Date()),
    scheduledDate: localDateInput(new Date()),
    dueDate: "",
    startTime: "",
    scheduleType: "flexible",
    scheduleSessions: [],
    scheduleSource: "",
    active: true,
    timeWorkedMinutes: 0,
    remainingMinutes: 60,
    ...overrides,
  };
}

function localDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createApplication({
  task = makeTask(),
  tasks = [task],
  settings,
  weekConfig,
  confirm = () => false,
  storage: initialStorage = new Map(),
} = {}) {
  const elements = new Map();
  const storage = new Map(initialStorage);
  storage.set("randomWeek.tasks", JSON.stringify(tasks));
  if (settings) storage.set("randomWeek.completionSettings", JSON.stringify(settings));
  if (weekConfig) storage.set("randomWeek.weekConfig", JSON.stringify(weekConfig));

  const document = {
    documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelectorAll() {
      return [];
    },
  };

  const window = {
    confirm,
    scrollTo() {},
  };

  const context = vm.createContext({
    document,
    window,
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
    console,
    setInterval() {
      return 1;
    },
    clearInterval() {},
  });

  vm.runInContext(applicationScript, context, { filename: "script.js" });
  return {
    context,
    elements,
    storage,
    root: document.documentElement,
    evaluate(source) {
      return vm.runInContext(source, context);
    },
  };
}

function createElement() {
  return {
    value: "",
    checked: false,
    disabled: false,
    listeners: new Map(),
    innerHTML: "",
    textContent: "",
    dataset: {},
    classList: { toggle() {} },
    setAttribute() {},
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    focus() {},
    scrollIntoView() {},
    querySelectorAll() {
      return [];
    },
    // Simula la búsqueda de botones delegada que utiliza el diálogo nativo.
    closest() {
      return null;
    },
    querySelector() {
      return createElement();
    },
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    },
    reset() {},
  };
}

function currentWeek(app) {
  return JSON.parse(JSON.stringify(app.evaluate("getCurrentWeekDates().map(({ date, dayName }) => ({ date: getDateInputValue(date), dayName }))")));
}

function todayEntry(app) {
  const today = app.evaluate("getDateInputValue(new Date())");
  return currentWeek(app).find((entry) => entry.date === today);
}

function weekConfigFor(dayOverrides = {}) {
  const config = {};
  for (const dayName of ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]) {
    config[dayName] = {
      availableMinutes: 480,
      energy: "alto",
      rest: false,
      startTime: "09:00",
      endTime: "17:00",
      breakEnabled: false,
      breakMinutes: 15,
      dayOff: true,
      unavailablePeriods: [],
      ...dayOverrides[dayName],
    };
  }
  return config;
}

function scheduledTask(app, taskId) {
  return JSON.parse(JSON.stringify(app.evaluate(`state.tasks.find((task) => task.id === ${JSON.stringify(taskId)})`)));
}

function layoutFor(app, intervals) {
  const items = intervals.map(({ id, start, end }) => ({
    task: { id, title: id },
    session: {},
    sessionIndex: 0,
    start,
    end,
  }));
  return app.evaluate(`distributeScheduleColumns(${JSON.stringify(items)}).map(item => ({
    id: item.task.id,
    column: item.column,
    columnCount: item.columnCount,
    columnSpan: item.columnSpan,
    conflicts: item.conflicts
  }))`);
}

test("la fecha programada no completa una tarea pendiente ni modifica tareas guardadas", () => {
  const task = makeTask({ scheduledDate: "2000-01-10" });
  const app = createApplication({ task });

  app.evaluate('processDateCompletionEvents("2000-01-10")');

  assert.equal(app.evaluate("isTaskCompleted(state.tasks[0])"), false);
  assert.equal(app.evaluate("state.tasks[0].completed"), undefined);
  assert.deepEqual(JSON.parse(app.storage.get("randomWeek.tasks"))[0], task);
});

test("una tarea que ya estaba completada conserva su estado al cargar", () => {
  const task = makeTask({ completed: true });
  const app = createApplication({ task });

  assert.equal(app.evaluate("isTaskCompleted(state.tasks[0])"), true);
  assert.deepEqual(JSON.parse(app.storage.get("randomWeek.tasks"))[0], task);
});

test("superar la fecha límite mantiene la tarea pendiente y muestra el aviso de retraso", () => {
  const task = makeTask({ scheduledDate: "2000-01-10", dueDate: "2000-01-11" });
  const app = createApplication({ task });

  app.evaluate('processDateCompletionEvents("2000-01-12")');

  assert.equal(app.evaluate('isTaskOverdue(state.tasks[0], "2000-01-12")'), true);
  assert.equal(app.evaluate("isTaskCompleted(state.tasks[0])"), false);
  assert.match(app.elements.get("task-list").innerHTML, /Retrasada/);
  assert.match(app.elements.get("deadline-list").innerHTML, /Retrasada/);
});

test("finalizar el temporizador registra el trabajo, pero no completa la tarea", () => {
  const app = createApplication();
  app.evaluate(`state.timer = {
    isRunning: true,
    taskId: "task-test",
    mode: "pomodoro",
    durationMinutes: 30,
    remainingSeconds: 0,
    startedAt: Date.now(),
    totalSeconds: 1800,
    status: "en_curso"
  }`);

  app.evaluate("finishTimer()");

  assert.equal(app.evaluate("isTaskCompleted(state.tasks[0])"), false);
  assert.equal(app.evaluate("state.tasks[0].timeWorkedMinutes"), 30);
  assert.equal(app.evaluate('state.timer.status'), "finalizado");
});

test("completar desde el post-it persiste el estado y actualiza el tablero", () => {
  const task = makeTask();
  const app = createApplication({ task });
  const button = { dataset: { action: "toggle-completion", taskId: task.id } };

  app.evaluate("handleTaskCompletionClick")( { target: { closest: () => button } });

  assert.equal(app.evaluate("isTaskCompleted(state.tasks[0])"), true);
  assert.equal(JSON.parse(app.storage.get("randomWeek.tasks"))[0].completed, true);
  assert.match(app.elements.get("cork-board").innerHTML, /post-it--done/);
  assert.match(app.elements.get("cork-board").innerHTML, /aria-pressed="true"/);
});

test("el modo Manual es el predeterminado y el cambio de modo se guarda", () => {
  const app = createApplication();
  assert.equal(app.evaluate("state.completionSettings.mode"), "manual");

  app.evaluate(`handleCompletionSettingsChange({
    target: { dataset: { completionSetting: "mode" }, value: "automatico" }
  })`);

  assert.equal(app.evaluate("state.completionSettings.mode"), "automatico");
  assert.equal(JSON.parse(app.storage.get("randomWeek.completionSettings")).mode, "automatico");
});

test("Preguntar solo completa tras aceptar la confirmación; Automático no usa los eventos de fecha", () => {
  const promptedTask = makeTask({ scheduledDate: "2000-01-10" });
  const askingApp = createApplication({
    task: promptedTask,
    settings: { mode: "preguntar", askOnScheduledDate: true },
    confirm: () => true,
  });
  assert.equal(askingApp.evaluate("isTaskCompleted(state.tasks[0])"), true);

  const automaticApp = createApplication({
    task: promptedTask,
    settings: { mode: "automatico", askOnScheduledDate: true },
  });
  automaticApp.evaluate('processDateCompletionEvents("2000-01-10")');
  assert.equal(automaticApp.evaluate("isTaskCompleted(state.tasks[0])"), false);
});

test("Preguntar en el fin del temporizador exige aceptar la confirmación", () => {
  const app = createApplication({
    settings: { mode: "preguntar", askOnTimerFinish: true },
  });
  app.evaluate(`state.timer = {
    isRunning: true,
    taskId: "task-test",
    mode: "pomodoro",
    durationMinutes: 30,
    remainingSeconds: 0,
    startedAt: Date.now(),
    totalSeconds: 1800,
    status: "en_curso"
  }`);

  app.evaluate("finishTimer()");

  assert.equal(app.evaluate("isTaskCompleted(state.tasks[0])"), false);
});

test("las tareas flexibles solo se programan dentro del horario disponible", () => {
  const app = createApplication({
    weekConfig: weekConfigFor(),
    task: makeTask({ id: "flex", startDate: "", scheduledDate: "", dueDate: "" }),
  });
  const today = todayEntry(app);
  app.evaluate(`state.weekConfig[${JSON.stringify(today.dayName)}].dayOff = false; state.weekConfig[${JSON.stringify(today.dayName)}].startTime = "10:00"; state.weekConfig[${JSON.stringify(today.dayName)}].endTime = "20:00"`);
  app.evaluate("generateWeeklySchedule()");

  const task = scheduledTask(app, "flex");
  assert.ok(task.scheduleSessions.length > 0);
  for (const session of task.scheduleSessions) {
    assert.ok(session.startTime >= "10:00");
    assert.ok(session.endTime <= "20:00");
  }
});

test("las sesiones generadas no se solapan entre sí", () => {
  const probe = createApplication();
  const today = todayEntry(probe);
  const tasks = [
    makeTask({ id: "a", startDate: "", durationMinutes: 90, remainingMinutes: 90, scheduledDate: "", dueDate: "" }),
    makeTask({ id: "b", startDate: "", durationMinutes: 90, remainingMinutes: 90, scheduledDate: "", dueDate: "" }),
    makeTask({ id: "c", startDate: "", durationMinutes: 90, remainingMinutes: 90, scheduledDate: "", dueDate: "" }),
  ];
  const app = createApplication({
    tasks,
    weekConfig: weekConfigFor({ [today.dayName]: { dayOff: false } }),
  });
  app.evaluate("generateWeeklySchedule()");
  const sessions = app.evaluate("state.tasks.flatMap(task => task.scheduleSessions.map(session => ({ id: task.id, ...session })))");

  assert.ok(sessions.length > 0);
  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      if (sessions[i].date !== sessions[j].date) continue;
      assert.ok(
        sessions[i].endTime <= sessions[j].startTime || sessions[j].endTime <= sessions[i].startTime,
        `${sessions[i].id} y ${sessions[j].id} se solapan`
      );
    }
  }
  assert.equal(currentWeek(app).length, 7);
});

test("los compromisos fijos permanecen en su hora al generar el resto del horario", () => {
  const probe = createApplication();
  const today = todayEntry(probe);
  const tasks = [
    makeTask({
      id: "fixed",
      startDate: "",
      scheduledDate: today.date,
      startTime: "10:00",
      scheduleType: "fixed",
      durationMinutes: 60,
      remainingMinutes: 60,
    }),
    makeTask({ id: "flexible", startDate: "", scheduledDate: today.date, durationMinutes: 60, remainingMinutes: 60 }),
  ];
  const app = createApplication({
    tasks,
    weekConfig: weekConfigFor({ [today.dayName]: { dayOff: false } }),
  });

  app.evaluate("generateWeeklySchedule()");
  assert.equal(scheduledTask(app, "fixed").scheduleSessions[0].startTime, "10:00");
  assert.notEqual(scheduledTask(app, "flexible").scheduleSessions[0].startTime, "10:00");
});

test("los descansos configurados se reservan entre dos tareas", () => {
  const probe = createApplication();
  const today = todayEntry(probe);
  const tasks = ["first", "second"].map((id) =>
    makeTask({ id, startDate: "", scheduledDate: today.date, durationMinutes: 60, remainingMinutes: 60, dueDate: today.date })
  );
  const app = createApplication({
    tasks,
    weekConfig: weekConfigFor({
      [today.dayName]: {
        startTime: "09:00",
        endTime: "11:15",
        availableMinutes: 180,
        breakEnabled: true,
        breakMinutes: 15,
        dayOff: false,
      },
    }),
  });

  app.evaluate("generateWeeklySchedule()");
  const first = scheduledTask(app, "first").scheduleSessions[0];
  const second = scheduledTask(app, "second").scheduleSessions[0];
  assert.ok(first && second);
  const earlier = first.startTime < second.startTime ? first : second;
  const later = earlier === first ? second : first;
  assert.equal(
    (Number(later.startTime.slice(0, 2)) * 60 + Number(later.startTime.slice(3))) -
      (Number(earlier.endTime.slice(0, 2)) * 60 + Number(earlier.endTime.slice(3))),
    15
  );
});

test("los descansos entre sesiones consumen la capacidad diaria configurada", () => {
  const probe = createApplication();
  const targetDay = currentWeek(probe)[1];
  const tasks = ["first", "second"].map((id) =>
    makeTask({
      id,
      startDate: targetDay.date,
      scheduledDate: targetDay.date,
      dueDate: targetDay.date,
      durationMinutes: 60,
      remainingMinutes: 60,
    })
  );
  const app = createApplication({
    tasks,
    weekConfig: weekConfigFor({
      [targetDay.dayName]: {
        startTime: "09:00",
        endTime: "12:00",
        availableMinutes: 120,
        energy: "medio",
        breakEnabled: true,
        breakMinutes: 15,
        dayOff: false,
      },
    }),
  });

  app.evaluate("generateWeeklySchedule()");

  const scheduledCount = app.evaluate("state.tasks.filter(task => task.scheduleSessions.length).length");
  assert.equal(scheduledCount, 1);
});

test("dos tareas flexibles no se pegan: deja 15 minutos entre una que acaba a las 11:30 y la siguiente", () => {
  const probe = createApplication();
  const targetDay = currentWeek(probe)[1];
  const tasks = ["first", "second"].map((id) =>
    makeTask({
      id,
      startDate: targetDay.date,
      scheduledDate: targetDay.date,
      dueDate: targetDay.date,
      durationMinutes: 30,
      remainingMinutes: 30,
      preferredStartTime: id === "first" ? "11:00" : "11:30",
    })
  );
  const app = createApplication({
    tasks,
    weekConfig: weekConfigFor({
      [targetDay.dayName]: {
        startTime: "09:00",
        endTime: "18:00",
        availableMinutes: 480,
        breakEnabled: true,
        breakMinutes: 15,
        dayOff: false,
      },
    }),
  });

  app.evaluate("generateWeeklySchedule()");

  const sessions = app.evaluate("state.tasks.flatMap(task => task.scheduleSessions)");
  const first = sessions.find((session) => session.startTime === "11:00");
  const second = sessions.find((session) => session.startTime !== "11:00");
  assert.ok(first && second);
  assert.equal(first.endTime, "11:30");
  assert.equal(second.startTime, "11:45");
});

test("la separación predeterminada es de 15 minutos si no había una preferencia guardada", () => {
  const app = createApplication();

  assert.equal(app.evaluate('getDayScheduleConfig("martes").breakEnabled'), true);
  assert.equal(app.evaluate('getDayScheduleConfig("martes").breakMinutes'), 15);
});

test("dos horarios fijos de 11:00 y 11:30 con duración solapada muestran conflicto", () => {
  const probe = createApplication();
  const targetDay = currentWeek(probe)[1];
  const tasks = [
    makeTask({
      id: "fixed-a",
      scheduledDate: targetDay.date,
      startTime: "11:00",
      scheduleType: "fixed",
      scheduleSessions: [{ date: targetDay.date, startTime: "11:00", endTime: "12:00", durationMinutes: 60 }],
    }),
    makeTask({
      id: "fixed-b",
      scheduledDate: targetDay.date,
      startTime: "11:30",
      scheduleType: "fixed",
      scheduleSessions: [{ date: targetDay.date, startTime: "11:30", endTime: "12:30", durationMinutes: 60 }],
    }),
  ];
  const app = createApplication({
    tasks,
    weekConfig: weekConfigFor({
      [targetDay.dayName]: { startTime: "09:00", endTime: "18:00", dayOff: false },
    }),
  });

  app.evaluate("generateWeeklySchedule()");

  assert.equal(app.evaluate("state.scheduleResult.conflicts.length"), 1);
  assert.match(app.elements.get("schedule-messages").innerHTML, /Se solapa con/);
  assert.equal(app.evaluate("isTaskCompleted(state.tasks[0]) || isTaskCompleted(state.tasks[1])"), false);
});

test("la altura visual de una tarea corresponde a su duración sin invadir el siguiente intervalo", () => {
  const probe = createApplication();
  const targetDay = currentWeek(probe)[1];
  const app = createApplication({
    task: makeTask({
      id: "short",
      scheduledDate: targetDay.date,
      scheduleSessions: [{ date: targetDay.date, startTime: "11:00", endTime: "11:30", durationMinutes: 30 }],
    }),
    weekConfig: weekConfigFor({
      [targetDay.dayName]: { startTime: "09:00", endTime: "18:00", dayOff: false },
    }),
  });

  assert.match(app.elements.get("weekly-schedule").innerHTML, /top:\d+(?:\.\d+)?px;height:36px/);
});

test("si no existe hueco viable, la tarea queda pendiente con el motivo", () => {
  const probe = createApplication();
  const today = todayEntry(probe);
  const app = createApplication({
    task: makeTask({ id: "too-large", startDate: "", scheduledDate: today.date, durationMinutes: 90, remainingMinutes: 90, dueDate: today.date }),
    weekConfig: weekConfigFor({ [today.dayName]: { startTime: "09:00", endTime: "10:00", availableMinutes: 60, dayOff: false } }),
  });

  app.evaluate("generateWeeklySchedule()");
  assert.equal(scheduledTask(app, "too-large").scheduleSessions.length, 0);
  assert.equal(app.evaluate("isTaskCompleted(state.tasks[0])"), false);
  assert.match(app.elements.get("schedule-messages").innerHTML, /No hay un hueco suficiente/);
});

test("cambiar la disponibilidad de un día no cambia otros días y persiste al recargar", () => {
  const app = createApplication({ confirm: () => false });
  const beforeTuesday = app.evaluate('getDayScheduleConfig("martes").startTime');
  app.evaluate(`handleWeekConfigInput({
    type: "change",
    target: { dataset: { day: "lunes", field: "startTime" }, value: "11:00" }
  })`);

  assert.equal(app.evaluate('state.weekConfig.lunes.startTime'), "11:00");
  assert.equal(app.evaluate('getDayScheduleConfig("martes").startTime'), beforeTuesday);
  const reloaded = createApplication({ storage: app.storage });
  assert.equal(reloaded.evaluate('state.weekConfig.lunes.startTime'), "11:00");
  assert.equal(reloaded.evaluate('getDayScheduleConfig("martes").startTime'), beforeTuesday);
});

test("la preferencia de hora se aplica sin convertirla en un horario fijo", () => {
  const probe = createApplication();
  const targetDay = currentWeek(probe)[1];
  const task = makeTask({
    startDate: targetDay.date,
    scheduledDate: targetDay.date,
    dueDate: targetDay.date,
    preferredStartTime: "15:00",
  });
  const weekConfig = weekConfigFor({
    [targetDay.dayName]: { dayOff: false, startTime: "09:00", endTime: "18:00" },
  });
  const app = createApplication({ task, weekConfig });

  app.evaluate("generateWeeklySchedule()");

  assert.equal(scheduledTask(app, task.id).scheduleSessions[0].startTime, "15:00");
  assert.equal(scheduledTask(app, task.id).scheduleType, "flexible");
});

test("la escala semanal se amplía a la disponibilidad configurada antes de las 06:00", () => {
  const probe = createApplication();
  const targetDay = currentWeek(probe)[1];
  const task = makeTask({
    startDate: targetDay.date,
    scheduledDate: targetDay.date,
    dueDate: targetDay.date,
    remainingMinutes: 60,
  });
  const weekConfig = weekConfigFor({
    [targetDay.dayName]: { dayOff: false, startTime: "00:00", endTime: "02:00" },
  });
  const app = createApplication({ task, weekConfig });

  app.evaluate("generateWeeklySchedule()");

  assert.equal(scheduledTask(app, task.id).scheduleSessions[0].startTime, "00:00");
  assert.match(app.elements.get("weekly-schedule").innerHTML, /00:00/);
  assert.match(app.elements.get("weekly-schedule").innerHTML, /top:0px;height:72px/);
});

test("un temporizador en curso ocupa su intervalo sin solapar ni completar tareas", () => {
  const probe = createApplication();
  const today = todayEntry(probe);
  const task = makeTask({
    startDate: "",
    scheduledDate: today.date,
    dueDate: today.date,
    remainingMinutes: 60,
  });
  const weekConfig = weekConfigFor({
    [today.dayName]: { dayOff: false, startTime: "00:00", endTime: "23:59" },
  });
  const app = createApplication({ task, weekConfig });
  app.evaluate(`state.timer = {
    isRunning: true,
    taskId: ${JSON.stringify(task.id)},
    mode: "continuo",
    durationMinutes: 60,
    remainingSeconds: 3600,
    finishTimestamp: Date.now() + 3600000,
    startedAt: Date.now(),
    totalSeconds: 3600,
    status: "en_curso"
  }`);

  app.evaluate("generateWeeklySchedule()");

  const schedule = app.evaluate("state.scheduleResult.schedule.map(({ task, date, startTime, endTime, type }) => ({ taskId: task && task.id, date, startTime, endTime, type }))");
  const timer = schedule.find((item) => item.type === "timer");
  const scheduled = schedule.filter((item) => item.type === "task" && item.date === timer.date);
  assert.ok(timer);
  for (const item of scheduled) {
    assert.ok(item.endTime <= timer.startTime || timer.endTime <= item.startTime);
  }
  assert.equal(app.evaluate("isTaskCompleted(state.tasks[0])"), false);
});

test("la reprogramación detecta el conflicto y ofrece un hueco sin desplazar el compromiso", () => {
  const probe = createApplication();
  const targetDay = currentWeek(probe)[1];
  const movingTask = makeTask({
    id: "moving",
    startDate: targetDay.date,
    scheduledDate: targetDay.date,
    dueDate: targetDay.date,
    scheduleSessions: [],
    remainingMinutes: 60,
  });
  const fixedTask = makeTask({
    id: "fixed",
    startDate: "",
    scheduledDate: targetDay.date,
    startTime: "10:00",
    scheduleType: "fixed",
    scheduleSessions: [{
      date: targetDay.date,
      startTime: "10:00",
      endTime: "11:00",
      durationMinutes: 60,
    }],
  });
  const app = createApplication({
    tasks: [movingTask, fixedTask],
    weekConfig: weekConfigFor({
      [targetDay.dayName]: { dayOff: false, startTime: "09:00", endTime: "17:00" },
    }),
  });
  const conflicts = app.evaluate(`getManualScheduleConflicts(
    state.tasks[0],
    { date: ${JSON.stringify(targetDay.date)}, startTime: "10:00", endTime: "11:00" }
  )`);
  const alternatives = app.evaluate("findAlternativeScheduleSlots(state.tasks[0])");

  assert.match(conflicts.join(" "), /Se solapa con/);
  assert.ok(alternatives.length > 0);
  assert.notEqual(alternatives[0].startTime, "10:00");
  assert.equal(scheduledTask(app, "fixed").scheduleSessions[0].startTime, "10:00");
});

test("distribuye en columnas dos tareas de 11:00-12:00 y 11:30-12:00", () => {
  const app = createApplication();
  const layout = layoutFor(app, [
    { id: "uno", start: 660, end: 720 },
    { id: "dos", start: 690, end: 720 },
  ]);

  assert.equal(layout[0].column, 0);
  assert.equal(layout[1].column, 1);
  assert.equal(layout[0].columnCount, 2);
  assert.deepEqual(Array.from(layout[0].conflicts), ["dos"]);
});

test("dos tareas que empiezan a la misma hora utilizan columnas diferentes", () => {
  const app = createApplication();
  const layout = layoutFor(app, [
    { id: "uno", start: 660, end: 720 },
    { id: "dos", start: 660, end: 690 },
  ]);

  assert.notEqual(layout[0].column, layout[1].column);
  assert.equal(layout[0].columnCount, 2);
});

test("los intervalos consecutivos que solo se tocan no cuentan como solapamiento", () => {
  const app = createApplication();
  const layout = layoutFor(app, [
    { id: "uno", start: 660, end: 720 },
    { id: "dos", start: 720, end: 780 },
  ]);

  assert.equal(layout[0].columnCount, 1);
  assert.equal(layout[1].columnCount, 1);
  assert.deepEqual(Array.from(layout[0].conflicts), []);
  assert.deepEqual(Array.from(layout[1].conflicts), []);
});

test("reutiliza columnas en una cadena de solapamientos parciales", () => {
  const app = createApplication();
  const layout = layoutFor(app, [
    { id: "larga", start: 660, end: 840 },
    { id: "primera-corta", start: 660, end: 720 },
    { id: "segunda-corta", start: 720, end: 780 },
    { id: "tercera-corta", start: 780, end: 840 },
  ]);

  assert.equal(layout.length, 4);
  assert.ok(layout.every((item) => item.columnCount === 2));
  assert.deepEqual(Array.from(layout[1].conflicts), ["larga"]);
  assert.equal(layout[1].column, layout[2].column);
  assert.equal(layout[2].column, layout[3].column);
});

test("una nota muy corta y una de varias horas conservan sus intervalos verticales", () => {
  const probe = createApplication();
  const date = todayEntry(probe).date;
  const tasks = [
    makeTask({
      id: "long",
      scheduledDate: date,
      scheduleSessions: [{ date, startTime: "10:00", endTime: "14:00", durationMinutes: 240 }],
    }),
    makeTask({
      id: "short",
      scheduledDate: date,
      scheduleSessions: [{ date, startTime: "10:30", endTime: "10:40", durationMinutes: 10 }],
    }),
  ];
  const app = createApplication({ tasks });
  const layout = app.evaluate("distributeScheduleColumns(state.tasks.flatMap(task => task.scheduleSessions.map((session, sessionIndex) => ({ task, session, sessionIndex, start: timeToMinutes(session.startTime), end: timeToMinutes(session.endTime) }))))");
  const blocks = app.elements.get("weekly-schedule").innerHTML;

  assert.equal(layout[0].columnCount, 2);
  assert.match(blocks, /height:12px/);
  assert.match(blocks, /height:288px/);
});

test("muchas tareas coincidentes amplían el ancho desplazable en vez de ocultar notas", () => {
  const probe = createApplication();
  const date = todayEntry(probe).date;
  const tasks = Array.from({ length: 8 }, (_, index) =>
    makeTask({
      id: `crowded-${index}`,
      scheduledDate: date,
      scheduleSessions: [{ date, startTime: "11:00", endTime: "12:00", durationMinutes: 60 }],
    })
  );
  const app = createApplication({ tasks });

  assert.match(app.elements.get("weekly-schedule").innerHTML, /min-width:1344px/);
  // El carril exterior también debe crecer; si no, el grid interior quedaría recortado.
  assert.match(app.elements.get("weekly-schedule").innerHTML, /grid-template-columns:56px[^"]*minmax\(1344px, 1fr\)/);
  assert.equal(app.evaluate("distributeScheduleColumns(state.tasks.map(task => ({ task, session: task.scheduleSessions[0], start: 660, end: 720 }))).length"), 8);
});

// Una coincidencia es visual y se resuelve con carriles; no es por sí sola
// un error del planificador ni debe recibir el estilo de conflicto.
test("una coincidencia visual no se presenta como conflicto de planificación", () => {
  const probe = createApplication();
  const date = todayEntry(probe).date;
  const tasks = [
    makeTask({
      id: "visual-one",
      title: "Primera tarea",
      scheduledDate: date,
      scheduleSessions: [{ date, startTime: "11:00", endTime: "12:00", durationMinutes: 60 }],
    }),
    makeTask({
      id: "visual-two",
      title: "Segunda tarea",
      scheduledDate: date,
      scheduleSessions: [{ date, startTime: "11:30", endTime: "12:00", durationMinutes: 30 }],
    }),
  ];
  const app = createApplication({ tasks });
  const renderedSchedule = app.elements.get("weekly-schedule").innerHTML;

  assert.doesNotMatch(renderedSchedule, /schedule-task--conflict/);
  app.evaluate("openScheduleNote(state.tasks[0], state.tasks[0].scheduleSessions[0])");
  assert.match(app.elements.get("schedule-note-details").innerHTML, /Comparte franja horaria/);
  assert.doesNotMatch(app.elements.get("schedule-note-details").innerHTML, /Conflicto de planificación/);
});

// Los conflictos detectados por la planificación conservan una señal explícita.
test("un conflicto detectado por el planificador sigue claramente marcado en la nota ampliada", () => {
  const probe = createApplication();
  const date = todayEntry(probe).date;
  const task = makeTask({
    id: "planning-conflict",
    scheduledDate: date,
    scheduleSessions: [{ date, startTime: "11:00", endTime: "12:00", durationMinutes: 60 }],
  });
  const app = createApplication({ task });
  app.evaluate(`state.scheduleResult.conflicts.push({
    task: state.tasks[0],
    date: ${JSON.stringify(date)},
    reason: "Se solapa con otro compromiso."
  })`);
  app.evaluate("renderWeeklySchedule()");
  app.evaluate("openScheduleNote(state.tasks[0], state.tasks[0].scheduleSessions[0])");

  assert.match(app.elements.get("schedule-note-details").innerHTML, /Conflicto de planificación/);
  assert.match(app.elements.get("weekly-schedule").innerHTML, /data-has-conflict="true"/);
});

test("abrir y cerrar la nota muestra detalles accesibles sin alterar el horario", () => {
  const probe = createApplication();
  const date = todayEntry(probe).date;
  const task = makeTask({
    scheduledDate: date,
    timeWorkedMinutes: 20,
    remainingMinutes: 40,
    dueDate: date,
    scheduleSessions: [{ date, startTime: "11:00", endTime: "12:00", durationMinutes: 60 }],
  });
  const app = createApplication({ task });
  const before = JSON.stringify(scheduledTask(app, task.id).scheduleSessions);

  app.evaluate("openScheduleNote(state.tasks[0], state.tasks[0].scheduleSessions[0])");
  assert.equal(app.elements.get("schedule-note-dialog").open, true);
  assert.match(app.elements.get("schedule-note-details").innerHTML, /Categoría/);
  assert.match(app.elements.get("schedule-note-details").innerHTML, /11:00-12:00 · 60 min/);
  assert.match(app.elements.get("schedule-note-details").innerHTML, /20 min trabajados · 40 min restantes/);
  app.evaluate(`handleScheduleNoteAction({
    target: { closest: () => ({ dataset: { action: "close-note" } }) },
    stopPropagation() {}
  })`);
  assert.equal(app.elements.get("schedule-note-dialog").open, false);

  // Comprueba el manejador de teclado adicional para cerrar el diálogo con Escape.
  app.evaluate("openScheduleNote(state.tasks[0], state.tasks[0].scheduleSessions[0])");
  app.elements.get("schedule-note-dialog").listeners.get("keydown")({
    key: "Escape",
    preventDefault() {},
  });
  assert.equal(app.elements.get("schedule-note-dialog").open, false);

  // El clic en el fondo del dialog debe cerrar la ficha, sin cambiar las sesiones.
  app.evaluate("openScheduleNote(state.tasks[0], state.tasks[0].scheduleSessions[0])");
  app.evaluate("handleScheduleNoteAction({ target: elements.scheduleNoteDialog, stopPropagation() {} })");
  assert.equal(app.elements.get("schedule-note-dialog").open, false);
  assert.equal(JSON.stringify(scheduledTask(app, task.id).scheduleSessions), before);
});

test("la nota permite editar, mover y completar sin propagar acciones al bloque", () => {
  const probe = createApplication();
  const date = todayEntry(probe).date;
  const task = makeTask({
    id: "dialog-task",
    scheduledDate: date,
    startTime: "11:00",
    scheduleType: "fixed",
    scheduleSessions: [{ date, startTime: "11:00", endTime: "12:00", durationMinutes: 60 }],
  });
  const app = createApplication({ task });
  app.evaluate("openScheduleNote(state.tasks[0], state.tasks[0].scheduleSessions[0])");

  app.evaluate(`handleScheduleNoteAction({
    target: { closest: () => ({ dataset: { action: "dialog-edit", taskId: "dialog-task" } }) },
    stopPropagation() {}
  })`);
  assert.equal(app.elements.get("task-id").value, "dialog-task");
  assert.equal(app.elements.get("schedule-note-dialog").open, false);

  app.evaluate("openScheduleNote(state.tasks[0], state.tasks[0].scheduleSessions[0])");
  app.evaluate(`handleScheduleNoteAction({
    target: { closest: () => ({ dataset: { action: "dialog-move", taskId: "dialog-task", sessionIndex: "0" } }) },
    stopPropagation() {}
  })`);
  assert.equal(app.elements.get("task-scheduled-date").value, date);
  assert.equal(app.elements.get("task-start-time").value, "11:00");
  assert.equal(app.elements.get("task-schedule-type").value, "flexible");

  app.evaluate("openScheduleNote(state.tasks[0], state.tasks[0].scheduleSessions[0])");
  app.evaluate(`handleScheduleNoteAction({
    target: { closest: () => ({ dataset: { action: "dialog-complete", taskId: "dialog-task" } }) },
    stopPropagation() {}
  })`);
  assert.equal(app.evaluate("isTaskCompleted(state.tasks[0])"), true);
  assert.equal(scheduledTask(app, "dialog-task").scheduleSessions[0].startTime, "11:00");
});

test("el tema inicial usa Espacio, Galaxia, Flores y Lavanda", () => {
  const app = createApplication();

  assert.deepEqual(JSON.parse(JSON.stringify(app.evaluate("state.themePreferences"))), {
    background: "space",
    stickyNotes: "galaxy",
    decorations: "flowers",
    interface: "lavender",
  });
  assert.equal(app.root.dataset.themeBackground, "space");
  assert.equal(app.root.dataset.themeStickyNotes, "galaxy");
  assert.equal(app.root.dataset.themeDecorations, "flowers");
  assert.equal(app.root.dataset.themeInterface, "lavender");
});

test("cambiar una capa mantiene las demás y no modifica los datos de tareas", () => {
  const task = makeTask({ id: "theme-safe-task" });
  const app = createApplication({ task });
  const savedTasksBefore = app.storage.get("randomWeek.tasks");
  const backgroundSelect = app.elements.get("theme-background");
  backgroundSelect.value = "cork";
  backgroundSelect.listeners.get("change")({ currentTarget: backgroundSelect });

  assert.equal(app.root.dataset.themeBackground, "cork");
  assert.equal(app.root.dataset.themeStickyNotes, "galaxy");
  assert.equal(app.root.dataset.themeDecorations, "flowers");
  assert.equal(app.root.dataset.themeInterface, "lavender");
  assert.deepEqual(
    JSON.parse(app.storage.get("randomWeek.visualTheme")),
    { background: "cork", stickyNotes: "galaxy", decorations: "flowers", interface: "lavender" }
  );
  assert.equal(app.storage.get("randomWeek.tasks"), savedTasksBefore);
});

test("la combinación guardada se recupera al inicializar de nuevo la aplicación", () => {
  const app = createApplication();
  const decorationSelect = app.elements.get("theme-decorations");
  decorationSelect.value = "none";
  decorationSelect.listeners.get("change")({ currentTarget: decorationSelect });

  const reloaded = createApplication({ storage: app.storage });

  assert.equal(reloaded.root.dataset.themeDecorations, "none");
  assert.equal(reloaded.root.dataset.themeBackground, "space");
  assert.equal(reloaded.root.dataset.themeStickyNotes, "galaxy");
  assert.equal(reloaded.root.dataset.themeInterface, "lavender");
});

test("preferencias desconocidas y componentes reservados usan el valor gratuito predeterminado", () => {
  const app = createApplication({
    storage: new Map([[
      "randomWeek.visualTheme",
      JSON.stringify({ background: "unknown", stickyNotes: "neon", decorations: "flowers", interface: "blue" }),
    ]]),
  });

  assert.deepEqual(JSON.parse(JSON.stringify(app.evaluate("state.themePreferences"))), {
    background: "space",
    stickyNotes: "galaxy",
    decorations: "flowers",
    interface: "blue",
  });
  assert.match(app.elements.get("theme-background").innerHTML, /forest[\s\S]*Bosque · futuro paquete/);
  assert.match(app.elements.get("theme-background").innerHTML, /disabled/);
});

test("restaurar el tema inicial solo guarda las preferencias visuales", () => {
  const app = createApplication({ task: makeTask({ id: "theme-reset-task" }) });
  const savedTasksBefore = app.storage.get("randomWeek.tasks");
  const interfaceSelect = app.elements.get("theme-interface");
  interfaceSelect.value = "pink";
  interfaceSelect.listeners.get("change")({ currentTarget: interfaceSelect });

  app.elements.get("reset-theme-button").listeners.get("click")();

  assert.equal(app.root.dataset.themeInterface, "lavender");
  assert.equal(app.storage.get("randomWeek.tasks"), savedTasksBefore);
  assert.deepEqual(
    JSON.parse(app.storage.get("randomWeek.visualTheme")),
    { background: "space", stickyNotes: "galaxy", decorations: "flowers", interface: "lavender" }
  );
});
