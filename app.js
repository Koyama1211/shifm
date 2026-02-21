(function () {
  "use strict";

  const STORAGE_KEY = "shifm_store_v3";
  const UI_VIEW_KEY = "shifm_ui_view_v1";
  const UI_STATE_KEY = "shifm_ui_state_v1";
  const SUPABASE_URL = "https://vnmccbcjcaesavgymrzd.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubWNjYmNqY2Flc2F2Z3ltcnpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NzUwMTAsImV4cCI6MjA4NzI1MTAxMH0.a3fhvtRGv_Mccb7N8T4T5n0RLFJ8mhpO2iae1zuzQw4";
  const SUPABASE_SYNC_TABLE = "shifm_sync";
  const LEGACY_STORAGE_KEYS = ["shifm_store_v2", "shifm_store_v1"];
  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const VIEW_NAMES = ["shift", "summary", "settings", "sync"];

  const defaultState = {
    shifts: {},
    masters: [],
    payrolls: [],
    settings: {
      defaultHourlyRate: 1100,
      overtimeThreshold: 8,
      overtimeMultiplier: 1.25,
      taxRate: 0
    },
    sync: {
      userId: "",
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
  let selectedMasterRateId = null;
  let preferredWorkplaceMasterId = uiState.preferredWorkplaceMasterId || "";
  let summaryMasterFilter = normalizeSummaryMasterFilter(uiState.summaryMasterFilter);
  let bulkConfigState = normalizeBulkConfig(uiState.bulkConfig);
  let mobileShiftPane = normalizeMobileShiftPane(uiState.mobileShiftPane);
  let activeView = loadActiveView();
  let autoSyncTimer = null;
  let authMode = "login";
  let authenticatedUserId = "";
  let supabaseClient = null;

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
    currentUserLabel: document.getElementById("currentUserLabel"),
    logoutButton: document.getElementById("logoutButton"),
    viewTabs: Array.from(document.querySelectorAll(".view-tab")),
    viewSections: Array.from(document.querySelectorAll(".view-section")),
    shiftLayout: document.getElementById("shiftLayout"),
    showShiftListPane: document.getElementById("showShiftListPane"),
    showShiftFormPane: document.getElementById("showShiftFormPane"),
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
    selectedDayShiftsLabel: document.getElementById("selectedDayShiftsLabel"),
    jumpToForm: document.getElementById("jumpToForm"),
    shiftFormPanel: document.getElementById("shiftFormPanel"),
    editingStatus: document.getElementById("editingStatus"),
    shiftForm: document.getElementById("shiftForm"),
    editingShiftId: document.getElementById("editingShiftId"),
    workplaceMaster: document.getElementById("workplaceMaster"),
    workplace: document.getElementById("workplace"),
    shiftLine: document.getElementById("shiftLine"),
    shiftPattern: document.getElementById("shiftPattern"),
    workplaceSuggestions: document.getElementById("workplaceSuggestions"),
    timeeWorkplaceNote: document.getElementById("timeeWorkplaceNote"),
    startTime: document.getElementById("startTime"),
    endTime: document.getElementById("endTime"),
    breakMinutes: document.getElementById("breakMinutes"),
    hourlyRate: document.getElementById("hourlyRate"),
    hourlyRateGroup: document.getElementById("hourlyRateGroup"),
    transport: document.getElementById("transport"),
    transportGroup: document.getElementById("transportGroup"),
    timeeCompensationFields: document.getElementById("timeeCompensationFields"),
    shiftStatusAutoLabel: document.getElementById("shiftStatusAutoLabel"),
    shiftStatus: document.getElementById("shiftStatus"),
    memo: document.getElementById("memo"),
    previewWorkedHours: document.getElementById("previewWorkedHours"),
    previewGrossPay: document.getElementById("previewGrossPay"),
    timeeEnabled: document.getElementById("timeeEnabled"),
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
    masterOvertimeThreshold: document.getElementById("masterOvertimeThreshold"),
    masterOvertimeMultiplier: document.getElementById("masterOvertimeMultiplier"),
    masterTaxRate: document.getElementById("masterTaxRate"),
    masterRateId: document.getElementById("masterRateId"),
    masterRateEffectiveFrom: document.getElementById("masterRateEffectiveFrom"),
    masterRateHourlyRate: document.getElementById("masterRateHourlyRate"),
    masterRateTransport: document.getElementById("masterRateTransport"),
    masterRateSave: document.getElementById("masterRateSave"),
    masterRateNew: document.getElementById("masterRateNew"),
    masterRateDelete: document.getElementById("masterRateDelete"),
    masterRateList: document.getElementById("masterRateList"),
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
    payrollForm: document.getElementById("payrollForm"),
    payrollMonth: document.getElementById("payrollMonth"),
    payrollWorkplaceMaster: document.getElementById("payrollWorkplaceMaster"),
    payrollAmount: document.getElementById("payrollAmount"),
    payrollPaidAt: document.getElementById("payrollPaidAt"),
    payrollList: document.getElementById("payrollList"),
    monthlyRows: document.getElementById("monthlyRows"),
    workplaceSummaryRows: document.getElementById("workplaceSummaryRows"),
    exportCsv: document.getElementById("exportCsv"),

    exportBackup: document.getElementById("exportBackup"),
    importBackup: document.getElementById("importBackup"),
    backupFileInput: document.getElementById("backupFileInput"),
    pullCloudMerge: document.getElementById("pullCloudMerge"),
    syncStatus: document.getElementById("syncStatus")
  };

  init().catch((error) => {
    console.error(error);
  });

  async function init() {
    const supabaseReady = initSupabase();
    bindAuthEvents();
    renderAuthView();
    updateCurrentUserLabel();
    bindEvents();
    registerServiceWorker();
    if (!supabaseReady) {
      lockApp({ clearStatus: false });
      return;
    }
    await restoreSupabaseSession();
  }

  function initSupabase() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      setAuthStatus("Supabase SDKの読み込みに失敗しました。通信環境を確認して再読み込みしてください。");
      return false;
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        authenticatedUserId = session.user.email || session.user.id;
        unlockApp();
        return;
      }
      authenticatedUserId = "";
      lockApp({ clearStatus: false });
    });
    return true;
  }

  async function restoreSupabaseSession() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      setAuthStatus(`認証状態の取得に失敗しました: ${error.message}`);
      lockApp({ clearStatus: false });
      return;
    }
    const session = data && data.session;
    if (session && session.user) {
      authenticatedUserId = session.user.email || session.user.id;
      unlockApp();
      return;
    }
    authenticatedUserId = "";
    lockApp({ clearStatus: false });
  }

  function bindAuthEvents() {
    refs.authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await submitAuth();
    });

    refs.authToggleMode.addEventListener("click", () => {
      authMode = authMode === "login" ? "register" : "login";
      setAuthStatus("");
      renderAuthView();
    });
  }

  async function submitAuth() {
    const email = refs.authUserId.value.trim().toLowerCase();
    const password = refs.authPassword.value;
    const passwordConfirm = refs.authPasswordConfirm.value;

    if (!email) {
      setAuthStatus("メールアドレスを入力してください。");
      return;
    }
    if (!isValidEmail(email)) {
      setAuthStatus("メールアドレス形式で入力してください。");
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
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
      });
      if (error) {
        setAuthStatus(error.message);
        return;
      }
      refs.authPassword.value = "";
      refs.authPasswordConfirm.value = "";
      if (data && data.session && data.user) {
        authenticatedUserId = data.user.email || data.user.id;
        setAuthStatus("");
        unlockApp();
        return;
      }
      authMode = "login";
      renderAuthView();
      setAuthStatus("登録しました。確認メールが届いた場合は認証後にログインしてください。");
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      setAuthStatus(error.message);
      return;
    }

    authenticatedUserId = data && data.user ? data.user.email || data.user.id : email;
    refs.authPassword.value = "";
    refs.authPasswordConfirm.value = "";
    setAuthStatus("");
    unlockApp();
  }

  function renderAuthView() {
    const isLogin = authMode === "login";
    refs.authTitle.textContent = isLogin ? "ログイン" : "新規登録";
    refs.authDescription.textContent = isLogin
      ? "登録済みメールアドレスで認証してください。"
      : "最初にメールアドレスとパスワードを登録します。";
    refs.authSubmit.textContent = isLogin ? "ログイン" : "登録";
    refs.authToggleMode.textContent = isLogin ? "新規登録に切替" : "ログインに切替";
    refs.authConfirmRow.hidden = isLogin;
    refs.authPasswordConfirm.required = !isLogin;
  }

  function unlockApp() {
    refs.authScreen.hidden = true;
    refs.appMain.hidden = false;
    refs.logoutButton.hidden = false;

    if (authenticatedUserId) {
      state.sync.userId = authenticatedUserId;
      persistState();
    }

    updateCurrentUserLabel();
    renderAll();
    queueAutoPullOnOpen();
  }

  function lockApp(options) {
    const clearStatus = !options || options.clearStatus !== false;
    clearTimeout(autoSyncTimer);
    refs.appMain.hidden = true;
    refs.authScreen.hidden = false;
    refs.logoutButton.hidden = true;
    refs.authPassword.value = "";
    refs.authPasswordConfirm.value = "";
    authenticatedUserId = "";
    updateCurrentUserLabel();
    authMode = "login";
    if (clearStatus) {
      setAuthStatus("");
    }
    renderAuthView();
  }

  function updateCurrentUserLabel() {
    if (!refs.currentUserLabel) {
      return;
    }
    const userId = authenticatedUserId || state.sync.userId || "-";
    refs.currentUserLabel.textContent = `ログイン中: ${userId}`;
  }

  function setAuthStatus(text) {
    refs.authStatus.textContent = text;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function bindEvents() {
    refs.logoutButton.addEventListener("click", async () => {
      if (supabaseClient) {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
          alert(`ログアウトに失敗しました: ${error.message}`);
          return;
        }
      }
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

    refs.jumpToForm.addEventListener("click", () => {
      if (!selectedDate) {
        alert("先に日付を選択してください。");
        return;
      }
      setMobileShiftPane("form");
      scrollToShiftForm();
    });

    refs.showShiftListPane.addEventListener("click", () => {
      setMobileShiftPane("list");
    });

    refs.showShiftFormPane.addEventListener("click", () => {
      setMobileShiftPane("form");
      scrollToShiftForm();
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

    refs.payrollForm.addEventListener("submit", (event) => {
      event.preventDefault();
      savePayrollFromForm();
    });

    refs.workplaceMaster.addEventListener("change", () => {
      const masterId = refs.workplaceMaster.value;
      if (!masterId) {
        preferredWorkplaceMasterId = "";
        selectedPatternId = null;
        applyCompensationToFormFromSelection();
        syncTimeeModeByWorkplace();
        renderShiftPatternControls();
        renderShiftPreview();
        persistUiState();
        return;
      }
      applyMasterToShiftForm(masterId, { override: true, remember: true });
      syncTimeeModeByWorkplace();
      renderShiftPreview();
    });

    refs.workplace.addEventListener("input", () => {
      syncTimeeModeByWorkplace();
      renderShiftPreview();
    });

    refs.shiftLine.addEventListener("change", () => {
      renderShiftPatternControls();
      renderShiftPreview();
    });

    refs.shiftPattern.addEventListener("change", () => {
      applySelectedShiftPattern();
      renderShiftPreview();
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

    const shiftPreviewFields = [
      refs.startTime,
      refs.endTime,
      refs.breakMinutes,
      refs.hourlyRate,
      refs.transport
    ];
    for (const field of shiftPreviewFields) {
      field.addEventListener("input", () => {
        renderShiftPreview();
      });
      field.addEventListener("change", () => {
        renderShiftPreview();
      });
    }

    refs.shiftForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!selectedDate) {
        alert("先に日付を選択してください。");
        return;
      }
      if (typeof refs.shiftForm.reportValidity === "function" && !refs.shiftForm.reportValidity()) {
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
      if (isCompactViewport()) {
        setMobileShiftPane("form");
      }
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
      selectedMasterRateId = null;
      renderMasterForm();
      renderMasterList();
      renderPatternForm();
      renderPatternList();
    });

    refs.masterDelete.addEventListener("click", () => {
      deleteSelectedMaster();
    });

    refs.masterRateSave.addEventListener("click", () => {
      saveMasterRateFromForm();
    });

    refs.masterRateNew.addEventListener("click", () => {
      selectedMasterRateId = null;
      renderMasterRateForm();
      renderMasterRateList();
    });

    refs.masterRateDelete.addEventListener("click", () => {
      deleteSelectedMasterRate();
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

    refs.exportBackup.addEventListener("click", () => {
      exportBackupFile();
    });

    refs.importBackup.addEventListener("click", () => {
      refs.backupFileInput.click();
    });

    refs.backupFileInput.addEventListener("change", async () => {
      await importBackupFromFile();
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
    renderTimeeInputState();
    renderSummaryMasterFilterOptions();
    renderBulkForm();
    renderWorkplaceSuggestions();
    renderSyncForm();
    renderCalendar();
    renderShiftForm();
    renderShiftPreview();
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

    renderShiftPaneState();
  }

  function renderShiftPaneState() {
    if (!refs.shiftLayout) {
      return;
    }
    const pane = normalizeMobileShiftPane(mobileShiftPane);
    refs.shiftLayout.classList.toggle("mobile-pane-list", pane === "list");
    refs.shiftLayout.classList.toggle("mobile-pane-form", pane === "form");

    refs.showShiftListPane.classList.toggle("is-active", pane === "list");
    refs.showShiftFormPane.classList.toggle("is-active", pane === "form");

    refs.showShiftListPane.setAttribute("aria-pressed", pane === "list" ? "true" : "false");
    refs.showShiftFormPane.setAttribute("aria-pressed", pane === "form" ? "true" : "false");
  }

  function setMobileShiftPane(nextPane) {
    mobileShiftPane = normalizeMobileShiftPane(nextPane);
    persistUiState();
    renderShiftPaneState();
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

  function isCompactViewport() {
    return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 860px)").matches;
  }

  function scrollToShiftForm() {
    if (!refs.shiftFormPanel) {
      return;
    }
    refs.shiftFormPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function renderCalendar() {
    refs.monthLabel.textContent = `${currentMonth.getFullYear()}年 ${currentMonth.getMonth() + 1}月`;
    refs.calendarGrid.innerHTML = "";

    for (let i = 0; i < WEEKDAYS.length; i += 1) {
      const day = WEEKDAYS[i];
      const dayCell = document.createElement("div");
      dayCell.className = "calendar-weekday";
      if (i === 0) {
        dayCell.classList.add("sun");
      } else if (i === 6) {
        dayCell.classList.add("sat");
      }
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
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0) {
        cell.classList.add("sun");
      } else if (dayOfWeek === 6) {
        cell.classList.add("sat");
      }
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
        count.textContent = `${dayShifts.length}`;
        cell.appendChild(count);

        const summary = summarizeDayStatus(dayKey, dayShifts);
        const status = document.createElement("div");
        status.className = `day-status day-status-dot ${summary.className}`;
        status.title = summary.label;
        status.setAttribute("aria-label", summary.label);
        cell.appendChild(status);

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
        if (isCompactViewport()) {
          setMobileShiftPane("list");
        }
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
      refs.editingStatus.textContent = "新規追加モード（一覧を選ぶと編集モードになります）";
      return;
    }

    refs.editingShiftId.value = editing.id;
    refs.workplace.value = editing.workplace || "";
    refs.startTime.value = editing.startTime;
    refs.endTime.value = editing.endTime;
    refs.breakMinutes.value = editing.breakMinutes;
    syncShiftStatusAutoLabel(selectedDate, editing);
    refs.memo.value = editing.memo || "";
    refs.timeeEnabled.checked = Boolean(editing.timeeEnabled);

    const matchedMasterId = resolveMasterIdForShift(editing);
    refs.workplaceMaster.value = matchedMasterId || "";
    refs.shiftLine.value = editing.lineName || "";
    refs.shiftPattern.value = editing.patternId || "";
    applyCompensationToFormFromSelection(editing);
    syncTimeeModeByWorkplace();
    renderShiftPatternControls();
    renderTimeeInputState();
    renderShiftPreview();

    refs.editingStatus.textContent = "編集モード（保存で上書き更新）";
  }

  function renderDayShiftList() {
    refs.dayShiftList.innerHTML = "";
    refs.selectedDayShiftsLabel.textContent = selectedDate ? `${selectedDate} を表示中` : "日付を選択してください";
    if (!selectedDate) {
      return;
    }

    const dayShifts = getDayShifts(selectedDate);
    refs.selectedDayShiftsLabel.textContent = `${selectedDate} / ${dayShifts.length}件`;
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

      const left = document.createElement("div");
      const titleEl = document.createElement("div");
      titleEl.className = "day-shift-title";
      titleEl.textContent = `${shift.startTime}-${shift.endTime}`;
      left.appendChild(titleEl);

      const workplaceLabel = shift.workplace ? shift.workplace : "勤務先未入力";
      const lineText = shift.lineName ? ` / ${shift.lineName}` : "";
      const patternText = shift.patternName ? ` / ${shift.patternName}` : "";
      const timeeText = shift.timeeEnabled ? " / タイミー" : "";
      const memo = shift.memo ? ` / ${shift.memo}` : "";

      const sub = document.createElement("div");
      sub.className = "day-shift-sub day-shift-meta";
      const status = document.createElement("span");
      const normalizedStatus = resolveAutoShiftStatus(selectedDate, shift);
      status.className = `shift-status-badge ${getShiftStatusClass(normalizedStatus)}`;
      status.textContent = getShiftStatusLabel(normalizedStatus);
      sub.appendChild(status);

      const details = document.createElement("span");
      details.textContent = `${workplaceLabel}${lineText}${patternText}${timeeText}${memo}`;
      sub.appendChild(details);
      left.appendChild(sub);

      const pay = document.createElement("div");
      pay.className = "day-shift-pay";
      pay.textContent = formatCurrency(result.gross);

      li.appendChild(left);
      li.appendChild(pay);

      li.addEventListener("click", () => {
        selectedShiftId = shift.id;
        renderShiftForm();
        renderDayShiftList();
        if (isCompactViewport()) {
          setMobileShiftPane("form");
          scrollToShiftForm();
        }
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
      refs.masterOvertimeThreshold.value = state.settings.overtimeThreshold;
      refs.masterOvertimeMultiplier.value = state.settings.overtimeMultiplier;
      refs.masterTaxRate.value = state.settings.taxRate;
      refs.masterDelete.disabled = true;
      selectedMasterRateId = null;
      renderMasterRateForm();
      renderMasterRateList();
      return;
    }

    refs.masterId.value = selected.id;
    refs.masterName.value = selected.name;
    refs.masterOvertimeThreshold.value = selected.overtimeThreshold;
    refs.masterOvertimeMultiplier.value = selected.overtimeMultiplier;
    refs.masterTaxRate.value = selected.taxRate;
    refs.masterDelete.disabled = false;
    renderMasterRateForm();
    renderMasterRateList();
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
          `現在 時給 ${formatCurrency(master.defaultHourlyRate)} / 交通費 ${formatCurrency(master.defaultTransport)} / 履歴 ${getMasterPayRates(
            master
          ).length}件 / パターン ${getMasterPatterns(master).length}件`
        ) +
        "</div></div>";

      li.addEventListener("click", () => {
        if (selectedMasterId !== master.id) {
          selectedPatternId = null;
          selectedMasterRateId = null;
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

  function renderMasterRateForm() {
    const master = getMasterById(selectedMasterId);
    if (!master) {
      refs.masterRateId.value = "";
      refs.masterRateEffectiveFrom.value = toDateKey(new Date());
      refs.masterRateHourlyRate.value = state.settings.defaultHourlyRate;
      refs.masterRateTransport.value = 0;
      refs.masterRateSave.disabled = true;
      refs.masterRateNew.disabled = true;
      refs.masterRateDelete.disabled = true;
      return;
    }

    const rates = getMasterPayRates(master);
    let target = rates.find((item) => item.id === selectedMasterRateId) || null;
    if (!target) {
      target = resolveMasterPayRateForDate(master, toDateKey(new Date()));
      selectedMasterRateId = target ? target.id : null;
    }

    if (!target) {
      refs.masterRateId.value = "";
      refs.masterRateEffectiveFrom.value = toDateKey(new Date());
      refs.masterRateHourlyRate.value = state.settings.defaultHourlyRate;
      refs.masterRateTransport.value = 0;
      refs.masterRateDelete.disabled = true;
    } else {
      refs.masterRateId.value = target.id;
      refs.masterRateEffectiveFrom.value = target.effectiveFrom;
      refs.masterRateHourlyRate.value = target.hourlyRate;
      refs.masterRateTransport.value = target.transport;
      refs.masterRateDelete.disabled = rates.length <= 1;
    }

    refs.masterRateSave.disabled = false;
    refs.masterRateNew.disabled = false;
  }

  function renderMasterRateList() {
    refs.masterRateList.innerHTML = "";
    const master = getMasterById(selectedMasterId);
    if (!master) {
      const empty = document.createElement("li");
      empty.className = "pattern-item";
      empty.innerHTML = '<div class="pattern-item-sub">先に勤務先マスタを保存してください。</div>';
      refs.masterRateList.appendChild(empty);
      return;
    }

    const rates = getMasterPayRates(master);
    if (rates.length === 0) {
      const empty = document.createElement("li");
      empty.className = "pattern-item";
      empty.innerHTML = '<div class="pattern-item-sub">給与履歴はまだありません。</div>';
      refs.masterRateList.appendChild(empty);
      return;
    }

    for (let i = 0; i < rates.length; i += 1) {
      const rate = rates[i];
      const li = document.createElement("li");
      li.className = "pattern-item";
      if (rate.id === selectedMasterRateId) {
        li.classList.add("active");
      }
      const rangeLabel = buildRateRangeLabel(rates, i);
      li.innerHTML =
        "<div><div>" +
        escapeHtml(rangeLabel) +
        '</div><div class="pattern-item-sub">' +
        escapeHtml(`時給 ${formatCurrency(rate.hourlyRate)} / 交通費 ${formatCurrency(rate.transport)}`) +
        "</div></div>";

      li.addEventListener("click", () => {
        selectedMasterRateId = rate.id;
        renderMasterRateForm();
        renderMasterRateList();
      });

      refs.masterRateList.appendChild(li);
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

  function renderTimeeInputState() {
    const enabled = Boolean(refs.timeeEnabled.checked);
    refs.timeeCompensationFields.hidden = !enabled;
    refs.timeeWorkplaceNote.hidden = !enabled;
    refs.hourlyRate.required = enabled;
    refs.transport.required = false;
    refs.hourlyRate.disabled = !enabled;
    refs.transport.disabled = !enabled;
    refs.hourlyRateGroup.hidden = !enabled;
    refs.transportGroup.hidden = !enabled;
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
    applyCompensationToFormFromSelection();
    syncTimeeModeByWorkplace();
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
    renderMasterSelectOptions(refs.payrollWorkplaceMaster, "勤務先を選択");
  }

  function renderMasterSelectOptions(selectElement, emptyLabel) {
    if (!selectElement) {
      return;
    }
    const previousValue = selectElement.value;
    selectElement.innerHTML = `<option value="">${escapeHtml(emptyLabel || "未選択")}</option>`;

    const masters = sortMasters(state.masters);
    for (const master of masters) {
      const currentRate = resolveMasterPayRateForDate(master, toDateKey(new Date()));
      const option = document.createElement("option");
      option.value = master.id;
      option.textContent = `${master.name} (時給 ${Number(currentRate.hourlyRate).toLocaleString("ja-JP")}円)`;
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

  function renderPayrollForm() {
    const defaultMonth = toMonthKey(currentMonth);
    const monthValue = normalizeMonthKeyInput(refs.payrollMonth.value) || defaultMonth;
    refs.payrollMonth.value = monthValue;
    if (!isValidDateKey(refs.payrollPaidAt.value)) {
      refs.payrollPaidAt.value = toDateKey(new Date());
    }
  }

  function renderPayrollList() {
    refs.payrollList.innerHTML = "";
    const targetMonth = toMonthKey(currentMonth);
    const records = normalizePayrollRecords(state.payrolls).filter((item) => item.monthKey === targetMonth);
    if (records.length === 0) {
      const empty = document.createElement("li");
      empty.className = "pattern-item";
      empty.innerHTML = '<div class="pattern-item-sub">この月の給与実績はまだありません。</div>';
      refs.payrollList.appendChild(empty);
      return;
    }

    for (const record of records) {
      const master = getMasterById(record.workplaceMasterId);
      const label = master ? master.name : "削除済み勤務先";
      const li = document.createElement("li");
      li.className = "pattern-item";
      li.innerHTML =
        "<div><div>" +
        escapeHtml(`${label} / ${record.monthKey}`) +
        '</div><div class="pattern-item-sub">' +
        escapeHtml(`支払日 ${record.paidAt} / 実績 ${formatCurrency(record.amount)}`) +
        "</div></div>";

      const actions = document.createElement("div");
      actions.className = "actions";
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "danger";
      removeButton.textContent = "削除";
      removeButton.addEventListener("click", () => {
        deletePayrollRecord(record.id);
      });
      actions.appendChild(removeButton);
      li.appendChild(actions);
      refs.payrollList.appendChild(li);
    }
  }

  function savePayrollFromForm() {
    const monthKey = normalizeMonthKeyInput(refs.payrollMonth.value);
    if (!monthKey) {
      alert("対象月を入力してください。");
      return;
    }

    const workplaceMasterId = refs.payrollWorkplaceMaster.value;
    if (!workplaceMasterId || !getMasterById(workplaceMasterId)) {
      alert("勤務先マスタを選択してください。");
      return;
    }

    const amount = toNonNegativeNumber(refs.payrollAmount.value, 0);
    if (amount <= 0) {
      alert("支払実績額を入力してください。");
      return;
    }

    const paidAt = isValidDateKey(refs.payrollPaidAt.value) ? refs.payrollPaidAt.value : toDateKey(new Date());
    const nextRecord = {
      id: createShiftId(),
      monthKey,
      workplaceMasterId,
      amount,
      paidAt
    };

    const normalizedRecords = normalizePayrollRecords(state.payrolls);
    const existingIndex = normalizedRecords.findIndex((item) => item.monthKey === monthKey && item.workplaceMasterId === workplaceMasterId);
    if (existingIndex >= 0) {
      const existing = normalizedRecords[existingIndex];
      nextRecord.id = existing.id;
    }

    state.payrolls = upsertPayrollRecord(normalizedRecords, nextRecord);
    persistState();
    renderCalendar();
    renderShiftForm();
    renderDayShiftList();
    renderSummary();
    queueAutoSync("給与実績保存");
    alert("給与実績を保存しました。関連シフトを自動で支払済みに反映しました。");
  }

  function deletePayrollRecord(recordId) {
    const normalizedRecords = normalizePayrollRecords(state.payrolls);
    const target = normalizedRecords.find((item) => item.id === recordId);
    if (!target) {
      return;
    }
    if (!window.confirm("この給与実績を削除しますか？")) {
      return;
    }
    state.payrolls = normalizedRecords.filter((item) => item.id !== recordId);
    persistState();
    renderCalendar();
    renderShiftForm();
    renderDayShiftList();
    renderSummary();
    queueAutoSync("給与実績削除");
  }

  function upsertPayrollRecord(records, targetRecord) {
    const normalized = normalizePayrollRecords(records);
    const next = normalized.filter(
      (item) => !(item.monthKey === targetRecord.monthKey && item.workplaceMasterId === targetRecord.workplaceMasterId)
    );
    next.push(targetRecord);
    return normalizePayrollRecords(next);
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
    if (state.sync.lastSyncedAt) {
      setSyncStatus(`自動同期中（最終保存: ${formatDateTime(state.sync.lastSyncedAt)}）`);
      return;
    }
    setSyncStatus("自動同期中（まだクラウド保存はありません）");
  }

  function renderSummary() {
    refs.summaryMonthLabel.textContent = `${currentMonth.getFullYear()}年 ${currentMonth.getMonth() + 1}月`;
    renderPayrollForm();
    renderPayrollList();

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
      const workplaceBase = row.shift.workplace || "-";
      const workplaceLabel = row.shift.timeeEnabled ? `タイミー / ${workplaceBase}` : workplaceBase;
      const workplaceText = row.shift.memo ? `${workplaceLabel} (${row.shift.memo})` : workplaceLabel;
      const normalizedStatus = resolveAutoShiftStatus(row.dateKey, row.shift);
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
        '<td><span class="shift-status-badge ' +
        escapeHtml(getShiftStatusClass(normalizedStatus)) +
        '">' +
        escapeHtml(getShiftStatusLabel(normalizedStatus)) +
        "</span></td>" +
        "<td>" +
        escapeHtml(formatCurrency(row.result.gross)) +
        "</td>";
      refs.monthlyRows.appendChild(tr);
    }

    if (filteredRows.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="5">該当データがありません。</td>';
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
    refs.shiftStatus.value = "planned";
    refs.shiftStatusAutoLabel.value = getShiftStatusLabel("planned");
    refs.memo.value = "";
    refs.timeeEnabled.checked = false;

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
    applyCompensationToFormFromSelection();
    syncTimeeModeByWorkplace();
    renderShiftPatternControls();
    renderTimeeInputState();
    renderShiftPreview();

    if (resetAll) {
      refs.editingStatus.textContent = "新規追加モード（一覧を選ぶと編集モードになります）";
    }
  }

  function renderShiftPreview() {
    if (!selectedDate) {
      refs.previewWorkedHours.textContent = "-";
      refs.previewGrossPay.textContent = "-";
      refs.shiftStatus.value = "planned";
      refs.shiftStatusAutoLabel.value = getShiftStatusLabel("planned");
      return;
    }

    const selectedMaster = getMasterById(refs.workplaceMaster.value);
    const timeeEnabled = Boolean(refs.timeeEnabled.checked);
    const draftShiftForStatus = {
      workplace: refs.workplace.value.trim(),
      workplaceMasterId: selectedMaster ? selectedMaster.id : "",
      timeeEnabled
    };
    syncShiftStatusAutoLabel(selectedDate, draftShiftForStatus);

    const startTime = refs.startTime.value.trim();
    const endTime = refs.endTime.value.trim();
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      refs.previewWorkedHours.textContent = "-";
      refs.previewGrossPay.textContent = "-";
      return;
    }

    const compensation = resolveCompensationForShift(
      selectedDate,
      {
        workplace: refs.workplace.value.trim(),
        workplaceMasterId: selectedMaster ? selectedMaster.id : "",
        timeeEnabled,
        hourlyRate: toPositiveNumber(refs.hourlyRate.value, 0),
        transport: toNonNegativeNumber(refs.transport.value, 0)
      },
      selectedMaster
    );
    if (compensation.hourlyRate <= 0) {
      refs.previewWorkedHours.textContent = "-";
      refs.previewGrossPay.textContent = "-";
      return;
    }

    const shift = {
      id: "__preview__",
      workplace: refs.workplace.value.trim(),
      workplaceMasterId: selectedMaster ? selectedMaster.id : "",
      lineName: refs.shiftLine.value.trim(),
      patternId: refs.shiftPattern.value || "",
      patternName: "",
      startTime,
      endTime,
      breakMinutes: toNonNegativeNumber(refs.breakMinutes.value, 0),
      hourlyRate: compensation.hourlyRate,
      transport: compensation.transport,
      shiftStatus: "planned",
      memo: refs.memo.value.trim(),
      timeeEnabled,
      timeeJobId: "",
      timeeFixedPay: 0
    };
    syncShiftStatusAutoLabel(selectedDate, shift);
    shift.shiftStatus = refs.shiftStatus.value;
    const result = calcShiftPay(selectedDate, shift);
    refs.previewWorkedHours.textContent = `${(result.workedMinutes / 60).toFixed(2)} 時間`;
    refs.previewGrossPay.textContent = formatCurrency(result.gross);
  }

  function buildShiftFromForm() {
    const selectedMaster = getMasterById(refs.workplaceMaster.value);
    const selectedPattern = selectedMaster
      ? getMasterPatterns(selectedMaster).find((item) => item.id === refs.shiftPattern.value)
      : null;
    const lineNameFromForm = refs.shiftLine.value.trim();
    const timeeEnabled = Boolean(refs.timeeEnabled.checked);
    const paySnapshot = resolveCompensationForShift(
      selectedDate || toDateKey(new Date()),
      {
        workplace: refs.workplace.value.trim(),
        workplaceMasterId: selectedMaster ? selectedMaster.id : ""
      },
      selectedMaster
    );
    const hourlyRateInput = toPositiveNumber(refs.hourlyRate.value, 0);
    const transportInput = toNonNegativeNumber(refs.transport.value, 0);
    const shift = {
      workplace: refs.workplace.value.trim(),
      workplaceMasterId: selectedMaster ? selectedMaster.id : "",
      lineName: lineNameFromForm,
      patternId: selectedPattern ? selectedPattern.id : "",
      patternName: selectedPattern ? selectedPattern.name : "",
      startTime: refs.startTime.value.trim(),
      endTime: refs.endTime.value.trim(),
      breakMinutes: toNonNegativeNumber(refs.breakMinutes.value, 0),
      hourlyRate: timeeEnabled ? hourlyRateInput : paySnapshot.hourlyRate,
      transport: timeeEnabled ? transportInput : paySnapshot.transport,
      shiftStatus: "planned",
      memo: refs.memo.value.trim(),
      timeeEnabled,
      timeeJobId: "",
      timeeFixedPay: 0
    };

    if (selectedPattern && selectedPattern.lineName) {
      shift.lineName = selectedPattern.lineName;
    }

    if (selectedMaster && !shift.workplace && !timeeEnabled) {
      shift.workplace = selectedMaster.name;
    }

    if (!shift.workplace) {
      throw new Error(timeeEnabled ? "タイミー案件先の勤務先名を入力してください。" : "勤務先を入力してください。");
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

    if (shift.timeeEnabled && shift.hourlyRate <= 0) {
      throw new Error("タイミー案件では時給を入力してください。");
    }

    shift.shiftStatus = resolveAutoShiftStatus(selectedDate || toDateKey(new Date()), shift);

    return shift;
  }

  function applyMasterToShiftForm(masterId, options) {
    const master = getMasterById(masterId);
    if (!master) {
      return false;
    }

    const override = !options || options.override !== false;
    const remember = !options || options.remember !== false;
    const isTimeeMaster = isTimeeWorkplaceName(master.name);
    const previousMasterId = refs.workplaceMaster.value;
    refs.workplaceMaster.value = master.id;
    if (previousMasterId !== master.id) {
      refs.shiftLine.value = "";
      refs.shiftPattern.value = "";
    }

    if (override) {
      refs.workplace.value = isTimeeMaster ? "" : master.name;
    } else {
      if (!refs.workplace.value.trim() && !isTimeeMaster) {
        refs.workplace.value = master.name;
      }
    }

    if (remember) {
      preferredWorkplaceMasterId = master.id;
      persistUiState();
    }

    applyCompensationToFormFromSelection();
    syncTimeeModeByWorkplace();
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
    const todayRate = resolveMasterPayRateForDate(master, toDateKey(new Date()));
    refs.bulkWorkplaceMaster.value = master.id;

    if (override) {
      refs.bulkWorkplace.value = master.name;
      refs.bulkHourlyRate.value = todayRate.hourlyRate;
      refs.bulkTransport.value = todayRate.transport;
    } else {
      if (!refs.bulkWorkplace.value.trim()) {
        refs.bulkWorkplace.value = master.name;
      }
      if (!refs.bulkHourlyRate.value) {
        refs.bulkHourlyRate.value = todayRate.hourlyRate;
      }
      if (!refs.bulkTransport.value) {
        refs.bulkTransport.value = todayRate.transport;
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
      shiftStatus: "planned",
      timeeEnabled: false,
      timeeJobId: "",
      timeeFixedPay: 0,
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
    const preferredRate = preferredMaster
      ? resolveMasterPayRateForDate(preferredMaster, toDateKey(new Date()))
      : null;
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = endOfMonth(currentMonth);

    return {
      workplaceMasterId: preferredMaster ? preferredMaster.id : "",
      workplace: preferredMaster ? preferredMaster.name : "",
      startTime: "",
      endTime: "",
      breakMinutes: 0,
      hourlyRate: preferredRate ? preferredRate.hourlyRate : state.settings.defaultHourlyRate,
      transport: preferredRate ? preferredRate.transport : 0,
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
    const effectiveDate = selectedDate || toDateKey(new Date());
    const compensation = resolveCompensationForShift(effectiveDate, {
      workplace: name,
      workplaceMasterId: refs.workplaceMaster.value || ""
    });

    const existing = findMasterByName(name);
    const masterId = existing ? existing.id : createMasterId();
    const baseRates = existing ? getMasterPayRates(existing) : [];
    if (baseRates.length === 0) {
      baseRates.push({
        id: createMasterRateId(),
        effectiveFrom: effectiveDate,
        hourlyRate: compensation.hourlyRate,
        transport: compensation.transport
      });
    }
    const master = {
      id: masterId,
      name,
      defaultHourlyRate: compensation.hourlyRate,
      defaultTransport: compensation.transport,
      overtimeThreshold: existing ? existing.overtimeThreshold : state.settings.overtimeThreshold,
      overtimeMultiplier: existing ? existing.overtimeMultiplier : state.settings.overtimeMultiplier,
      taxRate: existing ? existing.taxRate : state.settings.taxRate,
      payRates: baseRates,
      patterns: existing ? getMasterPatterns(existing) : []
    };

    state.masters = upsertMaster(state.masters, master);
    selectedMasterId = master.id;
    selectedMasterRateId = resolveMasterPayRateForDate(master, effectiveDate)?.id || null;

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
    const inheritedRates = inheritedSource ? getMasterPayRates(inheritedSource) : [];
    const rates = inheritedRates.length
      ? inheritedRates
      : [
          {
            id: createMasterRateId(),
            effectiveFrom: toDateKey(new Date()),
            hourlyRate: state.settings.defaultHourlyRate,
            transport: 0
          }
        ];
    const currentRate = resolvePayRateForDate(rates, toDateKey(new Date()));

    const master = {
      id: targetId,
      name,
      defaultHourlyRate: currentRate.hourlyRate,
      defaultTransport: currentRate.transport,
      overtimeThreshold,
      overtimeMultiplier,
      taxRate,
      payRates: rates,
      patterns: inheritedSource ? getMasterPatterns(inheritedSource) : []
    };

    state.masters = upsertMaster(state.masters, master);
    selectedMasterId = targetId;
    selectedMasterRateId = resolveMasterPayRateForDate(master, toDateKey(new Date()))?.id || null;

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

  function saveMasterRateFromForm() {
    const master = getMasterById(refs.masterId.value.trim() || selectedMasterId);
    if (!master) {
      alert("先に勤務先マスタを保存してください。");
      return;
    }

    const idFromForm = refs.masterRateId.value.trim();
    const effectiveFrom = refs.masterRateEffectiveFrom.value;
    const hourlyRate = toPositiveNumber(refs.masterRateHourlyRate.value, 0);
    const transport = toNonNegativeNumber(refs.masterRateTransport.value, 0);

    if (!isValidDateKey(effectiveFrom)) {
      alert("適用開始日を入力してください。");
      return;
    }
    if (hourlyRate <= 0) {
      alert("時給を入力してください。");
      return;
    }

    const nextRates = upsertMasterPayRate(
      getMasterPayRates(master),
      {
        id: idFromForm || createMasterRateId(),
        effectiveFrom,
        hourlyRate,
        transport
      }
    );
    const currentRate = resolvePayRateForDate(nextRates, toDateKey(new Date()));
    const nextMaster = {
      ...master,
      defaultHourlyRate: currentRate.hourlyRate,
      defaultTransport: currentRate.transport,
      payRates: nextRates
    };

    state.masters = upsertMaster(state.masters, nextMaster);
    selectedMasterId = nextMaster.id;
    selectedMasterRateId = nextRates.find((item) => item.effectiveFrom === effectiveFrom)?.id || idFromForm || null;

    persistState();
    renderMasterForm();
    renderMasterList();
    renderWorkplaceMasterOptions();
    renderShiftForm();
    renderDayShiftList();
    renderSummary();
    renderBulkForm();
    queueAutoSync("給与履歴保存");
    alert("給与履歴を保存しました。");
  }

  function deleteSelectedMasterRate() {
    const master = getMasterById(refs.masterId.value.trim() || selectedMasterId);
    if (!master) {
      return;
    }

    const rateId = refs.masterRateId.value.trim() || selectedMasterRateId;
    if (!rateId) {
      return;
    }

    const rates = getMasterPayRates(master);
    if (rates.length <= 1) {
      alert("給与履歴は最低1件必要です。");
      return;
    }

    const target = rates.find((item) => item.id === rateId);
    if (!target) {
      return;
    }

    if (!window.confirm(`適用開始日 ${target.effectiveFrom} の履歴を削除しますか？`)) {
      return;
    }

    const nextRates = rates.filter((item) => item.id !== rateId);
    const currentRate = resolvePayRateForDate(nextRates, toDateKey(new Date()));
    const nextMaster = {
      ...master,
      defaultHourlyRate: currentRate.hourlyRate,
      defaultTransport: currentRate.transport,
      payRates: nextRates
    };

    state.masters = upsertMaster(state.masters, nextMaster);
    selectedMasterId = nextMaster.id;
    selectedMasterRateId = resolveMasterPayRateForDate(nextMaster, toDateKey(new Date()))?.id || nextRates[0].id;

    persistState();
    renderMasterForm();
    renderMasterList();
    renderWorkplaceMasterOptions();
    renderShiftForm();
    renderDayShiftList();
    renderSummary();
    renderBulkForm();
    queueAutoSync("給与履歴削除");
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
    state.payrolls = normalizePayrollRecords(state.payrolls).filter((item) => item.workplaceMasterId !== masterId);
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
    selectedMasterRateId = null;
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
    const compensation = resolveCompensationForShift(dateKey, shift);

    const policy = resolvePayPolicyForShift(shift);
    const overtimeStart = policy.overtimeThreshold * 60;
    const regularMinutes = Math.min(workedMinutes, overtimeStart);
    const overtimeMinutes = Math.max(0, workedMinutes - overtimeStart);

    const regularPay = (regularMinutes / 60) * compensation.hourlyRate;
    const overtimePay = (overtimeMinutes / 60) * compensation.hourlyRate * policy.overtimeMultiplier;
    const gross = Math.round(regularPay + overtimePay + compensation.transport);
    const net = Math.round(gross * (1 - policy.taxRate / 100));

    return {
      workedMinutes,
      regularMinutes,
      overtimeMinutes,
      hourlyRate: compensation.hourlyRate,
      transport: compensation.transport,
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
    const result = calcShiftPay(dateKey, shift);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo";
    const url = new URL("https://calendar.google.com/calendar/render");

    url.searchParams.set("action", "TEMPLATE");
    url.searchParams.set("text", shift.workplace ? `${shift.workplace} シフト` : "バイトシフト");
    url.searchParams.set("dates", `${toGoogleUtc(range.start)}/${toGoogleUtc(range.end)}`);
    url.searchParams.set(
      "details",
      `勤務: ${shift.startTime}-${shift.endTime}\n状態: ${getShiftStatusLabel(
        resolveAutoShiftStatus(dateKey, shift)
      )}\n休憩: ${shift.breakMinutes}分\n時給: ${result.hourlyRate}円\n交通費: ${result.transport}円${
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
      const user = await requireSyncUser();
      if (!silent) {
        setSyncStatus("クラウドへ同期中...");
      }

      const payload = buildSyncPayload();
      const nowIso = new Date().toISOString();

      const { error } = await supabaseClient.from(SUPABASE_SYNC_TABLE).upsert({
        user_id: user.id,
        payload,
        updated_at: nowIso
      });
      if (error) {
        throw new Error(toSupabaseSyncErrorMessage(error, "同期"));
      }

      state.sync.lastSyncedAt = nowIso;
      persistState();
      setSyncStatus(`クラウドに保存しました (${formatDateTime(state.sync.lastSyncedAt)})`);
      if (!silent) {
        alert("クラウド同期が完了しました。");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "クラウド同期に失敗しました。";
      setSyncStatus(message);
      if (!silent) {
        alert(message);
      }
    }
  }

  async function pullFromCloud(mode, options) {
    const silent = options && options.silent;
    const skipConfirm = options && options.skipConfirm;
    const allowEmpty = options && options.allowEmpty;
    try {
      const user = await requireSyncUser();
      if (!silent) {
        setSyncStatus("クラウドから取得中...");
      }

      const { data, error } = await supabaseClient
        .from(SUPABASE_SYNC_TABLE)
        .select("payload,updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        throw new Error(toSupabaseSyncErrorMessage(error, "取得"));
      }
      if (!data || !data.payload) {
        if (allowEmpty) {
          setSyncStatus("クラウドに保存データがないため、この端末データを自動保存します。");
          return false;
        }
        throw new Error("クラウド保存データがありません。");
      }

      const parsed = isObject(data.payload) ? data.payload : JSON.parse(String(data.payload || "{}"));
      const remoteData = parsed && parsed.data ? parsed.data : {};
      const remoteShifts = normalizeShiftsMap(remoteData.shifts);
      const remoteMasters = normalizeMasters(remoteData.masters);
      const remotePayrolls = normalizePayrollRecords(remoteData.payrolls);
      const remoteSettings = isObject(remoteData.settings) ? remoteData.settings : {};
      const remoteUpdatedAt = parsed && parsed.updatedAt ? parsed.updatedAt : data.updated_at || "不明";

      if (mode === "overwrite") {
        const ok = skipConfirm ? true : window.confirm(`クラウドのデータ (${remoteUpdatedAt}) で上書きしますか？`);
        if (!ok) {
          setSyncStatus("取得をキャンセルしました。");
          return false;
        }

        state.shifts = remoteShifts;
        state.masters = remoteMasters;
        state.payrolls = remotePayrolls;
        state.settings = {
          ...defaultState.settings,
          ...state.settings,
          ...remoteSettings
        };
      } else {
        state.shifts = mergeShiftMaps(state.shifts, remoteShifts);
        state.masters = mergeMasters(state.masters, remoteMasters);
        state.payrolls = mergePayrollRecords(state.payrolls, remotePayrolls);
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
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "クラウド取得に失敗しました。";
      setSyncStatus(message);
      if (!silent) {
        alert(message);
      }
      return false;
    }
  }

  function queueAutoPullOnOpen() {
    setTimeout(() => {
      pullFromCloud("merge", { silent: true, allowEmpty: true }).then((pulled) => {
        if (!pulled) {
          queueAutoSync("初回同期");
        }
      });
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
        const mergedRates = mergePayRates(getMasterPayRates(existing), getMasterPayRates(master));
        const currentRate = resolvePayRateForDate(mergedRates, toDateKey(new Date()));
        byName.set(key, {
          ...existing,
          name: master.name,
          defaultHourlyRate: currentRate.hourlyRate,
          defaultTransport: currentRate.transport,
          overtimeThreshold: master.overtimeThreshold,
          overtimeMultiplier: master.overtimeMultiplier,
          taxRate: master.taxRate,
          payRates: mergedRates,
          patterns: mergePatternLists(existing.patterns, master.patterns)
        });
      } else {
        byName.set(key, master);
      }
    }

    return sortMasters(Array.from(byName.values()));
  }

  function mergePayrollRecords(localRecords, remoteRecords) {
    const merged = new Map();
    for (const item of normalizePayrollRecords(localRecords)) {
      merged.set(`${item.monthKey}::${item.workplaceMasterId}`, item);
    }
    for (const item of normalizePayrollRecords(remoteRecords)) {
      merged.set(`${item.monthKey}::${item.workplaceMasterId}`, item);
    }
    return normalizePayrollRecords(Array.from(merged.values()));
  }

  function buildSyncPayload() {
    return {
      version: 9,
      updatedAt: new Date().toISOString(),
      data: {
        shifts: state.shifts,
        masters: state.masters,
        payrolls: state.payrolls,
        settings: state.settings
      }
    };
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
      const incomingPayrolls = normalizePayrollRecords(rawData.payrolls);
      const incomingSettings = isObject(rawData.settings) ? rawData.settings : {};

      if (!window.confirm("現在データをバックアップ内容で上書きしますか？")) {
        setSyncStatus("バックアップ読み込みをキャンセルしました。");
        return;
      }

      state.shifts = incomingShifts;
      state.masters = incomingMasters;
      state.payrolls = incomingPayrolls;
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
    if (!authenticatedUserId || !supabaseClient) {
      return;
    }
    clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(() => {
      pushToCloud({ silent: true });
    }, 1800);
    setSyncStatus(`${reason}: 自動同期を予約しました...`);
  }

  async function requireSyncUser() {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data || !data.user) {
      throw new Error("同期するにはログインが必要です。");
    }
    return data.user;
  }

  function toSupabaseSyncErrorMessage(error, actionLabel) {
    const message = error && typeof error.message === "string" ? error.message : `${actionLabel}に失敗しました。`;
    if (message.includes("relation") && message.includes("does not exist")) {
      return `${actionLabel}に失敗しました。Supabaseテーブル「${SUPABASE_SYNC_TABLE}」の作成が必要です。`;
    }
    if (message.includes("permission denied") || message.includes("row-level security")) {
      return `${actionLabel}に失敗しました。SupabaseのRLSポリシーを確認してください。`;
    }
    return `${actionLabel}に失敗しました: ${message}`;
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
      "タイミー案件",
      "勤務ステータス",
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
        row.result.hourlyRate,
        row.result.transport,
        row.shift.timeeEnabled ? "はい" : "いいえ",
        getShiftStatusLabel(resolveAutoShiftStatus(row.dateKey, row.shift)),
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
        payrolls: normalizePayrollRecords(parsed.payrolls),
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
      shiftStatus: normalizeShiftStatus(raw.shiftStatus),
      memo: typeof raw.memo === "string" ? raw.memo : "",
      timeeEnabled: Boolean(raw.timeeEnabled),
      timeeJobId: typeof raw.timeeJobId === "string" ? raw.timeeJobId.trim() : "",
      timeeFixedPay: toNonNegativeNumber(raw.timeeFixedPay, 0)
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

  function normalizePayrollRecords(rawRecords) {
    const list = [];
    let candidates = [];
    if (Array.isArray(rawRecords)) {
      candidates = rawRecords;
    } else if (isObject(rawRecords)) {
      candidates = Object.values(rawRecords);
    }

    for (let i = 0; i < candidates.length; i += 1) {
      const raw = candidates[i];
      if (!isObject(raw)) {
        continue;
      }
      const monthKey = normalizeMonthKeyInput(raw.monthKey);
      const workplaceMasterId = typeof raw.workplaceMasterId === "string" ? raw.workplaceMasterId.trim() : "";
      if (!monthKey || !workplaceMasterId) {
        continue;
      }
      list.push({
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id : createShiftId(),
        monthKey,
        workplaceMasterId,
        amount: toNonNegativeNumber(raw.amount, 0),
        paidAt: isValidDateKey(raw.paidAt) ? raw.paidAt : toDateKey(new Date())
      });
    }

    list.sort((a, b) => {
      const monthDiff = b.monthKey.localeCompare(a.monthKey);
      if (monthDiff !== 0) {
        return monthDiff;
      }
      const paidAtDiff = b.paidAt.localeCompare(a.paidAt);
      if (paidAtDiff !== 0) {
        return paidAtDiff;
      }
      return a.workplaceMasterId.localeCompare(b.workplaceMasterId);
    });

    return list;
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
    const normalizedRates = normalizePayRates(
      raw.payRates || raw.payHistory || raw.wageHistory,
      toPositiveNumber(raw.defaultHourlyRate, defaultState.settings.defaultHourlyRate),
      toNonNegativeNumber(raw.defaultTransport, 0)
    );
    const todayRate = resolvePayRateForDate(normalizedRates, toDateKey(new Date()));

    return {
      id,
      name,
      defaultHourlyRate: todayRate.hourlyRate,
      defaultTransport: todayRate.transport,
      overtimeThreshold: toNonNegativeNumber(raw.overtimeThreshold, defaultState.settings.overtimeThreshold),
      overtimeMultiplier: Math.max(1, toPositiveNumber(raw.overtimeMultiplier, defaultState.settings.overtimeMultiplier)),
      taxRate: clamp(toNonNegativeNumber(raw.taxRate, defaultState.settings.taxRate), 0, 100),
      payRates: normalizedRates,
      patterns: normalizePatternList(raw.patterns)
    };
  }

  function normalizePayRates(rawRates, fallbackHourlyRate, fallbackTransport) {
    const list = [];
    let candidates = [];
    if (Array.isArray(rawRates)) {
      candidates = rawRates;
    } else if (isObject(rawRates)) {
      candidates = Object.values(rawRates);
    }

    for (let i = 0; i < candidates.length; i += 1) {
      const raw = candidates[i];
      if (!isObject(raw)) {
        continue;
      }
      const effectiveFrom = typeof raw.effectiveFrom === "string" ? raw.effectiveFrom : raw.startDate;
      if (!isValidDateKey(effectiveFrom)) {
        continue;
      }
      const hourlyRate = toPositiveNumber(raw.hourlyRate, 0);
      if (hourlyRate <= 0) {
        continue;
      }
      list.push({
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id : createMasterRateId(),
        effectiveFrom,
        hourlyRate,
        transport: toNonNegativeNumber(raw.transport, 0)
      });
    }

    if (list.length === 0) {
      list.push({
        id: createMasterRateId(),
        effectiveFrom: "1970-01-01",
        hourlyRate: toPositiveNumber(fallbackHourlyRate, defaultState.settings.defaultHourlyRate),
        transport: toNonNegativeNumber(fallbackTransport, 0)
      });
    }

    const byDate = new Map();
    for (const item of list) {
      byDate.set(item.effectiveFrom, item);
    }

    return Array.from(byDate.values()).sort((a, b) => {
      const dateDiff = a.effectiveFrom.localeCompare(b.effectiveFrom);
      if (dateDiff !== 0) {
        return dateDiff;
      }
      return a.id.localeCompare(b.id);
    });
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

  function mergePayRates(localRates, remoteRates) {
    return normalizePayRates(
      [...normalizePayRates(localRates, state.settings.defaultHourlyRate, 0), ...normalizePayRates(remoteRates, state.settings.defaultHourlyRate, 0)],
      state.settings.defaultHourlyRate,
      0
    );
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

  function getMasterPayRates(master) {
    if (!master) {
      return [];
    }
    return normalizePayRates(master.payRates, master.defaultHourlyRate, master.defaultTransport);
  }

  function resolvePayRateForDate(rates, dateKey) {
    const list = Array.isArray(rates) ? rates : [];
    if (list.length === 0) {
      return {
        id: "",
        effectiveFrom: "1970-01-01",
        hourlyRate: state.settings.defaultHourlyRate,
        transport: 0
      };
    }

    const targetDate = isValidDateKey(dateKey) ? dateKey : toDateKey(new Date());
    let selected = list[0];
    for (const rate of list) {
      if (rate.effectiveFrom <= targetDate) {
        selected = rate;
      } else {
        break;
      }
    }
    return selected;
  }

  function resolveMasterPayRateForDate(master, dateKey) {
    return resolvePayRateForDate(getMasterPayRates(master), dateKey);
  }

  function resolveCompensationForShift(dateKey, shift, preResolvedMaster) {
    if (shift && shift.timeeEnabled) {
      const timeeHourlyRate = toPositiveNumber(shift.hourlyRate, 0);
      if (timeeHourlyRate > 0) {
        return {
          hourlyRate: timeeHourlyRate,
          transport: toNonNegativeNumber(shift.transport, 0)
        };
      }
    }

    const master = preResolvedMaster || getMasterById(shift.workplaceMasterId) || findMasterByName(shift.workplace);
    if (master) {
      const payRate = resolveMasterPayRateForDate(master, dateKey);
      return {
        hourlyRate: payRate.hourlyRate,
        transport: payRate.transport
      };
    }
    return {
      hourlyRate: toPositiveNumber(shift.hourlyRate, state.settings.defaultHourlyRate),
      transport: toNonNegativeNumber(shift.transport, 0)
    };
  }

  function applyCompensationToFormFromSelection(editingShift) {
    const dateKey = selectedDate || toDateKey(new Date());
    const selectedMaster = getMasterById(refs.workplaceMaster.value);
    const sourceShift = editingShift || {
      workplace: refs.workplace.value.trim(),
      workplaceMasterId: selectedMaster ? selectedMaster.id : ""
    };
    const compensation = resolveCompensationForShift(dateKey, sourceShift, selectedMaster);
    refs.hourlyRate.value = compensation.hourlyRate;
    refs.transport.value = compensation.transport;
    return compensation;
  }

  function isTimeeWorkplaceName(text) {
    const normalized = normalizeNameKey(text);
    if (!normalized) {
      return false;
    }
    return normalized.includes("タイミー") || normalized.includes("timee");
  }

  function syncTimeeModeByWorkplace() {
    const wasEnabled = Boolean(refs.timeeEnabled.checked);
    const master = getMasterById(refs.workplaceMaster.value);
    const fromMaster = master ? master.name : "";
    const fromInput = refs.workplace.value;
    const masterIsTimee = isTimeeWorkplaceName(fromMaster);
    const enabled = masterIsTimee || isTimeeWorkplaceName(fromInput);
    refs.timeeEnabled.checked = enabled;

    if (enabled) {
      refs.workplace.placeholder = "例: 渋谷カフェ（案件先）";
      if (masterIsTimee && isTimeeWorkplaceName(refs.workplace.value)) {
        refs.workplace.value = "";
      }
      if (!wasEnabled || !refs.hourlyRate.value) {
        applyCompensationToFormFromSelection();
      }
    } else {
      refs.workplace.placeholder = "例: カフェA";
    }
    renderTimeeInputState();
  }

  function buildRateRangeLabel(rates, index) {
    const current = rates[index];
    if (!current) {
      return "";
    }
    const next = rates[index + 1];
    if (!next) {
      return `${current.effectiveFrom} 〜`;
    }
    const endDate = addDaysToDateKey(next.effectiveFrom, -1);
    return `${current.effectiveFrom} 〜 ${endDate}`;
  }

  function addDaysToDateKey(dateKey, offsetDays) {
    const parsed = parseDateInput(dateKey);
    if (!parsed) {
      return dateKey;
    }
    parsed.setDate(parsed.getDate() + offsetDays);
    return toDateKey(parsed);
  }

  function upsertMasterPayRate(rates, targetRate) {
    const normalized = normalizePayRates(
      [
        ...rates.filter((item) => item.id !== targetRate.id && item.effectiveFrom !== targetRate.effectiveFrom),
        targetRate
      ],
      state.settings.defaultHourlyRate,
      0
    );
    return normalized;
  }

  function normalizeShiftStatus(value) {
    if (value === "worked" || value === "paid" || value === "planned") {
      return value;
    }
    return "planned";
  }

  function resolveAutoShiftStatus(dateKey, shift) {
    if (!isValidDateKey(dateKey) || !shift) {
      return "planned";
    }
    if (hasPayrollRecordForShift(dateKey, shift)) {
      return "paid";
    }
    const todayKey = toDateKey(new Date());
    if (dateKey < todayKey) {
      return "worked";
    }
    return "planned";
  }

  function hasPayrollRecordForShift(dateKey, shift) {
    const monthKey = dateKey.slice(0, 7);
    const masterId = resolveMasterIdForShift(shift);
    if (!masterId) {
      return false;
    }
    const record = normalizePayrollRecords(state.payrolls).find(
      (item) => item.monthKey === monthKey && item.workplaceMasterId === masterId
    );
    if (!record) {
      return false;
    }
    if (!isValidDateKey(record.paidAt)) {
      return true;
    }
    return dateKey <= record.paidAt;
  }

  function syncShiftStatusAutoLabel(dateKey, shift) {
    const status = resolveAutoShiftStatus(dateKey, shift);
    refs.shiftStatus.value = status;
    refs.shiftStatusAutoLabel.value = getShiftStatusLabel(status);
  }

  function getShiftStatusLabel(status) {
    const normalized = normalizeShiftStatus(status);
    if (normalized === "worked") {
      return "勤務済み";
    }
    if (normalized === "paid") {
      return "支払済み";
    }
    return "予定";
  }

  function getShiftStatusClass(status) {
    const normalized = normalizeShiftStatus(status);
    return `status-${normalized}`;
  }

  function summarizeDayStatus(dateKey, dayShifts) {
    if (!Array.isArray(dayShifts) || dayShifts.length === 0) {
      return {
        label: "予定",
        className: "status-planned"
      };
    }

    let planned = 0;
    let worked = 0;
    let paid = 0;
    for (const shift of dayShifts) {
      const status = resolveAutoShiftStatus(dateKey, shift);
      if (status === "paid") {
        paid += 1;
      } else if (status === "worked") {
        worked += 1;
      } else {
        planned += 1;
      }
    }

    if (paid === dayShifts.length) {
      return {
        label: "支払済",
        className: "status-paid"
      };
    }

    if (planned === dayShifts.length) {
      return {
        label: "予定",
        className: "status-planned"
      };
    }

    if (planned === 0 && worked + paid === dayShifts.length) {
      return {
        label: "勤務済",
        className: "status-worked"
      };
    }

    return {
      label: "混在",
      className: "status-mixed"
    };
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

  function createMasterRateId() {
    return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
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
      bulkConfig: bulkConfigState,
      mobileShiftPane
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

  function normalizeMobileShiftPane(value) {
    if (value === "form" || value === "list") {
      return value;
    }
    return "list";
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

  function normalizeMonthKeyInput(value) {
    if (typeof value !== "string") {
      return "";
    }
    const matched = /^(\d{4})-(\d{2})$/.exec(value.trim());
    if (!matched) {
      return "";
    }
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return "";
    }
    return `${matched[1]}-${matched[2]}`;
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
