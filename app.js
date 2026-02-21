(function () {
  "use strict";

  const STORAGE_KEY = "shifm_store_v3";
  const UI_VIEW_KEY = "shifm_ui_view_v1";
  const UI_STATE_KEY = "shifm_ui_state_v1";
  const AUTH_PROFILE_KEY = "shifm_auth_profile_v1";
  const LEGACY_STORAGE_KEYS = ["shifm_store_v2", "shifm_store_v1"];
  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const VIEW_NAMES = ["shift", "summary", "settings", "sync"];

  const defaultState = {
    shifts: {},
    masters: [],
    settings: {
      defaultHourlyRate: 1100,
      overtimeThreshold: 8,
      overtimeMultiplier: 1.25,
      taxRate: 0
    },
    sync: {
      githubToken: "",
      gistId: "",
      gistFilename: "shifm-data.json",
      userId: "",
      autoSync: false,
      autoPullOnOpen: true,
      lastSyncedAt: ""
    }
  };

  const state = loadState();
  const uiState = loadUiState();
  let currentMonth = parseMonthKey(uiState.currentMonthKey) || startOfMonth(new Date());
  let selectedDate = isValidDateKey(uiState.selectedDate) ? uiState.selectedDate : toDateKey(new Date());
  let selectedShiftId = null;
  let selectedMasterId = null;
  let selectedPatternId = null;
  let preferredWorkplaceMasterId = uiState.preferredWorkplaceMasterId || "";
  let summaryMasterFilter = normalizeSummaryMasterFilter(uiState.summaryMasterFilter);
  let bulkConfigState = normalizeBulkConfig(uiState.bulkConfig);
  let activeView = loadActiveView();
  let autoSyncTimer = null;
  let authProfile = loadAuthProfile();
  let authMode = authProfile ? "login" : "register";
  let authenticatedUserId = "";

  const refs = {
    appMain: document.getElementById("appMain"),
    authScreen: document.getElementById("authScreen"),
    authForm: document.getElementById("authForm"),
    authTitle: document.getElementById("authTitle"),
    authDescription: document.getElementById("authDescription"),
    authUserId: document.getElementById("authUserId"),
    authPassword: document.getElementById("authPassword"),
    authPasswordConfirm: document.getElementById("authPasswordConfirm"),
    authConfirmRow: document.getElementById("authConfirmRow"),
    authStatus: document.getElementById("authStatus"),
    authSubmit: document.getElementById("authSubmit"),
    authToggleMode: document.getElementById("authToggleMode"),
    logoutButton: document.getElementById("logoutButton"),
    viewTabs: Array.from(document.querySelectorAll(".view-tab")),
    viewSections: Array.from(document.querySelectorAll(".view-section")),
    monthLabel: document.getElementById("monthLabel"),
    calendarGrid: document.getElementById("calendarGrid"),
    prevMonth: document.getElementById("prevMonth"),
    jumpToday: document.getElementById("jumpToday"),
    nextMonth: document.getElementById("nextMonth"),
    summaryMonthLabel: document.getElementById("summaryMonthLabel"),
    summaryPrevMonth: document.getElementById("summaryPrevMonth"),
    summaryNextMonth: document.getElementById("summaryNextMonth"),
    summaryMasterFilter: document.getElementById("summaryMasterFilter"),

    selectedDateLabel: document.getElementById("selectedDateLabel"),
    editingStatus: document.getElementById("editingStatus"),
    shiftForm: document.getElementById("shiftForm"),
    editingShiftId: document.getElementById("editingShiftId"),
    workplaceMaster: document.getElementById("workplaceMaster"),
    applyMasterToForm: document.getElementById("applyMasterToForm"),
    workplace: document.getElementById("workplace"),
    shiftLine: document.getElementById("shiftLine"),
    shiftPattern: document.getElementById("shiftPattern"),
    workplaceSuggestions: document.getElementById("workplaceSuggestions"),
    startTime: document.getElementById("startTime"),
    endTime: document.getElementById("endTime"),
    breakMinutes: document.getElementById("breakMinutes"),
    hourlyRate: document.getElementById("hourlyRate"),
    transport: document.getElementById("transport"),
    memo: document.getElementById("memo"),
    newShift: document.getElementById("newShift"),
    saveAsMaster: document.getElementById("saveAsMaster"),
    deleteShift: document.getElementById("deleteShift"),
    addGoogleCalendar: document.getElementById("addGoogleCalendar"),
    addDayGoogleCalendar: document.getElementById("addDayGoogleCalendar"),
    dayShiftList: document.getElementById("dayShiftList"),
    bulkShiftForm: document.getElementById("bulkShiftForm"),
    bulkWorkplaceMaster: document.getElementById("bulkWorkplaceMaster"),
    bulkWorkplace: document.getElementById("bulkWorkplace"),
    bulkStartTime: document.getElementById("bulkStartTime"),
    bulkEndTime: document.getElementById("bulkEndTime"),
    bulkBreakMinutes: document.getElementById("bulkBreakMinutes"),
    bulkHourlyRate: document.getElementById("bulkHourlyRate"),
    bulkTransport: document.getElementById("bulkTransport"),
    bulkStartDate: document.getElementById("bulkStartDate"),
    bulkEndDate: document.getElementById("bulkEndDate"),
    bulkSkipExisting: document.getElementById("bulkSkipExisting"),
    applyBulkShift: document.getElementById("applyBulkShift"),
    bulkShiftStatus: document.getElementById("bulkShiftStatus"),

    settingsForm: document.getElementById("settingsForm"),
    defaultHourlyRate: document.getElementById("defaultHourlyRate"),
    overtimeThreshold: document.getElementById("overtimeThreshold"),
    overtimeMultiplier: document.getElementById("overtimeMultiplier"),
    taxRate: document.getElementById("taxRate"),

    masterForm: document.getElementById("masterForm"),
    masterId: document.getElementById("masterId"),
    masterName: document.getElementById("masterName"),
    masterHourlyRate: document.getElementById("masterHourlyRate"),
    masterTransport: document.getElementById("masterTransport"),
    masterOvertimeThreshold: document.getElementById("masterOvertimeThreshold"),
    masterOvertimeMultiplier: document.getElementById("masterOvertimeMultiplier"),
    masterTaxRate: document.getElementById("masterTaxRate"),
    patternId: document.getElementById("patternId"),
    patternLineName: document.getElementById("patternLineName"),
    patternName: document.getElementById("patternName"),
    patternStartTime: document.getElementById("patternStartTime"),
    patternEndTime: document.getElementById("patternEndTime"),
    patternBreakMinutes: document.getElementById("patternBreakMinutes"),
    patternSave: document.getElementById("patternSave"),
    patternNew: document.getElementById("patternNew"),
    patternDelete: document.getElementById("patternDelete"),
    patternList: document.getElementById("patternList"),
    masterNew: document.getElementById("masterNew"),
    masterDelete: document.getElementById("masterDelete"),
    masterList: document.getElementById("masterList"),

    totalDays: document.getElementById("totalDays"),
    totalHours: document.getElementById("totalHours"),
    grossPay: document.getElementById("grossPay"),
    netPay: document.getElementById("netPay"),
    monthlyRows: document.getElementById("monthlyRows"),
    workplaceSummaryRows: document.getElementById("workplaceSummaryRows"),
    exportCsv: document.getElementById("exportCsv"),

    syncForm: document.getElementById("syncForm"),
    githubToken: document.getElementById("githubToken"),
    gistId: document.getElementById("gistId"),
    gistFilename: document.getElementById("gistFilename"),
    syncUserId: document.getElementById("syncUserId"),
    autoSync: document.getElementById("autoSync"),
    autoPullOnOpen: document.getElementById("autoPullOnOpen"),
    syncProfileCode: document.getElementById("syncProfileCode"),
    generateSyncProfile: document.getElementById("generateSyncProfile"),
    applySyncProfile: document.getElementById("applySyncProfile"),
    exportBackup: document.getElementById("exportBackup"),
    importBackup: document.getElementById("importBackup"),
    backupFileInput: document.getElementById("backupFileInput"),
    pushCloud: document.getElementById("pushCloud"),
    pullCloud: document.getElementById("pullCloud"),
    pullCloudMerge: document.getElementById("pullCloudMerge"),
    syncStatus: document.getElementById("syncStatus")
  };

  init().catch((error) => {
    console.error(error);
  });

  async function init() {
    bindEvents();
    bindAuthEvents();
    registerServiceWorker();
    renderAuthView();
  }

  function bindAuthEvents() {
    refs.authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await submitAuth();
    });

    refs.authToggleMode.addEventListener("click", () => {
      if (authMode === "login") {
        authMode = "register";
      } else {
        authMode = authProfile ? "login" : "register";
      }
      setAuthStatus("");
      renderAuthView();
    });
  }

  async function submitAuth() {
    const userId = refs.authUserId.value.trim();
    const password = refs.authPassword.value;
    const passwordConfirm = refs.authPasswordConfirm.value;

    if (!userId) {
      setAuthStatus("ユーザーIDを入力してください。");
      return;
    }
    if (!password || password.length < 6) {
      setAuthStatus("パスワードは6文字以上で入力してください。");
      return;
    }

    if (authMode === "register") {
      if (password !== passwordConfirm) {
        setAuthStatus("パスワード確認が一致しません。");
        return;
      }
      if (authProfile && !window.confirm("既存ログイン情報を上書きしますか？")) {
        return;
      }

      const salt = createSalt();
      const passwordHash = await hashPassword(userId, password, salt);
      authProfile = {
        version: 1,
        userId,
        salt,
        passwordHash,
        updatedAt: new Date().toISOString()
      };
      persistAuthProfile(authProfile);
      authMode = "login";
      setAuthStatus("登録しました。続けてログインしてください。");
      refs.authPassword.value = "";
      refs.authPasswordConfirm.value = "";
      renderAuthView();
      return;
    }

    if (!authProfile) {
      authMode = "register";
      setAuthStatus("登録が必要です。新規登録に切り替えました。");
      renderAuthView();
      return;
    }

    if (userId !== authProfile.userId) {
      setAuthStatus("ユーザーIDが一致しません。");
      return;
    }

    const attemptedHash = await hashPassword(userId, password, authProfile.salt);
    if (attemptedHash !== authProfile.passwordHash) {
      setAuthStatus("パスワードが違います。");
      return;
    }

    authenticatedUserId = userId;
    refs.authPassword.value = "";
    refs.authPasswordConfirm.value = "";
    setAuthStatus("");
    unlockApp();
  }

  function renderAuthView() {
    const isLogin = authMode === "login";
    refs.authTitle.textContent = isLogin ? "ログイン" : "新規登録";
    refs.authDescription.textContent = isLogin
      ? "登録済みユーザーで認証してください。"
      : "最初にユーザーIDとパスワードを登録します。";
    refs.authSubmit.textContent = isLogin ? "ログイン" : "登録";
    refs.authToggleMode.textContent = isLogin ? "新規登録に切替" : "ログインに切替";
    refs.authConfirmRow.hidden = isLogin;
    refs.authPasswordConfirm.required = !isLogin;

    if (authProfile && authProfile.userId && isLogin) {
      refs.authUserId.value = authProfile.userId;
    }
  }

  function unlockApp() {
    refs.authScreen.hidden = true;
    refs.appMain.hidden = false;
    refs.logoutButton.hidden = false;

    if (authenticatedUserId) {
      state.sync.userId = authenticatedUserId;
      persistState();
    }

    renderAll();
    queueAutoPullOnOpen();
  }

  function lockApp() {
    refs.appMain.hidden = true;
    refs.authScreen.hidden = false;
    refs.logoutButton.hidden = true;
    refs.authPassword.value = "";
    refs.authPasswordConfirm.value = "";
    authenticatedUserId = "";
    authMode = authProfile ? "login" : "register";
    setAuthStatus("");
    renderAuthView();
  }

  function setAuthStatus(text) {
    refs.authStatus.textContent = text;
  }

  function bindEvents() {
    refs.logoutButton.addEventListener("click", () => {
      lockApp();
    });

    for (const tab of refs.viewTabs) {
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-view-target");
        setActiveView(target);
      });
    }

    refs.prevMonth.addEventListener("click", () => {
      changeCurrentMonth(-1);
    });

    refs.jumpToday.addEventListener("click", () => {
      jumpToToday();
    });

    refs.nextMonth.addEventListener("click", () => {
      changeCurrentMonth(1);
    });

    refs.summaryPrevMonth.addEventListener("click", () => {
      changeCurrentMonth(-1);
    });

    refs.summaryNextMonth.addEventListener("click", () => {
      changeCurrentMonth(1);
    });

    refs.summaryMasterFilter.addEventListener("change", () => {
      summaryMasterFilter = normalizeSummaryMasterFilter(refs.summaryMasterFilter.value);
      persistUiState();
      renderSummary();
    });

    refs.workplaceMaster.addEventListener("change", () => {
      const masterId = refs.workplaceMaster.value;
      if (!masterId) {
        preferredWorkplaceMasterId = "";
        selectedPatternId = null;
        renderShiftPatternControls();
        persistUiState();
        return;
      }
      applyMasterToShiftForm(masterId, { override: true, remember: true });
    });

    refs.shiftLine.addEventListener("change", () => {
      renderShiftPatternControls();
    });

    refs.shiftPattern.addEventListener("change", () => {
      applySelectedShiftPattern();
    });

    refs.bulkWorkplaceMaster.addEventListener("change", () => {
      const masterId = refs.bulkWorkplaceMaster.value;
      if (!masterId) {
        persistUiState();
        return;
      }
      applyMasterToBulkForm(masterId, { override: true, remember: true });
    });

    const bulkSyncFields = [
      refs.bulkWorkplace,
      refs.bulkStartTime,
      refs.bulkEndTime,
      refs.bulkBreakMinutes,
      refs.bulkHourlyRate,
      refs.bulkTransport,
      refs.bulkStartDate,
      refs.bulkEndDate,
      refs.bulkSkipExisting
    ];
    for (const field of bulkSyncFields) {
      field.addEventListener("change", () => {
        bulkConfigState = buildBulkConfigFromForm();
        persistUiState();
      });
    }
    const bulkWeekdayChecks = refs.bulkShiftForm.querySelectorAll('input[name="bulkWeekday"]');
    for (const check of bulkWeekdayChecks) {
      check.addEventListener("change", () => {
        bulkConfigState = buildBulkConfigFromForm();
        persistUiState();
      });
    }

    refs.applyMasterToForm.addEventListener("click", () => {
      const masterId = refs.workplaceMaster.value;
      if (!masterId) {
        alert("先に勤務先マスタを選択してください。");
        return;
      }
      applyMasterToShiftForm(masterId, { override: true, remember: true });
    });

    refs.shiftForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!selectedDate) {
        alert("先に日付を選択してください。");
        return;
      }

      let shift;
      try {
        shift = buildShiftFromForm();
      } catch (error) {
        alert(error.message);
        return;
      }

      const dayShifts = getDayShifts(selectedDate);
      const editId = refs.editingShiftId.value;
      const targetId = editId || createShiftId();
      const targetIndex = dayShifts.findIndex((item) => item.id === targetId);
      const savedShift = { ...shift, id: targetId };

      if (targetIndex >= 0) {
        dayShifts[targetIndex] = savedShift;
      } else {
        dayShifts.push(savedShift);
      }

      state.shifts[selectedDate] = sortShifts(dayShifts);
      selectedShiftId = targetId;

      persistState();
      renderCalendar();
      renderShiftForm();
      renderDayShiftList();
      renderWorkplaceSuggestions();
      renderSummary();
      queueAutoSync("シフト保存");
      alert("シフトを保存しました。");
    });

    refs.newShift.addEventListener("click", () => {
      selectedShiftId = null;
      renderShiftForm();
    });

    refs.saveAsMaster.addEventListener("click", () => {
      saveCurrentShiftAsMaster();
    });

    refs.deleteShift.addEventListener("click", () => {
      if (!selectedDate) {
        return;
      }

      const dayShifts = getDayShifts(selectedDate);
      if (dayShifts.length === 0) {
        return;
      }

      if (!selectedShiftId) {
        alert("削除するシフトを一覧から選択してください。");
        return;
      }

      const next = dayShifts.filter((item) => item.id !== selectedShiftId);
      if (next.length === dayShifts.length) {
        return;
      }

      if (!window.confirm("選択中のシフトを削除しますか？")) {
        return;
      }

      if (next.length === 0) {
        delete state.shifts[selectedDate];
      } else {
        state.shifts[selectedDate] = next;
      }

      selectedShiftId = null;
      persistState();
      renderShiftForm();
      renderDayShiftList();
      renderWorkplaceSuggestions();
      renderCalendar();
      renderSummary();
      queueAutoSync("シフト削除");
    });

    refs.addGoogleCalendar.addEventListener("click", () => {
      if (!selectedDate) {
        alert("先に日付を選択してください。");
        return;
      }

      let shift;
      try {
        shift = buildShiftFromForm();
      } catch (error) {
        alert(error.message);
        return;
      }

      openGoogleCalendarEvent(selectedDate, shift);
    });

    refs.addDayGoogleCalendar.addEventListener("click", () => {
      if (!selectedDate) {
        return;
      }
      const dayShifts = getDayShifts(selectedDate);
      if (dayShifts.length === 0) {
        alert("この日の登録シフトがありません。");
        return;
      }

      let opened = 0;
      for (const shift of dayShifts) {
        const win = openGoogleCalendarEvent(selectedDate, shift, true);
        if (win) {
          opened += 1;
        }
      }

      if (opened < dayShifts.length) {
        alert("ポップアップ制限により一部開けませんでした。ブラウザ設定で許可してください。");
      }
    });

    refs.applyBulkShift.addEventListener("click", () => {
      applyBulkShiftFromForm();
    });

    refs.settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      state.settings.defaultHourlyRate = toNonNegativeNumber(refs.defaultHourlyRate.value, 0);
      state.settings.overtimeThreshold = toNonNegativeNumber(refs.overtimeThreshold.value, 0);
      state.settings.overtimeMultiplier = Math.max(1, toNonNegativeNumber(refs.overtimeMultiplier.value, 1));
      state.settings.taxRate = clamp(toNonNegativeNumber(refs.taxRate.value, 0), 0, 100);

      persistState();
      renderShiftForm();
      renderMasterForm();
      renderCalendar();
      renderSummary();
      queueAutoSync("設定保存");
      alert("給与設定を保存しました。");
    });

    refs.masterForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveMasterFromForm();
    });

    refs.masterNew.addEventListener("click", () => {
      selectedMasterId = null;
      selectedPatternId = null;
      renderMasterForm();
      renderMasterList();
      renderPatternForm();
      renderPatternList();
    });

    refs.masterDelete.addEventListener("click", () => {
      deleteSelectedMaster();
    });

    refs.patternSave.addEventListener("click", () => {
      savePatternFromForm();
    });

    refs.patternNew.addEventListener("click", () => {
      selectedPatternId = null;
      renderPatternForm();
      renderPatternList();
    });

    refs.patternDelete.addEventListener("click", () => {
      deleteSelectedPattern();
    });

    refs.exportCsv.addEventListener("click", () => {
      const monthRows = getCurrentMonthRows();
      if (monthRows.length === 0) {
        alert("この月のシフトがありません。");
        return;
      }
      exportMonthlyCsv(monthRows);
    });

    refs.syncForm.addEventListener("submit", (event) => {
      event.preventDefault();
      state.sync.githubToken = refs.githubToken.value.trim();
      state.sync.gistId = refs.gistId.value.trim();
      state.sync.gistFilename = refs.gistFilename.value.trim() || "shifm-data.json";
      state.sync.userId = refs.syncUserId.value.trim();
      state.sync.autoSync = refs.autoSync.checked;
      state.sync.autoPullOnOpen = refs.autoPullOnOpen.checked;
      persistState();
      setSyncStatus("同期設定を保存しました。");
    });

    refs.generateSyncProfile.addEventListener("click", async () => {
      await generateSyncProfileCode();
    });

    refs.applySyncProfile.addEventListener("click", () => {
      applySyncProfileCode();
    });

    refs.exportBackup.addEventListener("click", () => {
      exportBackupFile();
    });

    refs.importBackup.addEventListener("click", () => {
      refs.backupFileInput.click();
    });

    refs.backupFileInput.addEventListener("change", async () => {
      await importBackupFromFile();
    });

    refs.pushCloud.addEventListener("click", async () => {
      await pushToCloud({ silent: false });
    });

    refs.pullCloud.addEventListener("click", async () => {
      await pullFromCloud("overwrite");
    });

    refs.pullCloudMerge.addEventListener("click", async () => {
      await pullFromCloud("merge");
    });
  }

  function renderAll() {
    renderViewState();
    renderSettingsForm();
    renderMasterForm();
    renderMasterList();
    renderPatternForm();
    renderPatternList();
    renderWorkplaceMasterOptions();
    renderShiftPatternControls();
    renderSummaryMasterFilterOptions();
    renderBulkForm();
    renderWorkplaceSuggestions();
    renderSyncForm();
    renderCalendar();
    renderShiftForm();
    renderDayShiftList();
    renderSummary();
  }

  function renderViewState() {
    const viewName = isValidViewName(activeView) ? activeView : "shift";

    for (const tab of refs.viewTabs) {
      const target = tab.getAttribute("data-view-target");
      const isActive = target === viewName;
      tab.classList.toggle("is-active", isActive);
      if (isActive) {
        tab.setAttribute("aria-current", "page");
      } else {
        tab.removeAttribute("aria-current");
      }
    }

    for (const section of refs.viewSections) {
      const sectionName = section.getAttribute("data-view");
      const isActive = sectionName === viewName;
      section.classList.toggle("is-active", isActive);
      section.setAttribute("aria-hidden", isActive ? "false" : "true");
    }
  }

  function setActiveView(viewName) {
    activeView = isValidViewName(viewName) ? viewName : "shift";
    localStorage.setItem(UI_VIEW_KEY, activeView);
    persistUiState();
    renderViewState();
  }

  function changeCurrentMonth(offset) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    persistUiState();
    renderCalendar();
    renderSummary();
  }

  function jumpToToday() {
    const today = new Date();
    selectedDate = toDateKey(today);
    selectedShiftId = null;
    currentMonth = startOfMonth(today);
    persistUiState();
    renderCalendar();
    renderShiftForm();
    renderDayShiftList();
    renderSummary();
  }

  function renderCalendar() {
    refs.monthLabel.textContent = `${currentMonth.getFullYear()}年 ${currentMonth.getMonth() + 1}月`;
    refs.calendarGrid.innerHTML = "";

    for (const day of WEEKDAYS) {
      const dayCell = document.createElement("div");
      dayCell.className = "calendar-weekday";
      dayCell.textContent = day;
      refs.calendarGrid.appendChild(dayCell);
    }

    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    for (let i = 0; i < 42; i += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dayKey = toDateKey(date);
      const dayShifts = getDayShifts(dayKey);

      let grossTotal = 0;
      for (const shift of dayShifts) {
        grossTotal += calcShiftPay(dayKey, shift).gross;
      }

      const cell = document.createElement("div");
      cell.className = "calendar-day";
      if (date.getMonth() !== currentMonth.getMonth()) {
        cell.classList.add("outside");
      }
      if (dayKey === selectedDate) {
        cell.classList.add("active");
      }
      cell.setAttribute("data-date", dayKey);

      const number = document.createElement("div");
      number.className = "day-number";
      number.textContent = String(date.getDate());
      cell.appendChild(number);

      if (dayShifts.length > 0) {
        const count = document.createElement("div");
        count.className = "day-count";
        count.textContent = `${dayShifts.length}件`;
        cell.appendChild(count);

        const pay = document.createElement("div");
        pay.className = "day-pay";
        pay.textContent = formatCurrency(grossTotal);
        cell.appendChild(pay);
      }

      cell.addEventListener("click", () => {
        selectedDate = dayKey;
        selectedShiftId = null;
        persistUiState();
        renderCalendar();
        renderShiftForm();
        renderDayShiftList();
      });

      refs.calendarGrid.appendChild(cell);
    }
  }

  function renderShiftForm() {
    if (!selectedDate) {
      refs.selectedDateLabel.textContent = "日付を選択してください";
      clearShiftForm(true);
      return;
    }

    const dayShifts = getDayShifts(selectedDate);
    refs.selectedDateLabel.textContent = `${selectedDate} のシフト (${dayShifts.length}件)`;

    const editing = dayShifts.find((item) => item.id === selectedShiftId);
    if (!editing) {
      clearShiftForm(false);
      refs.editingStatus.textContent = "新規シフトを入力中";
      return;
    }

    refs.editingShiftId.value = editing.id;
    refs.workplace.value = editing.workplace || "";
    refs.startTime.value = editing.startTime;
    refs.endTime.value = editing.endTime;
    refs.breakMinutes.value = editing.breakMinutes;
    refs.hourlyRate.value = editing.hourlyRate;
    refs.transport.value = editing.transport;
    refs.memo.value = editing.memo || "";

    const matchedMasterId = resolveMasterIdForShift(editing);
    refs.workplaceMaster.value = matchedMasterId || "";
    refs.shiftLine.value = editing.lineName || "";
    refs.shiftPattern.value = editing.patternId || "";
    renderShiftPatternControls();

    refs.editingStatus.textContent = "一覧から選択したシフトを編集中";
  }

  function renderDayShiftList() {
    refs.dayShiftList.innerHTML = "";
    if (!selectedDate) {
      return;
    }

    const dayShifts = getDayShifts(selectedDate);
    if (dayShifts.length === 0) {
      const empty = document.createElement("li");
      empty.className = "day-shift-item";
      empty.innerHTML = '<div class="day-shift-sub">この日のシフトは未登録です。</div>';
      refs.dayShiftList.appendChild(empty);
      return;
    }

    for (const shift of dayShifts) {
      const result = calcShiftPay(selectedDate, shift);
      const li = document.createElement("li");
      li.className = "day-shift-item";
      if (shift.id === selectedShiftId) {
        li.classList.add("active");
      }

      const title = shift.workplace ? shift.workplace : "勤務先未入力";
      const lineText = shift.lineName ? ` / ${shift.lineName}` : "";
      const patternText = shift.patternName ? ` / ${shift.patternName}` : "";
      const memo = shift.memo ? ` / ${shift.memo}` : "";
      li.innerHTML =
        '<div><div class="day-shift-title">' +
        escapeHtml(`${shift.startTime}-${shift.endTime}`) +
        '</div><div class="day-shift-sub">' +
        escapeHtml(`${title}${lineText}${patternText}${memo}`) +
        "</div></div>" +
        '<div class="day-shift-pay">' +
        escapeHtml(formatCurrency(result.gross)) +
        "</div>";

      li.addEventListener("click", () => {
        selectedShiftId = shift.id;
        renderShiftForm();
        renderDayShiftList();
      });

      refs.dayShiftList.appendChild(li);
    }
  }

  function renderSettingsForm() {
    refs.defaultHourlyRate.value = state.settings.defaultHourlyRate;
    refs.overtimeThreshold.value = state.settings.overtimeThreshold;
    refs.overtimeMultiplier.value = state.settings.overtimeMultiplier;
    refs.taxRate.value = state.settings.taxRate;
  }

  function renderMasterForm() {
    const selected = getMasterById(selectedMasterId);

    if (!selected) {
      refs.masterId.value = "";
      refs.masterName.value = "";
      refs.masterHourlyRate.value = state.settings.defaultHourlyRate;
      refs.masterTransport.value = 0;
      refs.masterOvertimeThreshold.value = state.settings.overtimeThreshold;
      refs.masterOvertimeMultiplier.value = state.settings.overtimeMultiplier;
      refs.masterTaxRate.value = state.settings.taxRate;
      refs.masterDelete.disabled = true;
      return;
    }

    refs.masterId.value = selected.id;
    refs.masterName.value = selected.name;
    refs.masterHourlyRate.value = selected.defaultHourlyRate;
    refs.masterTransport.value = selected.defaultTransport;
    refs.masterOvertimeThreshold.value = selected.overtimeThreshold;
    refs.masterOvertimeMultiplier.value = selected.overtimeMultiplier;
    refs.masterTaxRate.value = selected.taxRate;
    refs.masterDelete.disabled = false;
  }

  function renderMasterList() {
    refs.masterList.innerHTML = "";

    if (state.masters.length === 0) {
      const empty = document.createElement("li");
      empty.className = "master-item";
      empty.innerHTML = '<div class="master-item-sub">勤務先マスタはまだありません。</div>';
      refs.masterList.appendChild(empty);
      return;
    }

    const masters = sortMasters(state.masters);
    for (const master of masters) {
      const li = document.createElement("li");
      li.className = "master-item";
      if (master.id === selectedMasterId) {
        li.classList.add("active");
      }

      li.innerHTML =
        "<div><div>" +
        escapeHtml(master.name) +
        '</div><div class="master-item-sub">' +
        escapeHtml(
          `時給 ${formatCurrency(master.defaultHourlyRate)} / 交通費 ${formatCurrency(master.defaultTransport)} / 残業 ${master.overtimeThreshold}h x${master.overtimeMultiplier} / パターン ${getMasterPatterns(master).length}件`
        ) +
        "</div></div>";

      li.addEventListener("click", () => {
        if (selectedMasterId !== master.id) {
          selectedPatternId = null;
        }
        selectedMasterId = master.id;
        renderMasterForm();
        renderMasterList();
        renderPatternForm();
        renderPatternList();
      });

      refs.masterList.appendChild(li);
    }
  }

  function renderPatternForm() {
    const master = getMasterById(selectedMasterId);
    const patterns = master ? getMasterPatterns(master) : [];
    const selectedPattern = patterns.find((item) => item.id === selectedPatternId) || null;

    if (!selectedPattern) {
      selectedPatternId = null;
      refs.patternId.value = "";
      refs.patternLineName.value = "";
      refs.patternName.value = "";
      refs.patternStartTime.value = "";
      refs.patternEndTime.value = "";
      refs.patternBreakMinutes.value = 0;
      refs.patternDelete.disabled = true;
      return;
    }

    refs.patternId.value = selectedPattern.id;
    refs.patternLineName.value = selectedPattern.lineName || "";
    refs.patternName.value = selectedPattern.name || "";
    refs.patternStartTime.value = selectedPattern.startTime;
    refs.patternEndTime.value = selectedPattern.endTime;
    refs.patternBreakMinutes.value = selectedPattern.breakMinutes;
    refs.patternDelete.disabled = false;
  }

  function renderPatternList() {
    refs.patternList.innerHTML = "";
    const master = getMasterById(selectedMasterId);
    if (!master) {
      const empty = document.createElement("li");
      empty.className = "pattern-item";
      empty.innerHTML = '<div class="pattern-item-sub">先に勤務先マスタを選択または保存してください。</div>';
      refs.patternList.appendChild(empty);
      return;
    }

    const patterns = getMasterPatterns(master);
    if (patterns.length === 0) {
      const empty = document.createElement("li");
      empty.className = "pattern-item";
      empty.innerHTML = '<div class="pattern-item-sub">この勤務先のパターンは未登録です。</div>';
      refs.patternList.appendChild(empty);
      return;
    }

    for (const pattern of patterns) {
      const li = document.createElement("li");
      li.className = "pattern-item";
      if (pattern.id === selectedPatternId) {
        li.classList.add("active");
      }

      const lineLabel = pattern.lineName ? `${pattern.lineName} / ` : "";
      li.innerHTML =
        "<div><div>" +
        escapeHtml(`${lineLabel}${pattern.name}`) +
        '</div><div class="pattern-item-sub">' +
        escapeHtml(`${pattern.startTime}-${pattern.endTime} 休憩${pattern.breakMinutes}分`) +
        "</div></div>";

      li.addEventListener("click", () => {
        selectedPatternId = pattern.id;
        renderPatternForm();
        renderPatternList();
      });

      refs.patternList.appendChild(li);
    }
  }

  function renderShiftPatternControls() {
    const currentLine = refs.shiftLine.value;
    const currentPatternId = refs.shiftPattern.value;
    const master = getMasterById(refs.workplaceMaster.value);
    refs.shiftLine.innerHTML = '<option value="">未選択</option>';
    refs.shiftPattern.innerHTML = '<option value="">未選択</option>';
    refs.shiftLine.disabled = !master;
    refs.shiftPattern.disabled = !master;

    if (!master) {
      return;
    }

    const patterns = getMasterPatterns(master);
    const lines = Array.from(
      new Set(patterns.map((item) => item.lineName).filter((item) => typeof item === "string" && item.trim()))
    ).sort((a, b) => a.localeCompare(b, "ja"));

    for (const line of lines) {
      const option = document.createElement("option");
      option.value = line;
      option.textContent = line;
      refs.shiftLine.appendChild(option);
    }
    if (currentLine && lines.includes(currentLine)) {
      refs.shiftLine.value = currentLine;
    }

    const lineFilter = refs.shiftLine.value;
    const filteredPatterns = patterns.filter((item) => !lineFilter || item.lineName === lineFilter);
    for (const pattern of filteredPatterns) {
      const option = document.createElement("option");
      option.value = pattern.id;
      option.textContent = pattern.lineName ? `${pattern.lineName} / ${pattern.name}` : pattern.name;
      refs.shiftPattern.appendChild(option);
    }
    if (currentPatternId && filteredPatterns.some((item) => item.id === currentPatternId)) {
      refs.shiftPattern.value = currentPatternId;
    }

    refs.shiftLine.disabled = lines.length === 0;
    refs.shiftPattern.disabled = filteredPatterns.length === 0;
  }

  function getMasterPatterns(master) {
    if (!master) {
      return [];
    }
    return normalizePatternList(master.patterns);
  }

  function applySelectedShiftPattern() {
    const master = getMasterById(refs.workplaceMaster.value);
    if (!master) {
      return;
    }

    const patternId = refs.shiftPattern.value;
    if (!patternId) {
      return;
    }

    const pattern = getMasterPatterns(master).find((item) => item.id === patternId);
    if (!pattern) {
      return;
    }

    refs.shiftLine.value = pattern.lineName || "";
    refs.startTime.value = pattern.startTime;
    refs.endTime.value = pattern.endTime;
    refs.breakMinutes.value = pattern.breakMinutes;

    if (!refs.workplace.value.trim()) {
      refs.workplace.value = master.name;
    }
    if (!refs.hourlyRate.value) {
      refs.hourlyRate.value = master.defaultHourlyRate;
    }
  }

  function savePatternFromForm() {
    const master = getMasterById(refs.masterId.value.trim() || selectedMasterId);
    if (!master) {
      alert("先に勤務先マスタを選択してください。");
      return;
    }

    const idFromForm = refs.patternId.value.trim();
    const lineName = refs.patternLineName.value.trim();
    const name = refs.patternName.value.trim();
    const startTime = refs.patternStartTime.value.trim();
    const endTime = refs.patternEndTime.value.trim();
    const breakMinutes = toNonNegativeNumber(refs.patternBreakMinutes.value, 0);

    if (!name) {
      alert("パターン名を入力してください。");
      return;
    }
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      alert("開始時刻/終了時刻を正しく入力してください。");
      return;
    }

    const pattern = normalizePattern(
      {
        id: idFromForm || createPatternId(),
        lineName,
        name,
        startTime,
        endTime,
        breakMinutes
      },
      0
    );
    if (!pattern) {
      alert("シフトパターンの入力内容を確認してください。");
      return;
    }

    const nextMaster = {
      ...master,
      patterns: upsertPatternList(getMasterPatterns(master), pattern)
    };

    state.masters = upsertMaster(state.masters, nextMaster);
    selectedMasterId = nextMaster.id;
    selectedPatternId = pattern.id;

    persistState();
    renderMasterForm();
    renderMasterList();
    renderPatternForm();
    renderPatternList();
    renderShiftPatternControls();
    queueAutoSync("シフトパターン保存");
    alert("シフトパターンを保存しました。");
  }

  function deleteSelectedPattern() {
    const master = getMasterById(refs.masterId.value.trim() || selectedMasterId);
    if (!master) {
      return;
    }

    const patternId = refs.patternId.value.trim() || selectedPatternId;
    if (!patternId) {
      return;
    }

    const patterns = getMasterPatterns(master);
    const target = patterns.find((item) => item.id === patternId);
    if (!target) {
      return;
    }

    if (!window.confirm(`パターン「${target.name}」を削除しますか？`)) {
      return;
    }

    const nextMaster = {
      ...master,
      patterns: patterns.filter((item) => item.id !== patternId)
    };
    state.masters = upsertMaster(state.masters, nextMaster);
    clearPatternReference(master.id, patternId);

    selectedMasterId = nextMaster.id;
    selectedPatternId = null;
    if (refs.shiftPattern.value === patternId) {
      refs.shiftPattern.value = "";
    }

    persistState();
    renderMasterForm();
    renderMasterList();
    renderPatternForm();
    renderPatternList();
    renderShiftPatternControls();
    renderShiftForm();
    renderDayShiftList();
    renderSummary();
    queueAutoSync("シフトパターン削除");
  }

  function renderWorkplaceMasterOptions() {
    renderMasterSelectOptions(refs.workplaceMaster);
    renderMasterSelectOptions(refs.bulkWorkplaceMaster);
  }

  function renderMasterSelectOptions(selectElement) {
    const previousValue = selectElement.value;
    selectElement.innerHTML = '<option value="">未選択</option>';

    const masters = sortMasters(state.masters);
    for (const master of masters) {
      const option = document.createElement("option");
      option.value = master.id;
      option.textContent = `${master.name} (時給 ${Number(master.defaultHourlyRate).toLocaleString("ja-JP")}円)`;
      selectElement.appendChild(option);
    }

    if (previousValue && getMasterById(previousValue)) {
      selectElement.value = previousValue;
    }
  }

  function renderSummaryMasterFilterOptions() {
    const previousValue = normalizeSummaryMasterFilter(summaryMasterFilter);
    refs.summaryMasterFilter.innerHTML = '<option value="all">全勤務先</option>';

    const masters = sortMasters(state.masters);
    for (const master of masters) {
      const option = document.createElement("option");
      option.value = master.id;
      option.textContent = master.name;
      refs.summaryMasterFilter.appendChild(option);
    }

    if (previousValue !== "all" && getMasterById(previousValue)) {
      refs.summaryMasterFilter.value = previousValue;
      summaryMasterFilter = previousValue;
      return;
    }

    refs.summaryMasterFilter.value = "all";
    summaryMasterFilter = "all";
  }

  function renderBulkForm() {
    const defaults = getDefaultBulkConfig();
    const source = {
      ...defaults,
      ...bulkConfigState
    };

    refs.bulkWorkplaceMaster.value = source.workplaceMasterId || "";
    refs.bulkWorkplace.value = source.workplace || "";
    refs.bulkStartTime.value = source.startTime || "";
    refs.bulkEndTime.value = source.endTime || "";
    refs.bulkBreakMinutes.value = source.breakMinutes;
    refs.bulkHourlyRate.value = source.hourlyRate;
    refs.bulkTransport.value = source.transport;
    refs.bulkStartDate.value = source.startDate;
    refs.bulkEndDate.value = source.endDate;
    refs.bulkSkipExisting.checked = Boolean(source.skipExisting);
    applyBulkWeekdays(source.weekdays);
    setBulkStatus("");

    if (source.workplaceMasterId && getMasterById(source.workplaceMasterId)) {
      applyMasterToBulkForm(source.workplaceMasterId, { override: false, remember: false });
      return;
    }

    const preferredMaster = getMasterById(preferredWorkplaceMasterId);
    if (preferredMaster) {
      applyMasterToBulkForm(preferredMaster.id, { override: false, remember: false });
    }
  }

  function renderWorkplaceSuggestions() {
    const names = new Set();

    for (const master of state.masters) {
      if (master.name) {
        names.add(master.name);
      }
    }

    for (const shifts of Object.values(state.shifts)) {
      const normalized = normalizeShiftsOfDay("", shifts);
      for (const shift of normalized) {
        if (shift.workplace) {
          names.add(shift.workplace);
        }
      }
    }

    refs.workplaceSuggestions.innerHTML = "";
    const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, "ja"));
    for (const name of sorted) {
      const option = document.createElement("option");
      option.value = name;
      refs.workplaceSuggestions.appendChild(option);
    }
  }

  function renderSyncForm() {
    refs.githubToken.value = state.sync.githubToken;
    refs.gistId.value = state.sync.gistId;
    refs.gistFilename.value = state.sync.gistFilename || "shifm-data.json";
    refs.syncUserId.value = state.sync.userId || "";
    refs.autoSync.checked = Boolean(state.sync.autoSync);
    refs.autoPullOnOpen.checked = state.sync.autoPullOnOpen !== false;

    if (state.sync.lastSyncedAt) {
      setSyncStatus(`最終同期: ${formatDateTime(state.sync.lastSyncedAt)}`);
      return;
    }
    setSyncStatus("同期未設定");
  }

  function renderSummary() {
    refs.summaryMonthLabel.textContent = `${currentMonth.getFullYear()}年 ${currentMonth.getMonth() + 1}月`;

    const rows = getCurrentMonthRows();
    const filterMasterId = normalizeSummaryMasterFilter(summaryMasterFilter);
    const filteredRows =
      filterMasterId === "all"
        ? rows
        : rows.filter((row) => resolveMasterIdForShift(row.shift) === filterMasterId);

    let totalMinutes = 0;
    let totalGross = 0;
    let totalNet = 0;
    const workedDates = new Set();

    refs.monthlyRows.innerHTML = "";
    for (const row of filteredRows) {
      totalMinutes += row.result.workedMinutes;
      totalGross += row.result.gross;
      totalNet += row.result.net;
      workedDates.add(row.dateKey);

      const tr = document.createElement("tr");
      const workplaceText = row.shift.memo ? `${row.shift.workplace || "-"} (${row.shift.memo})` : row.shift.workplace || "-";
      tr.innerHTML =
        "<td>" +
        escapeHtml(row.dateKey) +
        "</td>" +
        "<td>" +
        escapeHtml(workplaceText) +
        "</td>" +
        "<td>" +
        escapeHtml(`${row.shift.startTime}-${row.shift.endTime}`) +
        "</td>" +
        "<td>" +
        escapeHtml(formatCurrency(row.result.gross)) +
        "</td>";
      refs.monthlyRows.appendChild(tr);
    }

    if (filteredRows.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="4">該当データがありません。</td>';
      refs.monthlyRows.appendChild(tr);
    }

    refs.totalDays.textContent = `${workedDates.size} 日`;
    refs.totalHours.textContent = `${(totalMinutes / 60).toFixed(1)} 時間`;
    refs.grossPay.textContent = formatCurrency(totalGross);
    refs.netPay.textContent = formatCurrency(totalNet);

    renderWorkplaceSummaryRows(filteredRows);
  }

  function renderWorkplaceSummaryRows(rows) {
    const summaryMap = new Map();

    for (const row of rows) {
      const masterId = resolveMasterIdForShift(row.shift);
      const workplaceName = row.shift.workplace || "勤務先未設定";
      const key = masterId || `name:${normalizeNameKey(workplaceName)}`;

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          label: masterId ? getMasterById(masterId)?.name || workplaceName : workplaceName,
          dates: new Set(),
          minutes: 0,
          gross: 0
        });
      }

      const bucket = summaryMap.get(key);
      bucket.dates.add(row.dateKey);
      bucket.minutes += row.result.workedMinutes;
      bucket.gross += row.result.gross;
    }

    const items = Array.from(summaryMap.values()).sort((a, b) => b.gross - a.gross);
    refs.workplaceSummaryRows.innerHTML = "";

    if (items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="4">該当データがありません。</td>';
      refs.workplaceSummaryRows.appendChild(tr);
      return;
    }

    for (const item of items) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        escapeHtml(item.label) +
        "</td>" +
        "<td>" +
        escapeHtml(`${item.dates.size} 日`) +
        "</td>" +
        "<td>" +
        escapeHtml(`${(item.minutes / 60).toFixed(1)} 時間`) +
        "</td>" +
        "<td>" +
        escapeHtml(formatCurrency(item.gross)) +
        "</td>";
      refs.workplaceSummaryRows.appendChild(tr);
    }
  }

  function getCurrentMonthRows() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const monthPrefix = `${year}-${pad2(month)}-`;

    const rows = [];
    for (const [dateKey, shifts] of Object.entries(state.shifts)) {
      if (!dateKey.startsWith(monthPrefix)) {
        continue;
      }
      const dayShifts = normalizeShiftsOfDay(dateKey, shifts);
      for (const shift of dayShifts) {
        rows.push({ dateKey, shift, result: calcShiftPay(dateKey, shift) });
      }
    }

    rows.sort((a, b) => {
      const dateDiff = a.dateKey.localeCompare(b.dateKey);
      if (dateDiff !== 0) {
        return dateDiff;
      }
      return a.shift.startTime.localeCompare(b.shift.startTime);
    });

    return rows;
  }

  function getDayShifts(dateKey) {
    return normalizeShiftsOfDay(dateKey, state.shifts[dateKey]);
  }

  function clearShiftForm(resetAll) {
    refs.editingShiftId.value = "";
    refs.workplace.value = "";
    refs.shiftLine.value = "";
    refs.shiftPattern.value = "";
    refs.startTime.value = "";
    refs.endTime.value = "";
    refs.breakMinutes.value = 0;
    refs.hourlyRate.value = state.settings.defaultHourlyRate;
    refs.transport.value = 0;
    refs.memo.value = "";

    const preferredMaster = getMasterById(preferredWorkplaceMasterId);
    if (preferredMaster) {
      refs.workplaceMaster.value = preferredMaster.id;
      applyMasterToShiftForm(preferredMaster.id, { override: false, remember: false });
    } else if (state.masters.length === 1) {
      const onlyMaster = state.masters[0];
      refs.workplaceMaster.value = onlyMaster.id;
      applyMasterToShiftForm(onlyMaster.id, { override: false, remember: false });
    } else {
      refs.workplaceMaster.value = "";
    }
    renderShiftPatternControls();

    if (resetAll) {
      refs.editingStatus.textContent = "新規シフトを入力中";
    }
  }

  function buildShiftFromForm() {
    const selectedMaster = getMasterById(refs.workplaceMaster.value);
    const selectedPattern = selectedMaster
      ? getMasterPatterns(selectedMaster).find((item) => item.id === refs.shiftPattern.value)
      : null;
    const lineNameFromForm = refs.shiftLine.value.trim();
    const shift = {
      workplace: refs.workplace.value.trim(),
      workplaceMasterId: selectedMaster ? selectedMaster.id : "",
      lineName: lineNameFromForm,
      patternId: selectedPattern ? selectedPattern.id : "",
      patternName: selectedPattern ? selectedPattern.name : "",
      startTime: refs.startTime.value.trim(),
      endTime: refs.endTime.value.trim(),
      breakMinutes: toNonNegativeNumber(refs.breakMinutes.value, 0),
      hourlyRate: toNonNegativeNumber(refs.hourlyRate.value, state.settings.defaultHourlyRate),
      transport: toNonNegativeNumber(refs.transport.value, 0),
      memo: refs.memo.value.trim()
    };

    if (selectedPattern && selectedPattern.lineName) {
      shift.lineName = selectedPattern.lineName;
    }

    if (selectedMaster && !shift.workplace) {
      shift.workplace = selectedMaster.name;
    }

    if (!shift.workplace) {
      throw new Error("勤務先を入力してください。");
    }

    if (!shift.workplaceMasterId) {
      const matchedByName = findMasterByName(shift.workplace);
      if (matchedByName) {
        shift.workplaceMasterId = matchedByName.id;
      }
    }

    if (!isValidTime(shift.startTime) || !isValidTime(shift.endTime)) {
      throw new Error("開始時刻/終了時刻を正しく入力してください。");
    }

    if (shift.hourlyRate <= 0) {
      throw new Error("時給を入力してください。");
    }

    return shift;
  }

  function applyMasterToShiftForm(masterId, options) {
    const master = getMasterById(masterId);
    if (!master) {
      return false;
    }

    const override = !options || options.override !== false;
    const remember = !options || options.remember !== false;
    const previousMasterId = refs.workplaceMaster.value;
    refs.workplaceMaster.value = master.id;
    if (previousMasterId !== master.id) {
      refs.shiftLine.value = "";
      refs.shiftPattern.value = "";
    }

    if (override) {
      refs.workplace.value = master.name;
      refs.hourlyRate.value = master.defaultHourlyRate;
      refs.transport.value = master.defaultTransport;
    } else {
      if (!refs.workplace.value.trim()) {
        refs.workplace.value = master.name;
      }
      if (!refs.hourlyRate.value) {
        refs.hourlyRate.value = master.defaultHourlyRate;
      }
      if (!refs.transport.value) {
        refs.transport.value = master.defaultTransport;
      }
    }

    if (remember) {
      preferredWorkplaceMasterId = master.id;
      persistUiState();
    }

    renderShiftPatternControls();
    return true;
  }

  function applyMasterToBulkForm(masterId, options) {
    const master = getMasterById(masterId);
    if (!master) {
      return false;
    }

    const override = !options || options.override !== false;
    const remember = !options || options.remember !== false;
    refs.bulkWorkplaceMaster.value = master.id;

    if (override) {
      refs.bulkWorkplace.value = master.name;
      refs.bulkHourlyRate.value = master.defaultHourlyRate;
      refs.bulkTransport.value = master.defaultTransport;
    } else {
      if (!refs.bulkWorkplace.value.trim()) {
        refs.bulkWorkplace.value = master.name;
      }
      if (!refs.bulkHourlyRate.value) {
        refs.bulkHourlyRate.value = master.defaultHourlyRate;
      }
      if (!refs.bulkTransport.value) {
        refs.bulkTransport.value = master.defaultTransport;
      }
    }

    if (remember) {
      preferredWorkplaceMasterId = master.id;
    }
    bulkConfigState = buildBulkConfigFromForm();
    persistUiState();
    return true;
  }

  function applyBulkShiftFromForm() {
    let payload;
    try {
      payload = buildBulkShiftPayloadFromForm();
    } catch (error) {
      setBulkStatus(error.message);
      alert(error.message);
      return;
    }

    const weekdaySet = new Set(payload.weekdays);
    let candidates = 0;
    let created = 0;
    let skipped = 0;

    const cursor = new Date(payload.startDate);
    while (cursor <= payload.endDate) {
      if (weekdaySet.has(cursor.getDay())) {
        candidates += 1;
        const dayKey = toDateKey(cursor);
        const dayShifts = getDayShifts(dayKey);
        const duplicated = dayShifts.some((shift) => isSameShiftSignature(shift, payload.shift));

        if (payload.skipExisting && duplicated) {
          skipped += 1;
        } else {
          dayShifts.push({
            ...payload.shift,
            id: createShiftId()
          });
          state.shifts[dayKey] = sortShifts(dayShifts);
          created += 1;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    bulkConfigState = buildBulkConfigFromForm();
    persistState();
    persistUiState();
    renderCalendar();
    renderShiftForm();
    renderDayShiftList();
    renderSummary();
    renderWorkplaceSuggestions();
    queueAutoSync("定型シフト一括登録");

    const message = `対象 ${candidates}件 / 追加 ${created}件 / スキップ ${skipped}件`;
    setBulkStatus(message);
    alert(`一括登録が完了しました。\n${message}`);
  }

  function buildBulkShiftPayloadFromForm() {
    const selectedMaster = getMasterById(refs.bulkWorkplaceMaster.value);
    const shift = {
      workplace: refs.bulkWorkplace.value.trim(),
      workplaceMasterId: selectedMaster ? selectedMaster.id : "",
      startTime: refs.bulkStartTime.value.trim(),
      endTime: refs.bulkEndTime.value.trim(),
      breakMinutes: toNonNegativeNumber(refs.bulkBreakMinutes.value, 0),
      hourlyRate: toPositiveNumber(refs.bulkHourlyRate.value, state.settings.defaultHourlyRate),
      transport: toNonNegativeNumber(refs.bulkTransport.value, 0),
      memo: ""
    };

    if (selectedMaster && !shift.workplace) {
      shift.workplace = selectedMaster.name;
    }
    if (!shift.workplace) {
      throw new Error("一括登録の勤務先を入力してください。");
    }
    if (!isValidTime(shift.startTime) || !isValidTime(shift.endTime)) {
      throw new Error("一括登録の開始時刻/終了時刻を正しく入力してください。");
    }

    if (!shift.workplaceMasterId) {
      const matchedByName = findMasterByName(shift.workplace);
      if (matchedByName) {
        shift.workplaceMasterId = matchedByName.id;
      }
    }

    const weekdays = getSelectedBulkWeekdays();
    if (weekdays.length === 0) {
      throw new Error("一括登録の曜日を1つ以上選択してください。");
    }

    const startDate = parseDateInput(refs.bulkStartDate.value);
    const endDate = parseDateInput(refs.bulkEndDate.value);
    if (!startDate || !endDate) {
      throw new Error("一括登録の開始日/終了日を入力してください。");
    }
    if (endDate < startDate) {
      throw new Error("一括登録の終了日は開始日以降にしてください。");
    }

    return {
      shift,
      weekdays,
      startDate,
      endDate,
      skipExisting: Boolean(refs.bulkSkipExisting.checked)
    };
  }

  function isSameShiftSignature(left, right) {
    return (
      normalizeNameKey(left.workplace) === normalizeNameKey(right.workplace) &&
      left.startTime === right.startTime &&
      left.endTime === right.endTime
    );
  }

  function getSelectedBulkWeekdays() {
    const checks = refs.bulkShiftForm.querySelectorAll('input[name="bulkWeekday"]');
    const days = [];
    for (const check of checks) {
      if (check.checked) {
        days.push(Number(check.value));
      }
    }
    return days.filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
  }

  function applyBulkWeekdays(weekdays) {
    const values = Array.isArray(weekdays) ? weekdays : [];
    const valueSet = new Set(values.map((v) => Number(v)));
    const checks = refs.bulkShiftForm.querySelectorAll('input[name="bulkWeekday"]');
    for (const check of checks) {
      check.checked = valueSet.has(Number(check.value));
    }
  }

  function getDefaultBulkConfig() {
    const preferredMaster = getMasterById(preferredWorkplaceMasterId);
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = endOfMonth(currentMonth);

    return {
      workplaceMasterId: preferredMaster ? preferredMaster.id : "",
      workplace: preferredMaster ? preferredMaster.name : "",
      startTime: "",
      endTime: "",
      breakMinutes: 0,
      hourlyRate: preferredMaster ? preferredMaster.defaultHourlyRate : state.settings.defaultHourlyRate,
      transport: preferredMaster ? preferredMaster.defaultTransport : 0,
      startDate: toDateKey(firstDay),
      endDate: toDateKey(lastDay),
      weekdays: [1, 3, 5],
      skipExisting: true
    };
  }

  function normalizeBulkConfig(raw) {
    const defaults = {
      workplaceMasterId: "",
      workplace: "",
      startTime: "",
      endTime: "",
      breakMinutes: 0,
      hourlyRate: state.settings.defaultHourlyRate,
      transport: 0,
      startDate: "",
      endDate: "",
      weekdays: [1, 3, 5],
      skipExisting: true
    };

    if (!isObject(raw)) {
      return defaults;
    }

    const weekdays = Array.isArray(raw.weekdays)
      ? raw.weekdays.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0 && v <= 6)
      : defaults.weekdays;

    return {
      workplaceMasterId: typeof raw.workplaceMasterId === "string" ? raw.workplaceMasterId : defaults.workplaceMasterId,
      workplace: typeof raw.workplace === "string" ? raw.workplace : defaults.workplace,
      startTime: typeof raw.startTime === "string" ? raw.startTime : defaults.startTime,
      endTime: typeof raw.endTime === "string" ? raw.endTime : defaults.endTime,
      breakMinutes: toNonNegativeNumber(raw.breakMinutes, defaults.breakMinutes),
      hourlyRate: toPositiveNumber(raw.hourlyRate, defaults.hourlyRate),
      transport: toNonNegativeNumber(raw.transport, defaults.transport),
      startDate: isValidDateKey(raw.startDate) ? raw.startDate : defaults.startDate,
      endDate: isValidDateKey(raw.endDate) ? raw.endDate : defaults.endDate,
      weekdays: weekdays.length > 0 ? weekdays : defaults.weekdays,
      skipExisting: raw.skipExisting !== false
    };
  }

  function buildBulkConfigFromForm() {
    return {
      workplaceMasterId: refs.bulkWorkplaceMaster.value || "",
      workplace: refs.bulkWorkplace.value.trim(),
      startTime: refs.bulkStartTime.value.trim(),
      endTime: refs.bulkEndTime.value.trim(),
      breakMinutes: toNonNegativeNumber(refs.bulkBreakMinutes.value, 0),
      hourlyRate: toPositiveNumber(refs.bulkHourlyRate.value, state.settings.defaultHourlyRate),
      transport: toNonNegativeNumber(refs.bulkTransport.value, 0),
      startDate: refs.bulkStartDate.value,
      endDate: refs.bulkEndDate.value,
      weekdays: getSelectedBulkWeekdays(),
      skipExisting: Boolean(refs.bulkSkipExisting.checked)
    };
  }

  function setBulkStatus(text) {
    refs.bulkShiftStatus.textContent = text;
  }

  function saveCurrentShiftAsMaster() {
    const name = refs.workplace.value.trim();
    if (!name) {
      alert("勤務先を入力してから保存してください。");
      return;
    }

    const defaultHourlyRate = toPositiveNumber(refs.hourlyRate.value, state.settings.defaultHourlyRate);
    const defaultTransport = toNonNegativeNumber(refs.transport.value, 0);

    const existing = findMasterByName(name);
    const masterId = existing ? existing.id : createMasterId();
    const master = {
      id: masterId,
      name,
      defaultHourlyRate,
      defaultTransport,
      overtimeThreshold: existing ? existing.overtimeThreshold : state.settings.overtimeThreshold,
      overtimeMultiplier: existing ? existing.overtimeMultiplier : state.settings.overtimeMultiplier,
      taxRate: existing ? existing.taxRate : state.settings.taxRate,
      patterns: existing ? getMasterPatterns(existing) : []
    };

    state.masters = upsertMaster(state.masters, master);
    selectedMasterId = master.id;

    persistState();
    renderMasterForm();
    renderMasterList();
    renderPatternForm();
    renderPatternList();
    renderWorkplaceMasterOptions();
    renderSummaryMasterFilterOptions();
    renderBulkForm();
    renderWorkplaceSuggestions();
    refs.workplaceMaster.value = master.id;
    preferredWorkplaceMasterId = master.id;
    persistUiState();

    queueAutoSync("勤務先マスタ保存");
    alert(existing ? "勤務先マスタを更新しました。" : "勤務先マスタに保存しました。");
  }

  function saveMasterFromForm() {
    const idFromForm = refs.masterId.value.trim();
    const name = refs.masterName.value.trim();
    const defaultHourlyRate = toPositiveNumber(refs.masterHourlyRate.value, state.settings.defaultHourlyRate);
    const defaultTransport = toNonNegativeNumber(refs.masterTransport.value, 0);
    const overtimeThreshold = toNonNegativeNumber(refs.masterOvertimeThreshold.value, state.settings.overtimeThreshold);
    const overtimeMultiplier = Math.max(1, toPositiveNumber(refs.masterOvertimeMultiplier.value, state.settings.overtimeMultiplier));
    const taxRate = clamp(toNonNegativeNumber(refs.masterTaxRate.value, state.settings.taxRate), 0, 100);

    if (!name) {
      alert("勤務先名を入力してください。");
      return;
    }

    const existingById = getMasterById(idFromForm);
    const existingByName = findMasterByName(name);
    const inheritedSource = existingById || existingByName;
    const targetId = idFromForm || (existingByName ? existingByName.id : createMasterId());

    const master = {
      id: targetId,
      name,
      defaultHourlyRate,
      defaultTransport,
      overtimeThreshold,
      overtimeMultiplier,
      taxRate,
      patterns: inheritedSource ? getMasterPatterns(inheritedSource) : []
    };

    state.masters = upsertMaster(state.masters, master);
    selectedMasterId = targetId;

    persistState();
    renderMasterForm();
    renderMasterList();
    renderPatternForm();
    renderPatternList();
    renderWorkplaceMasterOptions();
    renderSummaryMasterFilterOptions();
    renderBulkForm();
    renderWorkplaceSuggestions();
    persistUiState();

    queueAutoSync("勤務先マスタ保存");
    alert("勤務先マスタを保存しました。");
  }

  function deleteSelectedMaster() {
    const masterId = refs.masterId.value.trim() || selectedMasterId;
    if (!masterId) {
      return;
    }

    const target = getMasterById(masterId);
    if (!target) {
      return;
    }

    if (!window.confirm(`勤務先マスタ「${target.name}」を削除しますか？`)) {
      return;
    }

    state.masters = state.masters.filter((item) => item.id !== masterId);
    clearMasterReference(masterId);

    if (refs.workplaceMaster.value === masterId) {
      refs.workplaceMaster.value = "";
    }
    if (preferredWorkplaceMasterId === masterId) {
      preferredWorkplaceMasterId = "";
      persistUiState();
    }

    selectedMasterId = null;
    selectedPatternId = null;
    persistState();
    renderMasterForm();
    renderMasterList();
    renderPatternForm();
    renderPatternList();
    renderWorkplaceMasterOptions();
    renderSummaryMasterFilterOptions();
    renderBulkForm();
    renderWorkplaceSuggestions();
    renderShiftForm();
    renderDayShiftList();
    persistUiState();

    queueAutoSync("勤務先マスタ削除");
  }

  function clearMasterReference(masterId) {
    for (const [dateKey, shifts] of Object.entries(state.shifts)) {
      const next = normalizeShiftsOfDay(dateKey, shifts).map((shift) => {
        if (shift.workplaceMasterId === masterId) {
          return { ...shift, workplaceMasterId: "", patternId: "" };
        }
        return shift;
      });
      state.shifts[dateKey] = next;
    }
  }

  function clearPatternReference(masterId, patternId) {
    for (const [dateKey, shifts] of Object.entries(state.shifts)) {
      const next = normalizeShiftsOfDay(dateKey, shifts).map((shift) => {
        if (shift.workplaceMasterId === masterId && shift.patternId === patternId) {
          return { ...shift, patternId: "" };
        }
        return shift;
      });
      state.shifts[dateKey] = next;
    }
  }

  function calcShiftPay(dateKey, shift) {
    const range = resolveShiftRange(dateKey, shift.startTime, shift.endTime);
    const totalMinutes = Math.max(0, Math.round((range.end - range.start) / 60000));
    const workedMinutes = Math.max(0, totalMinutes - shift.breakMinutes);

    const policy = resolvePayPolicyForShift(shift);
    const overtimeStart = policy.overtimeThreshold * 60;
    const regularMinutes = Math.min(workedMinutes, overtimeStart);
    const overtimeMinutes = Math.max(0, workedMinutes - overtimeStart);

    const regularPay = (regularMinutes / 60) * shift.hourlyRate;
    const overtimePay = (overtimeMinutes / 60) * shift.hourlyRate * policy.overtimeMultiplier;
    const gross = Math.round(regularPay + overtimePay + shift.transport);
    const net = Math.round(gross * (1 - policy.taxRate / 100));

    return {
      workedMinutes,
      regularMinutes,
      overtimeMinutes,
      gross,
      net
    };
  }

  function resolvePayPolicyForShift(shift) {
    const master = getMasterById(shift.workplaceMasterId) || findMasterByName(shift.workplace);
    if (!master) {
      return {
        overtimeThreshold: state.settings.overtimeThreshold,
        overtimeMultiplier: state.settings.overtimeMultiplier,
        taxRate: state.settings.taxRate
      };
    }
    return {
      overtimeThreshold: toNonNegativeNumber(master.overtimeThreshold, state.settings.overtimeThreshold),
      overtimeMultiplier: Math.max(1, toPositiveNumber(master.overtimeMultiplier, state.settings.overtimeMultiplier)),
      taxRate: clamp(toNonNegativeNumber(master.taxRate, state.settings.taxRate), 0, 100)
    };
  }

  function resolveShiftRange(dateKey, startTime, endTime) {
    const [year, month, day] = dateKey.split("-").map((v) => Number(v));
    const [startHour, startMinute] = startTime.split(":").map((v) => Number(v));
    const [endHour, endMinute] = endTime.split(":").map((v) => Number(v));

    const start = new Date(year, month - 1, day, startHour, startMinute, 0);
    const end = new Date(year, month - 1, day, endHour, endMinute, 0);
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }

    return { start, end };
  }

  function openGoogleCalendarEvent(dateKey, shift, allowReturnWindow) {
    const range = resolveShiftRange(dateKey, shift.startTime, shift.endTime);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo";
    const url = new URL("https://calendar.google.com/calendar/render");

    url.searchParams.set("action", "TEMPLATE");
    url.searchParams.set("text", shift.workplace ? `${shift.workplace} シフト` : "バイトシフト");
    url.searchParams.set("dates", `${toGoogleUtc(range.start)}/${toGoogleUtc(range.end)}`);
    url.searchParams.set(
      "details",
      `勤務: ${shift.startTime}-${shift.endTime}\n休憩: ${shift.breakMinutes}分\n時給: ${shift.hourlyRate}円${
        shift.memo ? `\nメモ: ${shift.memo}` : ""
      }`
    );
    url.searchParams.set("location", shift.workplace || "");
    url.searchParams.set("ctz", timeZone);

    const win = window.open(url.toString(), "_blank", "noopener,noreferrer");
    if (allowReturnWindow) {
      return win;
    }
    return null;
  }

  async function pushToCloud(options) {
    const silent = options && options.silent;
    try {
      const config = requireSyncConfig();
      setSyncStatus("クラウドへ同期中...");

      const payload = buildSyncPayload();

      const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
        method: "PATCH",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.githubToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          files: {
            [config.gistFilename]: {
              content: JSON.stringify(payload, null, 2)
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`同期失敗 (${response.status})`);
      }

      state.sync.lastSyncedAt = new Date().toISOString();
      persistState();
      setSyncStatus(`クラウドに保存しました (${formatDateTime(state.sync.lastSyncedAt)})`);
      if (!silent) {
        alert("クラウド同期が完了しました。");
      }
    } catch (error) {
      setSyncStatus(error.message);
      if (!silent) {
        alert(error.message);
      }
    }
  }

  async function pullFromCloud(mode, options) {
    const silent = options && options.silent;
    const skipConfirm = options && options.skipConfirm;
    try {
      const config = requireSyncConfig();
      setSyncStatus("クラウドから取得中...");

      const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.githubToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`取得失敗 (${response.status})`);
      }

      const gist = await response.json();
      const file = gist.files && gist.files[config.gistFilename];
      if (!file || typeof file.content !== "string") {
        throw new Error("指定ファイルがGistに見つかりません。");
      }

      const parsed = JSON.parse(file.content);
      const remoteData = parsed && parsed.data ? parsed.data : {};
      const remoteShifts = normalizeShiftsMap(remoteData.shifts);
      const remoteMasters = normalizeMasters(remoteData.masters);
      const remoteSettings = isObject(remoteData.settings) ? remoteData.settings : {};
      const remoteUpdatedAt = parsed && parsed.updatedAt ? parsed.updatedAt : "不明";

      if (mode === "overwrite") {
        const ok = skipConfirm ? true : window.confirm(`クラウドのデータ (${remoteUpdatedAt}) で上書きしますか？`);
        if (!ok) {
          setSyncStatus("取得をキャンセルしました。");
          return;
        }

        state.shifts = remoteShifts;
        state.masters = remoteMasters;
        state.settings = {
          ...defaultState.settings,
          ...state.settings,
          ...remoteSettings
        };
      } else {
        state.shifts = mergeShiftMaps(state.shifts, remoteShifts);
        state.masters = mergeMasters(state.masters, remoteMasters);
      }

      state.sync.lastSyncedAt = new Date().toISOString();
      persistState();
      selectedShiftId = null;
      selectedMasterId = null;
      selectedPatternId = null;
      renderAll();
      setSyncStatus(`クラウドから取得しました (${formatDateTime(state.sync.lastSyncedAt)})`);
      if (!silent) {
        alert(mode === "overwrite" ? "クラウドデータを取り込みました。" : "差分マージで取り込みました。");
      }
    } catch (error) {
      setSyncStatus(error.message);
      if (!silent) {
        alert(error.message);
      }
    }
  }

  function queueAutoPullOnOpen() {
    if (state.sync.autoPullOnOpen === false) {
      return;
    }
    if (!hasSyncConfig()) {
      return;
    }
    setTimeout(() => {
      pullFromCloud("merge", { silent: true }).catch(() => {});
    }, 600);
  }

  function mergeShiftMaps(localMap, remoteMap) {
    const merged = normalizeShiftsMap(localMap);

    for (const [dateKey, remoteShiftsRaw] of Object.entries(normalizeShiftsMap(remoteMap))) {
      const localShifts = merged[dateKey] ? normalizeShiftsOfDay(dateKey, merged[dateKey]) : [];
      const idMap = new Map();
      for (const shift of localShifts) {
        idMap.set(shift.id, shift);
      }
      for (const shift of remoteShiftsRaw) {
        idMap.set(shift.id, shift);
      }
      const mergedDay = sortShifts(Array.from(idMap.values()));
      if (mergedDay.length > 0) {
        merged[dateKey] = mergedDay;
      }
    }

    return merged;
  }

  function mergeMasters(localMasters, remoteMasters) {
    const local = normalizeMasters(localMasters);
    const remote = normalizeMasters(remoteMasters);

    const byName = new Map();
    for (const master of local) {
      byName.set(normalizeNameKey(master.name), master);
    }

    for (const master of remote) {
      const key = normalizeNameKey(master.name);
      if (byName.has(key)) {
        const existing = byName.get(key);
        byName.set(key, {
          ...existing,
          name: master.name,
          defaultHourlyRate: master.defaultHourlyRate,
          defaultTransport: master.defaultTransport,
          overtimeThreshold: master.overtimeThreshold,
          overtimeMultiplier: master.overtimeMultiplier,
          taxRate: master.taxRate,
          patterns: mergePatternLists(existing.patterns, master.patterns)
        });
      } else {
        byName.set(key, master);
      }
    }

    return sortMasters(Array.from(byName.values()));
  }

  function buildSyncPayload() {
    return {
      version: 5,
      updatedAt: new Date().toISOString(),
      data: {
        shifts: state.shifts,
        masters: state.masters,
        settings: state.settings
      }
    };
  }

  function buildSyncProfilePayload() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      userId: refs.syncUserId.value.trim(),
      githubToken: refs.githubToken.value.trim(),
      gistId: refs.gistId.value.trim(),
      gistFilename: refs.gistFilename.value.trim() || "shifm-data.json",
      autoSync: Boolean(refs.autoSync.checked),
      autoPullOnOpen: Boolean(refs.autoPullOnOpen.checked)
    };
  }

  async function generateSyncProfileCode() {
    const payload = buildSyncProfilePayload();
    if (!payload.githubToken || !payload.gistId) {
      alert("Token と Gist ID を入力してから生成してください。");
      return;
    }

    const code = encodeBase64Url(JSON.stringify(payload));
    refs.syncProfileCode.value = code;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
        setSyncStatus("ログインコードを生成し、クリップボードにコピーしました。");
      } else {
        setSyncStatus("ログインコードを生成しました。");
      }
    } catch (error) {
      setSyncStatus("ログインコードを生成しました。");
    }
  }

  function applySyncProfileCode() {
    const rawCode = refs.syncProfileCode.value.trim();
    if (!rawCode) {
      alert("ログインコードを貼り付けてください。");
      return;
    }

    try {
      const decoded = decodeBase64Url(rawCode);
      const parsed = JSON.parse(decoded);
      if (!isObject(parsed)) {
        throw new Error("ログインコードが不正です。");
      }

      refs.githubToken.value = typeof parsed.githubToken === "string" ? parsed.githubToken : "";
      refs.gistId.value = typeof parsed.gistId === "string" ? parsed.gistId : "";
      refs.gistFilename.value = typeof parsed.gistFilename === "string" && parsed.gistFilename.trim()
        ? parsed.gistFilename
        : "shifm-data.json";
      refs.syncUserId.value = typeof parsed.userId === "string" ? parsed.userId : "";
      refs.autoSync.checked = parsed.autoSync !== false;
      refs.autoPullOnOpen.checked = parsed.autoPullOnOpen !== false;

      state.sync.githubToken = refs.githubToken.value.trim();
      state.sync.gistId = refs.gistId.value.trim();
      state.sync.gistFilename = refs.gistFilename.value.trim() || "shifm-data.json";
      state.sync.userId = refs.syncUserId.value.trim();
      state.sync.autoSync = refs.autoSync.checked;
      state.sync.autoPullOnOpen = refs.autoPullOnOpen.checked;
      persistState();
      setSyncStatus("ログインコードを適用しました。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "ログインコードの適用に失敗しました。";
      alert(message);
      setSyncStatus(message);
    }
  }

  function exportBackupFile() {
    const payload = buildSyncPayload();
    const jsonText = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonText], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const stamp =
      `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}` +
      `-${pad2(now.getHours())}${pad2(now.getMinutes())}`;

    const link = document.createElement("a");
    link.href = url;
    link.download = `shifm-backup-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setSyncStatus("バックアップを書き出しました。");
  }

  async function importBackupFromFile() {
    const file = refs.backupFileInput.files && refs.backupFileInput.files[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rawData = isObject(parsed) && isObject(parsed.data) ? parsed.data : parsed;
      const incomingShifts = normalizeShiftsMap(rawData.shifts);
      const incomingMasters = normalizeMasters(rawData.masters);
      const incomingSettings = isObject(rawData.settings) ? rawData.settings : {};

      if (!window.confirm("現在データをバックアップ内容で上書きしますか？")) {
        setSyncStatus("バックアップ読み込みをキャンセルしました。");
        return;
      }

      state.shifts = incomingShifts;
      state.masters = incomingMasters;
      state.settings = {
        ...defaultState.settings,
        ...state.settings,
        ...incomingSettings
      };
      persistState();

      selectedShiftId = null;
      selectedMasterId = null;
      selectedPatternId = null;
      renderAll();

      setSyncStatus("バックアップを読み込みました。");
      alert("バックアップを読み込みました。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "バックアップ読み込みに失敗しました。";
      setSyncStatus(message);
      alert(message);
    } finally {
      refs.backupFileInput.value = "";
    }
  }

  function queueAutoSync(reason) {
    if (!state.sync.autoSync) {
      return;
    }
    clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(() => {
      pushToCloud({ silent: true });
    }, 1800);
    setSyncStatus(`${reason}: 自動同期を予約しました...`);
  }

  function requireSyncConfig() {
    const githubToken = state.sync.githubToken && state.sync.githubToken.trim();
    const gistId = state.sync.gistId && state.sync.gistId.trim();
    const gistFilename = (state.sync.gistFilename && state.sync.gistFilename.trim()) || "shifm-data.json";

    if (!githubToken || !gistId) {
      throw new Error("Token と Gist ID を同期設定に入力してください。");
    }

    return { githubToken, gistId, gistFilename };
  }

  function hasSyncConfig() {
    const githubToken = state.sync.githubToken && state.sync.githubToken.trim();
    const gistId = state.sync.gistId && state.sync.gistId.trim();
    return Boolean(githubToken && gistId);
  }

  function encodeBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeBase64Url(text) {
    const normalized = text.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  function createSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }

  async function hashPassword(userId, password, salt) {
    const input = `${userId}:${password}:${salt}`;
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return bytesToHex(new Uint8Array(digest));
  }

  function bytesToHex(bytes) {
    let hex = "";
    for (const value of bytes) {
      hex += value.toString(16).padStart(2, "0");
    }
    return hex;
  }

  function setSyncStatus(text) {
    refs.syncStatus.textContent = text;
  }

  function exportMonthlyCsv(rows) {
    const header = [
      "日付",
      "勤務先",
      "勤務先マスタ",
      "残業開始(時間)",
      "残業倍率",
      "控除率(%)",
      "開始",
      "終了",
      "休憩(分)",
      "時給",
      "交通費",
      "メモ",
      "労働時間(時間)",
      "支給額",
      "手取り見込み"
    ];

    const csvRows = [header];
    for (const row of rows) {
      const master = getMasterById(row.shift.workplaceMasterId);
      const policy = resolvePayPolicyForShift(row.shift);
      csvRows.push([
        row.dateKey,
        row.shift.workplace || "",
        master ? master.name : "",
        policy.overtimeThreshold,
        policy.overtimeMultiplier,
        policy.taxRate,
        row.shift.startTime,
        row.shift.endTime,
        row.shift.breakMinutes,
        row.shift.hourlyRate,
        row.shift.transport,
        row.shift.memo || "",
        (row.result.workedMinutes / 60).toFixed(2),
        row.result.gross,
        row.result.net
      ]);
    }

    const csvText =
      "\uFEFF" + csvRows.map((line) => line.map((item) => escapeCsv(String(item))).join(",")).join("\n");
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `shift_${currentMonth.getFullYear()}_${pad2(currentMonth.getMonth() + 1)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let source = raw;

      if (!source) {
        for (const key of LEGACY_STORAGE_KEYS) {
          const legacy = localStorage.getItem(key);
          if (legacy) {
            source = legacy;
            break;
          }
        }
      }

      if (!source) {
        return cloneDefaultState();
      }

      const parsed = JSON.parse(source);
      const loaded = {
        shifts: normalizeShiftsMap(parsed.shifts),
        masters: normalizeMasters(parsed.masters),
        settings: {
          ...defaultState.settings,
          ...(isObject(parsed.settings) ? parsed.settings : {})
        },
        sync: {
          ...defaultState.sync,
          ...(isObject(parsed.sync) ? parsed.sync : {})
        }
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
      return loaded;
    } catch (error) {
      console.error(error);
      return cloneDefaultState();
    }
  }

  function loadAuthProfile() {
    try {
      const raw = localStorage.getItem(AUTH_PROFILE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!isObject(parsed)) {
        return null;
      }
      if (
        typeof parsed.userId !== "string" ||
        !parsed.userId.trim() ||
        typeof parsed.salt !== "string" ||
        !parsed.salt ||
        typeof parsed.passwordHash !== "string" ||
        !parsed.passwordHash
      ) {
        return null;
      }
      return {
        version: 1,
        userId: parsed.userId.trim(),
        salt: parsed.salt,
        passwordHash: parsed.passwordHash,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : ""
      };
    } catch (error) {
      return null;
    }
  }

  function persistAuthProfile(profile) {
    localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
  }

  function persistState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalizeShiftsMap(rawShifts) {
    const normalized = {};
    if (!isObject(rawShifts)) {
      return normalized;
    }

    for (const [dateKey, rawDay] of Object.entries(rawShifts)) {
      const dayShifts = normalizeShiftsOfDay(dateKey, rawDay);
      if (dayShifts.length > 0) {
        normalized[dateKey] = dayShifts;
      }
    }

    return normalized;
  }

  function normalizeShiftsOfDay(dateKey, rawDay) {
    let candidates = [];

    if (Array.isArray(rawDay)) {
      candidates = rawDay;
    } else if (isShiftLike(rawDay)) {
      candidates = [rawDay];
    } else if (isObject(rawDay)) {
      candidates = Object.values(rawDay);
    }

    const normalized = [];
    for (let i = 0; i < candidates.length; i += 1) {
      const shift = normalizeShift(dateKey, candidates[i], i);
      if (shift) {
        normalized.push(shift);
      }
    }

    return sortShifts(normalized);
  }

  function normalizeShift(dateKey, raw, index) {
    if (!isObject(raw)) {
      return null;
    }

    const startTime = typeof raw.startTime === "string" ? raw.startTime : "";
    const endTime = typeof raw.endTime === "string" ? raw.endTime : "";
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return null;
    }

    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : `${dateKey}_${index}_${createShiftId()}`;
    const workplaceMasterId = typeof raw.workplaceMasterId === "string" ? raw.workplaceMasterId : "";

    return {
      id,
      workplace: typeof raw.workplace === "string" ? raw.workplace : "",
      workplaceMasterId,
      lineName: typeof raw.lineName === "string" ? raw.lineName.trim() : "",
      patternId: typeof raw.patternId === "string" ? raw.patternId : "",
      patternName: typeof raw.patternName === "string" ? raw.patternName.trim() : "",
      startTime,
      endTime,
      breakMinutes: toNonNegativeNumber(raw.breakMinutes, 0),
      hourlyRate: toPositiveNumber(raw.hourlyRate, defaultState.settings.defaultHourlyRate),
      transport: toNonNegativeNumber(raw.transport, 0),
      memo: typeof raw.memo === "string" ? raw.memo : ""
    };
  }

  function normalizeMasters(rawMasters) {
    const list = [];

    if (Array.isArray(rawMasters)) {
      for (let i = 0; i < rawMasters.length; i += 1) {
        const normalized = normalizeMaster(rawMasters[i], i);
        if (normalized) {
          list.push(normalized);
        }
      }
    } else if (isObject(rawMasters)) {
      let index = 0;
      for (const item of Object.values(rawMasters)) {
        const normalized = normalizeMaster(item, index);
        index += 1;
        if (normalized) {
          list.push(normalized);
        }
      }
    }

    const byName = new Map();
    for (const master of list) {
      byName.set(normalizeNameKey(master.name), master);
    }

    return sortMasters(Array.from(byName.values()));
  }

  function normalizeMaster(raw, index) {
    if (!isObject(raw)) {
      return null;
    }

    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) {
      return null;
    }

    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : `${createMasterId()}_${index}`;

    return {
      id,
      name,
      defaultHourlyRate: toPositiveNumber(raw.defaultHourlyRate, defaultState.settings.defaultHourlyRate),
      defaultTransport: toNonNegativeNumber(raw.defaultTransport, 0),
      overtimeThreshold: toNonNegativeNumber(raw.overtimeThreshold, defaultState.settings.overtimeThreshold),
      overtimeMultiplier: Math.max(1, toPositiveNumber(raw.overtimeMultiplier, defaultState.settings.overtimeMultiplier)),
      taxRate: clamp(toNonNegativeNumber(raw.taxRate, defaultState.settings.taxRate), 0, 100),
      patterns: normalizePatternList(raw.patterns)
    };
  }

  function normalizePatternList(rawPatterns) {
    const list = [];

    if (Array.isArray(rawPatterns)) {
      for (let i = 0; i < rawPatterns.length; i += 1) {
        const normalized = normalizePattern(rawPatterns[i], i);
        if (normalized) {
          list.push(normalized);
        }
      }
    } else if (isObject(rawPatterns)) {
      let index = 0;
      for (const pattern of Object.values(rawPatterns)) {
        const normalized = normalizePattern(pattern, index);
        index += 1;
        if (normalized) {
          list.push(normalized);
        }
      }
    }

    const byId = new Map();
    for (const pattern of list) {
      byId.set(pattern.id, pattern);
    }

    return sortPatterns(Array.from(byId.values()));
  }

  function normalizePattern(raw, index) {
    if (!isObject(raw)) {
      return null;
    }

    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const startTime = typeof raw.startTime === "string" ? raw.startTime : "";
    const endTime = typeof raw.endTime === "string" ? raw.endTime : "";
    if (!name || !isValidTime(startTime) || !isValidTime(endTime)) {
      return null;
    }

    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : `${createPatternId()}_${index}`;
    return {
      id,
      lineName: typeof raw.lineName === "string" ? raw.lineName.trim() : "",
      name,
      startTime,
      endTime,
      breakMinutes: toNonNegativeNumber(raw.breakMinutes, 0)
    };
  }

  function upsertMaster(masters, target) {
    const normalizedTarget = normalizeMaster(target, 0);
    if (!normalizedTarget) {
      return sortMasters(masters);
    }

    let next = masters.filter((item) => item.id !== normalizedTarget.id);
    next = next.filter((item) => normalizeNameKey(item.name) !== normalizeNameKey(normalizedTarget.name));
    next.push(normalizedTarget);
    return sortMasters(next);
  }

  function upsertPatternList(patterns, targetPattern) {
    const normalizedTarget = normalizePattern(targetPattern, 0);
    if (!normalizedTarget) {
      return normalizePatternList(patterns);
    }

    const targetSignature = getPatternSignature(normalizedTarget);
    const next = normalizePatternList(patterns).filter(
      (item) => item.id !== normalizedTarget.id && getPatternSignature(item) !== targetSignature
    );
    next.push(normalizedTarget);
    return sortPatterns(next);
  }

  function mergePatternLists(localPatterns, remotePatterns) {
    const merged = new Map();
    for (const pattern of normalizePatternList(localPatterns)) {
      merged.set(getPatternSignature(pattern), pattern);
    }
    for (const pattern of normalizePatternList(remotePatterns)) {
      merged.set(getPatternSignature(pattern), pattern);
    }
    return sortPatterns(Array.from(merged.values()));
  }

  function sortMasters(masters) {
    return [...masters].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }

  function sortPatterns(patterns) {
    return [...patterns].sort((a, b) => {
      const lineDiff = (a.lineName || "").localeCompare(b.lineName || "", "ja");
      if (lineDiff !== 0) {
        return lineDiff;
      }
      const nameDiff = a.name.localeCompare(b.name, "ja");
      if (nameDiff !== 0) {
        return nameDiff;
      }
      const startDiff = a.startTime.localeCompare(b.startTime);
      if (startDiff !== 0) {
        return startDiff;
      }
      return a.id.localeCompare(b.id);
    });
  }

  function getPatternSignature(pattern) {
    return [
      normalizeNameKey(pattern.lineName),
      normalizeNameKey(pattern.name),
      pattern.startTime,
      pattern.endTime,
      String(pattern.breakMinutes)
    ].join("|");
  }

  function getMasterById(masterId) {
    if (!masterId) {
      return null;
    }
    return state.masters.find((item) => item.id === masterId) || null;
  }

  function findMasterByName(name) {
    const key = normalizeNameKey(name);
    if (!key) {
      return null;
    }
    return state.masters.find((item) => normalizeNameKey(item.name) === key) || null;
  }

  function resolveMasterIdForShift(shift) {
    if (shift.workplaceMasterId && getMasterById(shift.workplaceMasterId)) {
      return shift.workplaceMasterId;
    }

    if (shift.workplace) {
      const byName = findMasterByName(shift.workplace);
      if (byName) {
        return byName.id;
      }
    }

    return "";
  }

  function sortShifts(shifts) {
    return [...shifts].sort((a, b) => {
      const timeDiff = a.startTime.localeCompare(b.startTime);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.id.localeCompare(b.id);
    });
  }

  function isShiftLike(value) {
    return isObject(value) && typeof value.startTime === "string" && typeof value.endTime === "string";
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.warn("Service Worker registration failed", error);
      });
    });
  }

  function createShiftId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function createMasterId() {
    return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function createPatternId() {
    return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function loadActiveView() {
    const stored = localStorage.getItem(UI_VIEW_KEY);
    if (isValidViewName(stored)) {
      return stored;
    }
    return "shift";
  }

  function loadUiState() {
    try {
      const raw = localStorage.getItem(UI_STATE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      if (!isObject(parsed)) {
        return {};
      }
      return parsed;
    } catch (error) {
      return {};
    }
  }

  function persistUiState() {
    if (refs.bulkShiftForm) {
      bulkConfigState = normalizeBulkConfig(buildBulkConfigFromForm());
    }
    const payload = {
      currentMonthKey: toMonthKey(currentMonth),
      selectedDate,
      preferredWorkplaceMasterId,
      summaryMasterFilter,
      bulkConfig: bulkConfigState
    };
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(payload));
  }

  function isValidViewName(value) {
    return VIEW_NAMES.includes(value);
  }

  function normalizeSummaryMasterFilter(value) {
    if (typeof value !== "string" || !value.trim()) {
      return "all";
    }
    return value;
  }

  function parseMonthKey(value) {
    if (typeof value !== "string") {
      return null;
    }
    const matched = /^(\d{4})-(\d{2})$/.exec(value);
    if (!matched) {
      return null;
    }
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return null;
    }
    return new Date(year, month - 1, 1);
  }

  function toMonthKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
  }

  function isValidDateKey(value) {
    if (typeof value !== "string") {
      return false;
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function normalizeNameKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function toDateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function parseDateInput(value) {
    if (!isValidDateKey(value)) {
      return null;
    }
    const [year, month, day] = value.split("-").map((v) => Number(v));
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    return parsed;
  }

  function formatCurrency(value) {
    return `${Number(value).toLocaleString("ja-JP")} 円`;
  }

  function formatDateTime(isoText) {
    const date = new Date(isoText);
    if (Number.isNaN(date.getTime())) {
      return isoText;
    }
    return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(
      date.getHours()
    )}:${pad2(date.getMinutes())}`;
  }

  function toGoogleUtc(date) {
    return (
      date.getUTCFullYear() +
      pad2(date.getUTCMonth() + 1) +
      pad2(date.getUTCDate()) +
      "T" +
      pad2(date.getUTCHours()) +
      pad2(date.getUTCMinutes()) +
      pad2(date.getUTCSeconds()) +
      "Z"
    );
  }

  function isValidTime(timeText) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeText);
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function toNonNegativeNumber(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      return fallback;
    }
    return num;
  }

  function toPositiveNumber(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      return fallback;
    }
    return num;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(defaultState));
  }

  function escapeCsv(value) {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
