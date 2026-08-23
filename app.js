(function () {
  "use strict";

  function applyTheme() {
    // 다른 공부방용 theme.js에서 값을 빠뜨려도 "undefined" 노출·중단 없이 동작해야 한다
    var theme = window.RewordTheme || {};
    var colors = theme.colors || {};
    var brandName = theme.brandName || "";
    var appName = theme.appName || "";
    var colorVariables = {
      bg: "--bg",
      surface: "--surface",
      ink: "--ink",
      inkSoft: "--ink-soft",
      line: "--line",
      accent: "--accent",
      accentDeep: "--accent-deep",
      accentSoft: "--accent-soft",
      accentLine: "--accent-line",
      oliveType: "--olive-type",
      gold: "--gold",
      gradientStart: "--gradient-start",
      gradientEnd: "--gradient-end",
      penRed: "--pen-red",
      penRedSoft: "--pen-red-soft",
      paperLine: "--paper-line",
      marginRed: "--margin-red",
      pencil: "--pencil"
    };

    Object.keys(colorVariables).forEach(function (colorName) {
      if (colors[colorName]) {
        document.documentElement.style.setProperty(colorVariables[colorName], colors[colorName]);
      }
    });

    document.querySelectorAll("[data-theme-slot]").forEach(function (element) {
      var slotName = element.dataset.themeSlot;
      var slotValue = theme[slotName] || "";

      if (slotName === "contactLine" && brandName) {
        var dividerIndex = String(slotValue).indexOf("·");
        slotValue = dividerIndex === -1 ? slotValue : brandName + " " + String(slotValue).slice(dividerIndex);
      }
      element.textContent = slotValue;
    });

    document.querySelectorAll("[data-theme-logo]").forEach(function (logo) {
      logo.replaceChildren();
      var logoType = logo.dataset.themeLogo;
      var imageSource = logoType === "full"
        ? theme.logoImageFull || theme.logoImage
        : theme.logoImage || theme.logoImageFull;

      logo.classList.toggle("is-text-fallback", !imageSource);
      if (imageSource) {
        var image = document.createElement("img");
        image.src = imageSource;
        image.alt = "";
        logo.appendChild(image);
      } else {
        logo.textContent = theme.logoText || "";
      }
    });

    if (appName || brandName) {
      document.title = (appName || "동그라미") + " | " + brandName;
    }
    document.querySelector("meta[name='description']").setAttribute(
      "content",
      brandName + " 단어시험 오답관리 앱 " + (appName || "동그라미") + " 시연 버전"
    );
  }

  applyTheme();

  var query = new URLSearchParams(window.location.search);
  var apiBaseUrl = query.get("api");
  var tenantSlug = query.get("t");
  var adapter = apiBaseUrl && tenantSlug
    ? new window.RewordAdapters.RealAdapter(apiBaseUrl, tenantSlug)
    : new window.RewordAdapters.MockAdapter();
  var state = {
    role: null,
    currentUser: null,
    currentStudent: null,
    currentView: "login",
    selectedFile: null,
    analysis: null,
    wrongItems: [],
    wordbookFilter: "all",
    quizCount: 5,
    quizChoice: "5",
    quiz: null,
    teacherStudentId: null,
    failedPinAttempts: 0,
    lockUntil: 0,
    lockTimer: null,
    toastTimer: null,
    tests: [],
    captureStudents: [],
    imageBitmap: null,
    imageRotation: 0,
    maskRect: null,
    maskEnabled: true,
    maskDragging: null,
    rotationRetried: false,
    correctedHalfRule: true,
    gateOverrideRequired: false,
    consentLinks: {}
  };

  var viewNames = ["login", "consent", "capture", "analysis", "wordbook", "retest", "records", "teacher", "teacher-detail"];

  function byId(id) {
    return document.getElementById(id);
  }

  function makeElement(tagName, className, textValue) {
    var element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }
    if (typeof textValue === "string") {
      element.textContent = textValue;
    }
    return element;
  }

  function makeButton(textValue, className, onClick) {
    var button = makeElement("button", className, textValue);
    button.type = "button";
    if (onClick) {
      button.addEventListener("click", onClick);
    }
    return button;
  }

  function makeSvgElement(tagName, attributes) {
    var element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
    Object.keys(attributes || {}).forEach(function (attributeName) {
      element.setAttribute(attributeName, attributes[attributeName]);
    });
    return element;
  }

  function createGradingMark(markType) {
    var isCircle = markType === "circle";
    var svg = makeSvgElement("svg", {
      class: isCircle ? "grade-mark grade-circle-mark" : "grade-mark grade-slash-mark",
      viewBox: "0 0 260 64",
      preserveAspectRatio: "none",
      "aria-hidden": "true",
      focusable: "false"
    });
    var path = makeSvgElement("path", {
      pathLength: "1",
      d: isCircle
        ? "M238 15C198 1 73 1 26 14C-1 22 2 48 34 57C80 69 203 63 239 48C259 39 259 23 238 15"
        : "M18 55C72 43 157 28 242 9"
    });
    svg.appendChild(path);
    return svg;
  }

  function createGraduationStamp() {
    var svg = makeSvgElement("svg", {
      class: "graduation-stamp",
      viewBox: "0 0 150 150",
      role: "img",
      "aria-label": "참 잘했어요 도장"
    });
    var outer = makeSvgElement("circle", { cx: "75", cy: "75", r: "61" });
    var inner = makeSvgElement("circle", { cx: "75", cy: "75", r: "52" });
    var smudge = makeSvgElement("path", {
      class: "stamp-smudge",
      d: "M31 37C49 16 91 10 119 31M126 105C109 132 64 142 34 119"
    });
    var text = makeSvgElement("text", { x: "75", y: "82", "text-anchor": "middle" });
    text.textContent = "참 잘했어요";
    svg.append(outer, inner, smudge, text);
    return svg;
  }

  function createGraduationBotanicalAccent() {
    var svg = makeSvgElement("svg", {
      class: "botanical-accent botanical-graduation",
      viewBox: "0 0 100 92",
      "aria-hidden": "true",
      focusable: "false"
    });
    [
      "M93 6C82 20 73 32 64 47C55 61 48 74 43 88",
      "M79 26C78 16 83 9 92 6C95 15 89 23 79 26Z",
      "M66 45C55 44 48 39 45 30C55 28 63 34 66 45Z",
      "M64 47C64 37 69 30 78 27C81 36 75 44 64 47Z",
      "M52 66C42 66 35 61 32 52C42 50 49 56 52 66Z",
      "M49 71C50 61 56 55 65 53C67 62 61 69 49 71Z"
    ].forEach(function (pathData) {
      svg.appendChild(makeSvgElement("path", { d: pathData }));
    });
    return svg;
  }

  function formatDate(dateString) {
    var parts = String(dateString || "").split("-");
    if (parts.length !== 3) {
      return dateString || "날짜 확인 중";
    }
    return parts[0] + ". " + Number(parts[1]) + ". " + Number(parts[2]) + ".";
  }

  function formatConsentDate(dateString) {
    var match = String(dateString || "").match(/^\d{4}-(\d{2})-(\d{2})/);
    return match ? Number(match[1]) + ". " + Number(match[2]) + "." : "";
  }

  function formatConsentExpiry(dateString) {
    var match = String(dateString || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match
      ? "만료 " + match[1] + ". " + Number(match[2]) + ". " + Number(match[3]) + "."
      : "만료일 확인 중";
  }

  function getTest(testId) {
    return state.tests.find(function (test) {
      return test.id === testId;
    });
  }

  function getTestTitle(testId) {
    var test = getTest(testId);
    return test ? test.title : testId;
  }

  function showToast(message) {
    var toast = byId("toast");
    window.clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    state.toastTimer = window.setTimeout(function () {
      toast.hidden = true;
    }, 2600);
  }

  function resetScroll() {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      window.scrollTo(0, 0);
    }
  }

  function setNavigationState(viewName) {
    var navigation = byId("student-navigation");
    var activeView = viewName === "analysis" ? "capture" : viewName;

    navigation.querySelectorAll("button[data-view]").forEach(function (button) {
      if (button.dataset.view === activeView) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
  }

  async function showView(viewName) {
    viewNames.forEach(function (name) {
      var view = byId(name + "-view");
      var active = name === viewName;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });

    state.currentView = viewName;
    byId("student-navigation").hidden = state.role !== "student" || viewName === "consent";
    byId("student-navigation").querySelector("button[data-view='capture']").hidden =
      adapter.isReal && state.role === "student";
    byId("logout-button").hidden = !state.role;
    byId("brand-home").disabled = viewName === "consent";

    if (state.role === "student") {
      setNavigationState(viewName);
    }

    if (viewName === "consent") {
      renderConsent();
    } else if (viewName === "capture") {
      await renderCapture();
    } else if (viewName === "wordbook") {
      await renderWordbook();
    } else if (viewName === "retest") {
      await renderRetestStart();
    } else if (viewName === "records") {
      await renderRecords();
    } else if (viewName === "teacher") {
      await renderTeacherDashboard();
    } else if (viewName === "teacher-detail") {
      await renderTeacherDetail();
    }

    resetScroll();
  }

  function renderConsent() {
    var checkbox = byId("consent-checkbox");
    checkbox.checked = false;
    byId("consent-agree-button").disabled = true;
  }

  function updateConsentAction() {
    byId("consent-agree-button").disabled = !byId("consent-checkbox").checked;
  }

  async function saveConsentAndContinue() {
    if (!state.currentStudent || !byId("consent-checkbox").checked) {
      return;
    }
    await adapter.acknowledge(state.currentStudent.id);
    await showView(adapter.isReal ? "wordbook" : "capture");
  }

  function switchLoginTab(tabName) {
    var isStudent = tabName === "student";
    byId("student-tab").classList.toggle("is-active", isStudent);
    byId("teacher-tab").classList.toggle("is-active", !isStudent);
    byId("student-tab").setAttribute("aria-selected", String(isStudent));
    byId("teacher-tab").setAttribute("aria-selected", String(!isStudent));
    byId("student-login-panel").hidden = !isStudent;
    byId("teacher-login-panel").hidden = isStudent;
    window.setTimeout(function () {
      byId(isStudent ? "student-pin" : "teacher-password").focus();
    }, 0);
  }

  function updatePinLock() {
    var remaining = Math.ceil((state.lockUntil - Date.now()) / 1000);
    var input = byId("student-pin");
    var button = byId("student-login-button");
    var message = byId("pin-message");

    if (remaining <= 0) {
      window.clearInterval(state.lockTimer);
      state.lockTimer = null;
      state.lockUntil = 0;
      state.failedPinAttempts = 0;
      input.disabled = false;
      button.disabled = false;
      message.textContent = "다시 입력할 수 있어요.";
      input.focus();
      return;
    }

    input.disabled = true;
    button.disabled = true;
    message.textContent = "입력을 잠시 쉬어 주세요. " + remaining + "초 후 다시 시도할 수 있어요.";
  }

  function startPinLock() {
    // 실서비스에서는 서버 rate-limit으로도 같은 제한을 적용해야 합니다.
    state.lockUntil = Date.now() + 30000;
    updatePinLock();
    state.lockTimer = window.setInterval(updatePinLock, 250);
  }

  async function handleStudentLogin(event) {
    event.preventDefault();
    var pin = byId("student-pin").value;
    var message = byId("pin-message");

    if (state.lockUntil > Date.now()) {
      updatePinLock();
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      message.textContent = "숫자 4자리를 입력해 주세요.";
      return;
    }

    var student;
    try {
      student = await adapter.authenticateStudent(pin);
    } catch (error) {
      message.textContent = error.message || "로그인 요청에 실패했어요.";
      return;
    }
    if (!student) {
      state.failedPinAttempts += 1;
      byId("student-pin").value = "";
      if (state.failedPinAttempts >= 5) {
        startPinLock();
      } else {
        message.textContent = "PIN이 맞지 않아요. " + (5 - state.failedPinAttempts) + "번 더 확인할 수 있어요.";
        byId("student-pin").focus();
      }
      return;
    }

    state.failedPinAttempts = 0;
    state.currentStudent = student;
    state.role = "student";
    message.textContent = "";
    byId("student-pin").value = "";
    if (adapter.isReal) {
      await showView("consent");
    } else {
      await showView(await adapter.getConsent(student.id) ? "capture" : "consent");
    }
  }

  async function handleTeacherLogin(event) {
    event.preventDefault();
    var passwordInput = byId("teacher-password");
    var loginIdInput = byId("teacher-login-id");
    var message = byId("teacher-message");
    var user;

    try {
      user = await adapter.authenticateTeacher(loginIdInput.value.trim(), passwordInput.value);
    } catch (error) {
      message.textContent = error.message || "로그인 요청에 실패했어요.";
      return;
    }
    if (!user) {
      message.textContent = "비밀번호를 다시 확인해 주세요.";
      passwordInput.select();
      return;
    }

    state.role = "teacher";
    state.currentUser = user;
    state.currentStudent = null;
    passwordInput.value = "";
    message.textContent = "";
    await showView("teacher");
  }

  async function logout() {
    await adapter.logout();
    state.role = null;
    state.currentUser = null;
    state.currentStudent = null;
    state.analysis = null;
    state.wrongItems = [];
    state.quiz = null;
    state.selectedFile = null;
    state.imageBitmap = null;
    state.consentLinks = {};
    byId("camera-input").value = "";
    byId("gallery-input").value = "";
    byId("selected-file").textContent = "";
    switchLoginTab("student");
    await showView("login");
  }

  async function populateTestSelect() {
    var select = byId("test-select");
    select.replaceChildren();
    var automatic = makeElement("option", "", "사진에서 자동 인식 (기본)");
    automatic.value = "";
    select.appendChild(automatic);
    state.tests = await adapter.getTests();
    state.tests.filter(function (test) { return test.source !== "photo"; }).forEach(function (test) {
      var option = makeElement("option", "", test.title + " · " + test.id);
      option.value = test.id;
      select.appendChild(option);
    });
    updateFormPreset();
  }

  async function renderCapture() {
    var targetField = byId("capture-student-field");
    var targetSelect = byId("capture-student-select");
    if (state.role === "teacher") {
      var students = await adapter.getStudents();
      state.captureStudents = students;
      targetSelect.replaceChildren();
      students.forEach(function (student) {
        var option = makeElement("option", "", student.nickname + " · " + student.grade);
        option.value = student.id;
        targetSelect.appendChild(option);
      });
      var selectedId = state.currentStudent && students.some(function (student) {
        return student.id === state.currentStudent.id;
      }) ? state.currentStudent.id : targetSelect.value;
      targetSelect.value = selectedId;
      state.currentStudent = students.find(function (student) { return student.id === selectedId; }) || null;
      state.teacherStudentId = state.currentStudent ? state.currentStudent.id : null;
      targetField.hidden = false;
      byId("student-greeting").textContent = "조교 촬영 모드";
    } else {
      targetField.hidden = true;
      if (!state.currentStudent) {
        return;
      }
      byId("student-greeting").textContent = state.currentStudent.nickname + ", 어서 와!";
    }
    await populateTestSelect();
    byId("analysis-setup").hidden = !state.selectedFile;
    byId("analysis-progress").hidden = true;
    byId("analysis-progress").classList.remove("is-running");
    byId("analysis-progress").querySelector("[role='progressbar']").setAttribute("aria-valuenow", "0");
    byId("selected-file").textContent = state.selectedFile ? "선택한 사진: " + state.selectedFile.name : "";
  }

  async function selectImage(file) {
    if (!file) {
      return;
    }
    state.selectedFile = file;
    state.imageRotation = 0;
    state.maskEnabled = true;
    byId("mask-enabled").checked = true;
    state.rotationRetried = false;
    try {
      state.imageBitmap = await window.createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (error) {
      state.imageBitmap = await window.createImageBitmap(file);
    }
    updateFormPreset();
    renderImageCanvas();
    byId("selected-file").textContent = "선택한 사진: " + file.name;
    byId("analysis-setup").hidden = false;
    byId("analysis-setup").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function presetRect(formHint) {
    return window.RewordMask.presetRect(formHint);
  }

  function updateFormPreset() {
    var test = getTest(byId("test-select").value);
    var preset = test && test.formHint ? test.formHint : "other";
    if (preset === "netutor") {
      preset = "netutor-unit";
    }
    byId("form-preset").value = preset;
    state.maskRect = presetRect(preset);
    renderImageCanvas();
  }

  function renderImageCanvas(editorDecoration) {
    var canvas = byId("image-canvas");
    if (!canvas || !state.imageBitmap) {
      if (canvas) {
        canvas.hidden = true;
      }
      return;
    }
    var sourceWidth = state.imageBitmap.width;
    var sourceHeight = state.imageBitmap.height;
    var quarterTurn = Math.abs(state.imageRotation % 180) === 90;
    var rotatedWidth = quarterTurn ? sourceHeight : sourceWidth;
    var rotatedHeight = quarterTurn ? sourceWidth : sourceHeight;
    var scale = Math.min(2000 / Math.max(rotatedWidth, rotatedHeight), 1); // 2000px = 서버 상한. 1600에선 작은 세모(△)를 놓침 (2026-08-23 실측)
    canvas.width = Math.max(1, Math.round(rotatedWidth * scale));
    canvas.height = Math.max(1, Math.round(rotatedHeight * scale));
    canvas.hidden = false;
    var context = canvas.getContext("2d");
    context.save();
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(state.imageRotation * Math.PI / 180);
    context.drawImage(
      state.imageBitmap,
      -sourceWidth * scale / 2,
      -sourceHeight * scale / 2,
      sourceWidth * scale,
      sourceHeight * scale
    );
    context.restore();
    if (state.maskEnabled && state.maskRect) {
      window.RewordMask.applyMask(
        context,
        canvas,
        state.maskRect,
        state.imageRotation,
        editorDecoration !== false
      );
    }
  }

  function rotateImage(degrees) {
    state.imageRotation = (state.imageRotation + degrees + 360) % 360;
    renderImageCanvas();
  }

  function canvasPoint(event) {
    var canvas = byId("image-canvas");
    var bounds = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    };
  }

  function startMaskDrag(event) {
    if (!state.maskEnabled || !state.maskRect) {
      return;
    }
    var point = canvasPoint(event);
    var displayRect = window.RewordMask.clampRect(state.maskRect);
    var handleSize = 0.035;
    if (
      Math.abs(point.x - (displayRect.x + displayRect.width)) <= handleSize &&
      Math.abs(point.y - (displayRect.y + displayRect.height)) <= handleSize
    ) {
      state.maskDragging = { mode: "resize", rect: displayRect };
      byId("image-canvas").setPointerCapture(event.pointerId);
      return;
    }
    if (
      point.x >= displayRect.x && point.x <= displayRect.x + displayRect.width &&
      point.y >= displayRect.y && point.y <= displayRect.y + displayRect.height
    ) {
      state.maskDragging = {
        mode: "move",
        x: point.x - displayRect.x,
        y: point.y - displayRect.y,
        rect: displayRect
      };
      byId("image-canvas").setPointerCapture(event.pointerId);
    }
  }

  function moveMask(event) {
    if (!state.maskDragging || !state.maskRect) {
      return;
    }
    var point = canvasPoint(event);
    var displayRect = state.maskDragging.rect;
    if (state.maskDragging.mode === "resize") {
      displayRect = window.RewordMask.clampRect({
        x: displayRect.x,
        y: displayRect.y,
        width: Math.max(0.025, point.x - displayRect.x),
        height: Math.max(0.025, point.y - displayRect.y)
      });
    } else {
      displayRect = window.RewordMask.clampRect({
        x: point.x - state.maskDragging.x,
        y: point.y - state.maskDragging.y,
        width: displayRect.width,
        height: displayRect.height
      });
    }
    state.maskRect = window.RewordMask.clampRect(displayRect);
    renderImageCanvas();
  }

  function stopMaskDrag() {
    state.maskDragging = null;
  }

  function preparedCanvasImage() {
    return new Promise(function (resolve, reject) {
      renderImageCanvas(false);
      byId("image-canvas").toBlob(function (blob) {
        renderImageCanvas(true);
        if (!blob) {
          reject(new Error("이미지를 준비하지 못했습니다."));
          return;
        }
        var reader = new FileReader();
        reader.addEventListener("load", function () {
          resolve({
            base64: String(reader.result).split(",")[1],
            mimeType: "image/jpeg"
          });
        });
        reader.addEventListener("error", function () { reject(reader.error); });
        reader.readAsDataURL(blob);
      }, "image/jpeg", 0.85);
    });
  }

  function correctionDegrees(orientation) {
    if (orientation === "rotated_cw") {
      return -90;
    }
    if (orientation === "rotated_ccw") {
      return 90;
    }
    if (orientation === "upside_down") {
      return 180;
    }
    return 0;
  }

  async function analyzeSelectedSheet() {
    var setup = byId("analysis-setup");
    var progress = byId("analysis-progress");
    var testId = byId("test-select").value;
    var button = byId("analyze-button");

    if (!state.selectedFile || !state.currentStudent) {
      showToast("사진과 학생을 먼저 선택해 주세요.");
      return;
    }

    button.disabled = true;
    setup.hidden = true;
    progress.hidden = false;
    window.requestAnimationFrame(function () {
      progress.classList.add("is-running");
      progress.querySelector("[role='progressbar']").setAttribute("aria-valuenow", "100");
    });

    // 판독 중 로그아웃·재로그인하면 응답이 다른 학생 세션에 저장되는 것 방지
    var requestStudent = state.currentStudent;

    try {
      var image = await preparedCanvasImage();
      var analysis = await adapter.analyzeSheet(image, testId, requestStudent.id);
      var rotation = correctionDegrees(analysis.orientation);
      if (analysis.hint === "ROTATE" && rotation && !state.rotationRetried) {
        state.rotationRetried = true;
        rotateImage(rotation);
        image = await preparedCanvasImage();
        analysis = await adapter.analyzeSheet(image, testId, requestStudent.id);
      }
      if (!state.currentStudent || state.currentStudent.id !== requestStudent.id) {
        return;
      }
      state.analysis = analysis;
      state.correctedHalfRule = !analysis.rules || analysis.rules.correctedHalfRule !== false;
      state.gateOverrideRequired = false;
      state.wrongItems = analysis.wrongItems.map(function (item) {
        return Object.assign({}, item);
      });
      byId("manual-confirm-checkbox").checked = false;
      byId("override-deduction").value = "";
      byId("override-reason").value = "";
      byId("duplicate-resolution").hidden = true;
      renderAnalysis();
      await showView("analysis");
    } catch (error) {
      if (!state.currentStudent || state.currentStudent.id !== requestStudent.id) {
        return;
      }
      setup.hidden = false;
      progress.hidden = true;
      progress.classList.remove("is-running");
      showToast(error.message || "판독하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      button.disabled = false;
    }
  }

  function renderAnalysisSummary() {
    var container = byId("analysis-summary");
    var card = makeElement("div", "card analysis-score-card");
    var copy = makeElement("div");
    var registeredTest = getTest(state.analysis.testId);
    var recognizedTest = state.analysis.test || {
      id: state.analysis.testId,
      title: registeredTest ? registeredTest.title : state.analysis.testId,
      totalQuestions: state.analysis.total,
      source: registeredTest && registeredTest.source || "registered"
    };
    var titleRow = makeElement("div", "analysis-test-heading");
    var title = makeElement(
      "h2",
      "",
      "인식한 시험: " + recognizedTest.title + " · " + recognizedTest.totalQuestions + "문항"
    );
    titleRow.appendChild(title);
    if (state.analysis.rules && state.analysis.rules.totalEstimated) {
      titleRow.appendChild(makeElement("span", "version-badge", "추정"));
    }
    var meta = makeElement("div", "analysis-meta", formatDate(state.analysis.detectedDate));
    var score = makeElement("div", "big-score", String(state.analysis.score));
    var total = makeElement("small", "", "/" + state.analysis.total);

    copy.append(titleRow, meta);
    score.appendChild(total);
    card.append(copy, score);
    container.replaceChildren(card);
  }

  function currentGateResult() {
    if (adapter.isReal) {
      var expectedHalf = state.analysis.expected === null
        ? null
        : Math.round(Number(state.analysis.expected) * 2);
      var wrongHalf = state.wrongItems.filter(function (item) {
        return item.mark === "wrong";
      }).length * 2;
      var corrected = state.wrongItems.filter(function (item) {
        return item.mark === "corrected";
      }).length;
      return {
        pass: !state.gateOverrideRequired && expectedHalf !== null && (
          expectedHalf === wrongHalf ||
          (state.correctedHalfRule && expectedHalf === wrongHalf + corrected)
        ),
        expected: expectedHalf === null ? null : expectedHalf / 2
      };
    }
    return window.RewordCore.gateCheck(state.analysis.total, state.analysis.score, state.wrongItems.length);
  }

  function hasValidWrongItems() {
    // 만점(오답 0개)도 성적 기록 저장은 가능해야 하므로 빈 목록을 유효로 본다
    return state.wrongItems.every(function (item) {
      return item.word.trim() && item.meaning.trim() && item.mark !== "unclear";
    });
  }

  function overrideDeductionHalf() {
    var inputValue = byId("override-deduction").value.trim();
    var value = Number(inputValue);
    var half = Math.round(value * 2);
    return inputValue !== "" && Number.isFinite(value) && value >= 0 &&
      value <= state.analysis.total && half / 2 === value
      ? half : null;
  }

  function renderGate() {
    var result = currentGateResult();
    var gate = makeElement("div", result.pass ? "gate" : "gate is-warning");
    var strong;
    var detail;
    var confirmation = byId("manual-confirmation");
    var checkbox = byId("manual-confirm-checkbox");
    var deductionField = byId("override-deduction-field");
    var reasonField = byId("override-reason-field");
    var overrideReason = byId("override-reason").value.trim();
    var unresolved = state.wrongItems.filter(function (item) { return item.mark === "unclear"; }).length;
    var needsDeduction = adapter.isReal && state.analysis.expected === null;

    if (result.pass) {
      strong = makeElement("strong", "", adapter.isReal
        ? "감점 " + result.expected + "점과 채점 표시가 딱 맞아요"
        : "오답 " + result.expected + "개 예상, 발견 " + state.wrongItems.length + "개 — 딱 맞아요");
      detail = makeElement("span", "", "점수와 찾은 오답 수가 맞아요. 단어를 한 번 더 살펴봐 주세요.");
      confirmation.hidden = true;
      checkbox.checked = false;
    } else {
      strong = makeElement("strong", "", unresolved
        ? "판독이 불확실한 문항을 모두 선택해 주세요"
        : "예상과 달라요. 다시 찍거나 아래에서 직접 고쳐 주세요");
      detail = makeElement("span", "", adapter.isReal
        ? (unresolved
          ? "각 불확실 문항을 오답·세모로 바꾸거나 목록에서 제외해 주세요."
          : "감점과 현재 오답·세모 표시를 시험지와 다시 대조해 주세요.")
        : "점수로는 " + result.expected + "개가 예상되지만, 현재 " + state.wrongItems.length + "개가 있어요.");
      confirmation.hidden = false;
    }

    deductionField.hidden = !needsDeduction;
    reasonField.hidden = result.pass;

    gate.append(strong, detail);
    byId("gate-card").replaceChildren(gate);
    byId("wrong-count").textContent = state.wrongItems.length + "개";
    byId("save-words-button").disabled = (!result.pass && (!checkbox.checked || !overrideReason)) ||
      !hasValidWrongItems() || (needsDeduction && overrideDeductionHalf() === null);
  }

  function updateWrongItem(index, fieldName, value) {
    state.wrongItems[index][fieldName] = value;
    renderGate();
  }

  function excludeWrongItem(index) {
    state.wrongItems.splice(index, 1);
    byId("manual-confirm-checkbox").checked = false;
    renderWrongList();
    renderGate();
  }

  function renderWrongList() {
    var container = byId("wrong-list");
    var fragment = document.createDocumentFragment();

    state.wrongItems.forEach(function (item, index) {
      var row = makeElement("div", "wrong-item");
      row.classList.toggle("is-unclear", item.mark === "unclear");
      var number = makeElement("div", "question-number", String(item.questionNo));
      var body = makeElement("div", "wrong-fields");
      var wordLabel = makeElement("label", "sr-only", "영어단어");
      var wordField = makeElement("div", "word-field");
      var wordInput = makeElement("input", "word-input");
      var meaningLabel = makeElement("label", "sr-only", "한글 뜻");
      var meaningInput = makeElement("input", "meaning-input");
      var actions = makeElement("div", "wrong-item-actions");
      var exclude = makeButton("제외", "exclude-button", function () {
        excludeWrongItem(index);
      });
      var wordId = "wrong-word-" + index;
      var meaningId = "wrong-meaning-" + index;

      wordLabel.htmlFor = wordId;
      wordInput.id = wordId;
      wordInput.type = "text";
      wordInput.value = item.word;
      var photoMode = state.analysis.test && state.analysis.test.source === "photo";
      wordInput.readOnly = adapter.isReal && !photoMode;
      wordInput.autocomplete = "off";
      wordInput.addEventListener("input", function () {
        updateWrongItem(index, "word", wordInput.value);
      });
      wordField.appendChild(wordInput);
      if (item.inferred === true) {
        wordField.appendChild(makeElement("span", "inferred-badge", "추정 — 확인해 주세요"));
      }

      meaningLabel.htmlFor = meaningId;
      meaningInput.id = meaningId;
      meaningInput.type = "text";
      meaningInput.value = item.meaning;
      meaningInput.readOnly = adapter.isReal && !photoMode;
      meaningInput.autocomplete = "off";
      meaningInput.addEventListener("input", function () {
        updateWrongItem(index, "meaning", meaningInput.value);
      });

      if (adapter.isReal) {
        var markLabel = makeElement("label", "sr-only", "채점 표시");
        var markSelect = makeElement("select", "mark-select");
        markLabel.htmlFor = "wrong-mark-" + index;
        markSelect.id = "wrong-mark-" + index;
        [
          { value: "unclear", label: "판독 불확실 — 선택해 주세요" },
          { value: "wrong", label: "오답 /" },
          { value: "corrected", label: "세모 △" }
        ].forEach(function (optionData) {
          var option = makeElement("option", "", optionData.label);
          option.value = optionData.value;
          markSelect.appendChild(option);
        });
        markSelect.value = ["unclear", "wrong", "corrected"].includes(item.mark)
          ? item.mark : "unclear";
        markSelect.addEventListener("change", function () {
          updateWrongItem(index, "mark", markSelect.value);
          row.classList.toggle("is-unclear", markSelect.value === "unclear");
        });
        actions.append(markLabel, markSelect);
      }
      actions.appendChild(exclude);
      body.append(wordLabel, wordField, meaningLabel, meaningInput, actions);
      row.append(number, body);
      fragment.appendChild(row);
    });

    if (!state.wrongItems.length) {
      var empty = makeElement("div", "empty-state");
      empty.append(
        makeElement("strong", "", "남은 오답이 없어요"),
        makeElement("span", "", "다시 찍거나 시험지와 대조해 확인해 주세요.")
      );
      fragment.appendChild(empty);
    }

    container.replaceChildren(fragment);
  }

  function renderAnalysis() {
    if (!state.analysis) {
      return;
    }
    renderAnalysisSummary();
    renderWrongList();
    renderGate();
  }

  function renderDuplicateResolution(existing) {
    var container = byId("duplicate-resolution");
    var attemptLabel = existing && existing.attemptLabel ? " · " + existing.attemptLabel : "";
    var title = makeElement("strong", "", "오늘 저장한 시험 기록이 이미 있어요");
    var detail = makeElement(
      "span",
      "",
      "기존 기록: " + (existing && existing.attemptNo ? existing.attemptNo : "?") + "회차" + attemptLabel
    );
    var actions = makeElement("div", "duplicate-resolution-actions");
    actions.append(
      makeButton("새 회차로 저장", "button button-secondary", function () { saveWords("new_attempt"); }),
      makeButton("이전 것 교체", "button button-primary", function () { saveWords("replace"); })
    );
    container.replaceChildren(title, detail, actions);
    container.hidden = false;
    byId("save-words-button").disabled = true;
    container.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveWords(onDuplicate) {
    var gate = currentGateResult();
    var confirmed = byId("manual-confirm-checkbox").checked;
    var overrideReason = byId("override-reason").value.trim();
    var needsDeduction = adapter.isReal && state.analysis.expected === null;
    var deductionHalf = needsDeduction ? overrideDeductionHalf() : null;

    if ((!gate.pass && (!confirmed || !overrideReason)) || !hasValidWrongItems() ||
      (needsDeduction && deductionHalf === null)) {
      showToast("목록을 확인한 뒤 저장해 주세요.");
      return;
    }

    try {
      byId("duplicate-resolution").hidden = true;
      await adapter.saveAnalysis(
        state.currentStudent.id,
        state.analysis,
        state.wrongItems,
        !gate.pass && confirmed ? overrideReason : "",
        { onDuplicate: onDuplicate, deductionHalf: deductionHalf }
      );
    } catch (error) {
      if (error.code === "DUPLICATE" && error.details && error.details.existing) {
        renderDuplicateResolution(error.details.existing);
        return;
      }
      if (error.code === "GATE_MISMATCH") {
        state.gateOverrideRequired = true;
        byId("manual-confirm-checkbox").checked = false;
        renderGate();
        byId("override-reason").focus();
        showToast("예상과 다른 이유를 입력한 뒤 다시 저장해 주세요.");
        return;
      }
      showToast(error.message || "저장하지 못했어요.");
      return;
    }
    state.selectedFile = null;
    byId("camera-input").value = "";
    byId("gallery-input").value = "";
    showToast("오답 단어와 시험 기록을 저장했어요.");
    if (state.role === "teacher") {
      state.teacherStudentId = state.currentStudent.id;
    }
    await showView(state.role === "teacher" ? "teacher-detail" : "wordbook");
  }

  function statusCounts(words) {
    return words.reduce(function (counts, word) {
      if (word.status === "graduated") {
        counts.graduated += 1;
      } else {
        counts.learning += 1;
      }
      return counts;
    }, { learning: 0, graduated: 0 });
  }

  function answerDots(count) {
    var safeCount = Math.max(0, Math.min(Number(count) || 0, 2));
    return "●".repeat(safeCount) + "○".repeat(2 - safeCount);
  }

  async function renderWordbook() {
    if (!state.currentStudent) {
      return;
    }
    var words = await adapter.getWordbook(state.currentStudent.id);
    var counts = statusCounts(words);
    var visibleWords = words.filter(function (word) {
      return state.wordbookFilter === "all" || word.status === state.wordbookFilter;
    });
    var fragment = document.createDocumentFragment();

    byId("wordbook-summary").textContent = "학습 중 " + counts.learning + "개 · 다 외운 단어 " + counts.graduated + "개";
    byId("wordbook-filters").querySelectorAll("button[data-filter]").forEach(function (button) {
      var active = button.dataset.filter === state.wordbookFilter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    visibleWords.forEach(function (word) {
      var card = makeElement("article", word.status === "graduated" ? "word-card is-graduated" : "word-card");
      var topline = makeElement("div", "word-topline");
      var english = makeElement("strong", "word-english", word.word);
      var badge = makeElement("span", word.status === "graduated" ? "status-badge is-graduated" : "status-badge", word.status === "graduated" ? "다 외운 단어" : "학습 중");
      var meaning = makeElement("p", "word-meaning", word.meaning);
      var meta = makeElement("div", "word-meta");
      var source = makeElement("span", "", "출처 · " + getTestTitle(word.sourceTestId));
      var dots = makeElement("span", "answer-dots", answerDots(word.consecutiveCorrect));
      dots.setAttribute("aria-label", "연속 정답 " + word.consecutiveCorrect + "회");

      topline.append(english, badge);
      meta.append(source, dots);
      card.append(topline, meaning, meta);
      fragment.appendChild(card);
    });

    if (!visibleWords.length) {
      var empty = makeElement("div", "empty-state");
      empty.append(
        makeElement("strong", "", "여기에 표시할 단어가 없어요"),
        makeElement("span", "", "시험지를 찍거나 다른 필터를 골라 보세요.")
      );
      fragment.appendChild(empty);
    }

    byId("wordbook-list").replaceChildren(fragment);
  }

  async function renderRetestStart() {
    if (!state.currentStudent) {
      return;
    }
    state.quiz = null;
    var content = byId("retest-content");
    var learningWords = (await adapter.getWordbook(state.currentStudent.id)).filter(function (word) {
      return word.status === "learning";
    });

    if (!learningWords.length) {
      var empty = makeElement("div", "empty-state");
      empty.append(
        makeElement("strong", "", "학습 중인 단어가 없어요"),
        makeElement("span", "", "모든 단어에 동그라미가 생겼어요. 새 시험지를 등록해 보세요!")
      );
      content.replaceChildren(empty);
      return;
    }

    var card = makeElement("div", "card retest-start");
    var label = makeElement("p", "", "학습 중인 단어");
    var count = makeElement("strong", "retest-count", learningWords.length + "개");
    var title = makeElement("h2", "", "몇 문제를 풀어 볼까요?");
    var options = makeElement("div", "count-options");
    var values = [
      { key: "5", label: "5문제", value: 5, disabled: learningWords.length < 5 },
      { key: "10", label: "10문제", value: 10, disabled: learningWords.length < 10 },
      { key: "all", label: "전체", value: learningWords.length, disabled: false }
    ];

    if ((state.quizChoice === "10" && learningWords.length < 10) || (state.quizChoice === "5" && learningWords.length < 5)) {
      state.quizChoice = "all";
    }
    state.quizCount = state.quizChoice === "all" ? learningWords.length : Number(state.quizChoice);

    values.forEach(function (option) {
      var button = makeButton(option.label, "count-option", function () {
        state.quizChoice = option.key;
        state.quizCount = option.value;
        renderRetestStart();
      });
      var active = state.quizChoice === option.key;
      button.disabled = option.disabled;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      options.appendChild(button);
    });

    var start = makeButton("재시험 시작하기", "button button-primary button-block", startQuiz);
    var guide = makeElement("p", "privacy-note", "두 번 연속 맞히면 '다 외운 단어'가 돼요!");
    card.append(label, count, title, options, start, guide);
    content.replaceChildren(card);
  }

  async function startQuiz() {
    var questions;
    if (adapter.isReal) {
      questions = (await adapter.getRetestQuiz(state.currentStudent.id, state.quizCount)).questions;
    } else {
      var learningWords = (await adapter.getWordbook(state.currentStudent.id)).filter(function (word) {
        return word.status === "learning";
      });
      questions = window.RewordCore.buildQuiz(learningWords, await adapter.getAllWords(), state.quizCount);
    }

    state.quiz = {
      questions: questions,
      index: 0,
      answered: false,
      selectedAnswer: "",
      currentCorrect: false,
      results: []
    };
    renderQuizQuestion();
  }

  function gradeAnswer(answer) {
    var quiz = state.quiz;
    var question = quiz.questions[quiz.index];
    var correct = window.RewordCore.normalizeMeaning(answer) === window.RewordCore.normalizeMeaning(question.answer);

    if (quiz.answered) {
      return;
    }
    quiz.answered = true;
    quiz.selectedAnswer = answer;
    quiz.currentCorrect = correct;
    quiz.results.push({
      wordId: question.wordId,
      word: question.word,
      meaning: question.answer,
      correct: correct,
      answer: answer
    });
    renderQuizQuestion();
  }

  function nextQuizQuestion() {
    if (!state.quiz.answered) {
      return;
    }
    if (state.quiz.index >= state.quiz.questions.length - 1) {
      finishQuiz();
      return;
    }
    state.quiz.index += 1;
    state.quiz.answered = false;
    state.quiz.selectedAnswer = "";
    state.quiz.currentCorrect = false;
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    var quiz = state.quiz;
    var question = quiz.questions[quiz.index];
    var content = byId("retest-content");
    var shell = makeElement("div");
    var topline = makeElement("div", "quiz-topline");
    var number = makeElement("span", "", (quiz.index + 1) + " / " + quiz.questions.length);
    var mode = makeElement("span", "", question.mode === "choice" ? "뜻 고르기" : "뜻 직접 쓰기");
    var progress = makeElement("div", "quiz-progress-track");
    var progressFill = makeElement("span", "quiz-progress-fill");
    var card = makeElement("div", "card quiz-card");
    var label = makeElement("p", "quiz-word-label", "이 단어의 뜻은?");
    var word = makeElement("h2", "quiz-word", question.word);

    progressFill.style.width = ((quiz.index + 1) / quiz.questions.length * 100) + "%";
    progress.appendChild(progressFill);
    topline.append(number, mode);
    shell.append(topline, progress);

    if (question.mode === "choice") {
      var choices = makeElement("div", "choice-list");
      question.choices.forEach(function (choice) {
        var choiceButton = makeButton(choice, "choice-button", function () {
          gradeAnswer(choice);
        });

        if (quiz.answered) {
          choiceButton.disabled = true;
          if (window.RewordCore.normalizeMeaning(choice) === window.RewordCore.normalizeMeaning(question.answer)) {
            choiceButton.classList.add("is-correct");
            choiceButton.appendChild(createGradingMark("circle"));
          } else if (choice === quiz.selectedAnswer) {
            choiceButton.classList.add("is-wrong");
            choiceButton.appendChild(createGradingMark("slash"));
          }
        }
        choices.appendChild(choiceButton);
      });
      card.append(label, word, choices);
    } else {
      var typingForm = makeElement("form");
      var typingLabel = makeElement("label", "", "한글 뜻을 입력해 주세요");
      var typingInput = makeElement("input");
      var typingButton = makeElement("button", "button button-primary button-block", "정답 확인");
      typingLabel.htmlFor = "typing-answer";
      typingInput.id = "typing-answer";
      typingInput.type = "text";
      typingInput.autocomplete = "off";
      typingInput.value = quiz.selectedAnswer;
      typingInput.disabled = quiz.answered;
      typingButton.type = "submit";
      typingButton.disabled = quiz.answered;
      typingForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!typingInput.value.trim()) {
          typingInput.focus();
          return;
        }
        gradeAnswer(typingInput.value.trim());
      });
      typingForm.append(typingLabel, typingInput, typingButton);
      card.append(label, word, typingForm);
    }

    if (quiz.answered) {
      var feedback = makeElement("div", quiz.currentCorrect ? "answer-feedback" : "answer-feedback is-wrong");
      feedback.textContent = quiz.currentCorrect ? "정답이에요. 동그라미!" : "아쉬워요. 정답은 “" + question.answer + "”이에요.";
      var isLast = quiz.index === quiz.questions.length - 1;
      var next = makeButton(isLast ? "결과 보기" : "다음 문제", "button button-primary button-block quiz-next", nextQuizQuestion);
      card.append(feedback, next);
    }

    shell.appendChild(card);
    content.replaceChildren(shell);
    resetScroll();
  }

  async function finishQuiz() {
    var saved = await adapter.saveRetestResult(state.currentStudent.id, state.quiz.results);
    state.quiz.savedResult = saved;
    renderQuizResult();
  }

  function renderQuizResult() {
    var quiz = state.quiz;
    var content = byId("retest-content");
    var correctCount = quiz.results.filter(function (result) {
      return result.correct;
    }).length;
    var fragment = document.createDocumentFragment();
    var scoreCard = makeElement("div", "card result-score-card");
    var eyebrow = makeElement("p", "eyebrow", "재시험 완료");
    var title = makeElement("h2", "", "기억이 더 단단해졌어요");
    var score = makeElement("strong", "big-score", correctCount + "/" + quiz.results.length);
    var guide = makeElement("p", "", "두 번 연속 맞히면 '다 외운 단어'가 돼요!");
    var resultList = makeElement("div", "result-list");

    scoreCard.append(eyebrow, title, score, guide);
    fragment.appendChild(scoreCard);

    if (quiz.savedResult.graduatedWords.length) {
      var graduation = makeElement("div", "graduation-card");
      var graduationTitle = makeElement("h2", "", "다 외운 단어가 생겼어요!");
      var names = quiz.savedResult.graduatedWords.map(function (word) {
        return word.word;
      }).join(" · ");
      var graduationWords = makeElement("strong", "", names);
      var graduationCopy = makeElement("p", "", "두 번 연속 정답으로 완전히 내 단어가 되었어요.");
      graduation.append(createGraduationBotanicalAccent(), createGraduationStamp(), graduationTitle, graduationWords, graduationCopy);
      fragment.appendChild(graduation);
    }

    quiz.results.forEach(function (result) {
      var row = makeElement("div", "result-row");
      var mark = makeElement("span", result.correct ? "result-mark" : "result-mark is-wrong", result.correct ? "○" : "／");
      var copy = makeElement("div");
      copy.append(makeElement("strong", "", result.word), makeElement("span", "", result.meaning));
      row.append(mark, copy);
      resultList.appendChild(row);
    });
    fragment.appendChild(resultList);
    fragment.appendChild(makeButton("한 번 더 풀기", "button button-secondary button-block quiz-next", renderRetestStart));
    content.replaceChildren(fragment);
    resetScroll();
  }

  async function renderRecords() {
    if (!state.currentStudent) {
      return;
    }
    var history = (await adapter.getHistory(state.currentStudent.id)).slice().sort(function (first, second) {
      return first.date.localeCompare(second.date);
    });
    var content = byId("records-content");
    var fragment = document.createDocumentFragment();

    if (!history.length) {
      var empty = makeElement("div", "empty-state");
      empty.append(
        makeElement("strong", "", "아직 시험 기록이 없어요"),
        makeElement("span", "", "채점된 시험지를 찍으면 여기에 기록돼요.")
      );
      content.replaceChildren(empty);
      return;
    }

    var chartCard = makeElement("div", "card chart-card");
    var chartTitle = makeElement("h2", "", "시험 점수 추이");
    var chartCopy = makeElement("p", "", "최근 시험부터 차곡차곡 기록하고 있어요.");
    var chart = makeElement("div", "score-chart");
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", "시험 점수 추이 막대그래프");

    history.slice(-6).forEach(function (record) {
      var percent = record.total ? Math.round(record.score / record.total * 100) : 0;
      var column = makeElement("div", "chart-column");
      var value = makeElement("span", "chart-value", percent + "%");
      var bar = makeElement("span", "chart-bar");
      var label = makeElement("span", "chart-label", record.date.slice(5).replace("-", "."));
      bar.style.height = Math.max(percent * 1.55, 4) + "px";
      column.append(value, bar, label);
      chart.appendChild(column);
    });
    chartCard.append(chartTitle, chartCopy, chart);
    fragment.appendChild(chartCard);

    var sectionHeading = makeElement("div", "section-heading");
    var headingCopy = makeElement("div");
    headingCopy.append(makeElement("h2", "", "최근 시험"), makeElement("p", "", "가장 최근 기록이 위에 보여요."));
    sectionHeading.appendChild(headingCopy);
    fragment.appendChild(sectionHeading);

    var list = makeElement("div", "history-list");
    history.slice().reverse().forEach(function (record) {
      var item = makeElement("article", "history-item");
      var copy = makeElement("div");
      copy.append(makeElement("strong", "", getTestTitle(record.testId)), makeElement("span", "", formatDate(record.date) + " · " + record.testId));
      item.append(copy, makeElement("strong", "history-score", record.score + "/" + record.total));
      list.appendChild(item);
    });
    fragment.appendChild(list);
    content.replaceChildren(fragment);
  }

  function latestHistory(history) {
    return history.length ? history[history.length - 1] : null;
  }

  function createSparkline(history) {
    var sparkline = makeSvgElement("svg", {
      class: "sparkline",
      viewBox: "0 0 72 36",
      role: "img",
      "aria-label": "최근 점수 미니 추이"
    });
    var records = history.slice(-4);
    var points = records.map(function (record, index) {
      var percent = record.total ? record.score / record.total : 0;
      var x = records.length > 1 ? 5 + (62 / (records.length - 1) * index) : 36;
      var y = 31 - Math.round(percent * 25);
      return x + "," + y;
    }).join(" ");
    var baseline = makeSvgElement("path", { class: "sparkline-baseline", d: "M3 32H69" });
    var line = makeSvgElement("polyline", { points: points || "5,31 67,31" });
    sparkline.append(baseline, line);
    return sparkline;
  }

  async function renderTeacherStudents() {
    var container = byId("student-cards");
    var fragment = document.createDocumentFragment();
    var students = await adapter.getStudents();

    for (var student of students) {
      var studentData = await Promise.all([
        adapter.getWordbook(student.id),
        adapter.getHistory(student.id),
        adapter.getConsentStatus(student.id)
      ]);
      var wordCounts = statusCounts(studentData[0]);
      var history = studentData[1].slice().sort(function (first, second) {
        return first.date.localeCompare(second.date);
      });
      var latest = latestHistory(history);
      var consent = studentData[2];
      var wrapper = makeElement("div", "student-card-shell");
      var card = makeButton("", "student-card", function () {
        state.teacherStudentId = this.dataset.studentId;
        showView("teacher-detail");
      });
      card.dataset.studentId = student.id;
      var head = makeElement("div", "student-card-head");
      var identity = makeElement("div", "student-card-identity");
      var nameLine = makeElement("div", "student-card-name-line");
      var name = makeElement("span", "student-name", student.nickname);
      var grade = makeElement("span", "student-grade", student.grade);
      var consentBadge = makeElement(
        "span",
        consent.status === "accepted" ? "consent-badge" : "consent-badge is-pending",
        consent.status === "accepted"
          ? (consent.source === "paper"
            ? "동의 완료(종이)"
            : "동의 완료 " + formatConsentDate(consent.acceptedAt))
          : consent.status === "pending" ? "동의 링크 대기" : "동의 없음"
      );
      var metrics = makeElement("div", "student-metrics");
      var metricData = [
        { label: "최근 점수", value: latest ? latest.score + "/" + latest.total : "—" },
        { label: "학습 중", value: wordCounts.learning + "개" },
        { label: "동그라미", value: wordCounts.graduated + "개" }
      ];

      nameLine.append(name, grade);
      identity.append(nameLine, consentBadge);
      head.append(identity, createSparkline(history));
      metricData.forEach(function (metricItem) {
        var metric = makeElement("div", "metric");
        metric.append(makeElement("span", "", metricItem.label), makeElement("strong", "", metricItem.value));
        metrics.appendChild(metric);
      });
      card.append(head, metrics);
      var savedLink = state.consentLinks[student.id] || null;
      var consentAction = makeButton(
        savedLink || consent.status === "pending" ? "동의 링크 다시 만들기" : "동의 링크 만들기",
        "text-button consent-link-button",
        async function () {
          var targetId = this.dataset.studentId;
          try {
            var link = await adapter.createConsentLink(targetId);
            var copied = false;
            state.consentLinks[targetId] = link;
            await renderTeacherStudents();
            try {
              await navigator.clipboard.writeText(link.url);
              copied = true;
            } catch (error) {
              copied = false;
            }
            showToast(copied
              ? "보호자 동의 링크를 복사했어요."
              : "링크를 만들었어요. 아래에서 직접 복사해 주세요.");
            if (!copied) {
              var visibleInput = Array.from(container.querySelectorAll(".consent-link-input")).find(function (input) {
                return input.dataset.studentId === targetId;
              });
              if (visibleInput) {
                visibleInput.focus();
                visibleInput.select();
              }
            }
          } catch (error) {
            showToast(error.message || "동의 링크를 만들지 못했어요.");
          }
        }
      );
      consentAction.dataset.studentId = student.id;
      var manualConsentAction = null;
      if (state.currentUser && state.currentUser.role === "owner" && consent.status !== "accepted") {
        manualConsentAction = makeButton(
          "종이로 동의 받음",
          "text-button consent-link-button",
          async function () {
            var targetId = this.dataset.studentId;
            var targetStudent = students.find(function (candidate) { return candidate.id === targetId; });
            if (!window.confirm(
              (targetStudent ? targetStudent.nickname + " 학생의 " : "") +
              "보호자에게 종이 동의서를 받았나요? 확인하면 보호자 관계는 ‘보호자’로 기록됩니다."
            )) {
              return;
            }
            try {
              await adapter.createManualConsent(targetId, { relation: "guardian" });
              delete state.consentLinks[targetId];
              await renderTeacherStudents();
              showToast("종이 동의를 기록했어요.");
            } catch (error) {
              showToast(error.message || "종이 동의를 기록하지 못했어요.");
            }
          }
        );
        manualConsentAction.dataset.studentId = student.id;
      }
      var consentLinkRow = makeElement("div", "consent-link-row");
      var consentLinkInput = makeElement("input", "consent-link-input");
      consentLinkInput.type = "text";
      consentLinkInput.readOnly = true;
      consentLinkInput.value = savedLink ? savedLink.url : "";
      consentLinkInput.placeholder = "링크를 만들면 여기에 보여요";
      consentLinkInput.dataset.studentId = student.id;
      consentLinkInput.setAttribute("aria-label", student.nickname + " 보호자 동의 링크");
      var consentLinkExpiry = makeElement(
        "span",
        "consent-link-expiry",
        savedLink ? formatConsentExpiry(savedLink.expiresAt) : ""
      );
      consentLinkRow.append(consentLinkInput, consentAction);
      if (manualConsentAction) {
        consentLinkRow.appendChild(manualConsentAction);
      }
      wrapper.append(card, consentLinkRow, consentLinkExpiry);
      fragment.appendChild(wrapper);
    }

    container.replaceChildren(fragment);
  }

  async function renderRegisteredTests() {
    var container = byId("registered-tests");
    var fragment = document.createDocumentFragment();
    state.tests = await adapter.getTests();

    state.tests.filter(function (test) { return test.source !== "photo"; }).forEach(function (test) {
      var row = makeElement("article", "test-row");
      var copy = makeElement("div");
      var badge = makeElement("span", "version-badge", "v" + test.version);
      copy.append(
        makeElement("strong", "", test.title),
        makeElement("span", "", test.id + " · " + test.totalQuestions + "문항 · 단어 " + test.words.length + "개")
      );
      row.append(copy, badge);
      fragment.appendChild(row);
    });
    container.replaceChildren(fragment);
  }

  async function renderTeacherDashboard() {
    var isOwner = Boolean(state.currentUser && state.currentUser.role === "owner");
    byId("student-create-section").hidden = !isOwner;
    byId("password-change-section").hidden = !(adapter.isReal && state.currentUser);
    byId("student-pin-result").hidden = true;
    byId("student-pin-value").value = "";
    await Promise.all([renderTeacherStudents(), renderRegisteredTests()]);
    renderParseMessage();
  }

  async function createStudent(event) {
    event.preventDefault();
    if (!state.currentUser || state.currentUser.role !== "owner") {
      return;
    }
    var nicknameInput = byId("student-create-nickname");
    var gradeInput = byId("student-create-grade");
    var message = byId("student-create-message");
    var submitButton = byId("student-create-button");
    var nickname = nicknameInput.value.trim();
    var grade = gradeInput.value.trim();

    if (!nickname || nickname.length > 12) {
      message.textContent = "이름은 1~12자로 입력해 주세요.";
      nicknameInput.focus();
      return;
    }

    byId("student-pin-result").hidden = true;
    byId("student-pin-value").value = "";
    submitButton.disabled = true;
    message.textContent = "";
    try {
      var student = await adapter.createStudent({ nickname: nickname, grade: grade });
      byId("student-create-form").reset();
      byId("student-pin-value").value = student.pin;
      byId("student-pin-result").hidden = false;
      await renderTeacherStudents();
      showToast("“" + student.nickname + "” 학생을 추가했어요.");
    } catch (error) {
      message.textContent = error.message || "학생을 추가하지 못했어요.";
    } finally {
      submitButton.disabled = false;
    }
  }

  async function copyIssuedPin() {
    var pinInput = byId("student-pin-value");
    if (!pinInput.value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(pinInput.value);
      showToast("학생 PIN을 복사했어요.");
    } catch (error) {
      pinInput.focus();
      pinInput.select();
      showToast("PIN을 선택했어요. 직접 복사해 주세요.");
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    var currentInput = byId("current-password");
    var newInput = byId("new-password");
    var confirmInput = byId("new-password-confirm");
    var message = byId("password-change-message");
    var submitButton = byId("password-change-button");

    if (!currentInput.value) {
      message.textContent = "현재 비밀번호를 입력해 주세요.";
      currentInput.focus();
      return;
    }
    if (newInput.value.length < 10) {
      message.textContent = "새 비밀번호는 10자 이상이어야 해요.";
      newInput.focus();
      return;
    }
    if (newInput.value !== confirmInput.value) {
      message.textContent = "새 비밀번호와 확인이 같지 않아요.";
      confirmInput.focus();
      return;
    }

    submitButton.disabled = true;
    message.textContent = "";
    try {
      await adapter.changePassword({
        currentPassword: currentInput.value,
        newPassword: newInput.value
      });
      byId("password-change-form").reset();
      byId("password-change-section").open = false;
      showToast("비밀번호를 바꿨어요. 다른 기기는 다시 로그인해야 해요.");
    } catch (error) {
      message.textContent = error.message || "비밀번호를 바꾸지 못했어요.";
    } finally {
      submitButton.disabled = false;
    }
  }

  function renderParseMessage() {
    var text = byId("test-words").value;
    var message = byId("parse-message");
    if (!text.trim()) {
      message.textContent = "";
      return;
    }
    var parsed = window.RewordCore.parseWordList(text);
    if (parsed.errors.length) {
      message.textContent = "형식을 확인할 줄: " + parsed.errors.join(", ") + "번 · 읽은 단어 " + parsed.words.length + "개";
    } else {
      message.textContent = "단어 " + parsed.words.length + "개를 문제없이 읽었어요.";
    }
  }

  async function registerTest(event) {
    event.preventDefault();
    var titleInput = byId("test-title");
    var totalInput = byId("test-total");
    var wordsInput = byId("test-words");
    var message = byId("parse-message");
    var title = titleInput.value.trim();
    var total = Number(totalInput.value);
    var parsed = window.RewordCore.parseWordList(wordsInput.value);

    if (!title) {
      message.textContent = "시험명을 입력해 주세요.";
      titleInput.focus();
      return;
    }
    if (!Number.isInteger(total) || total < 1) {
      message.textContent = "총 문항수를 1 이상으로 입력해 주세요.";
      totalInput.focus();
      return;
    }
    if (parsed.errors.length) {
      message.textContent = "등록하지 못했어요. " + parsed.errors.join(", ") + "번 줄의 형식을 확인해 주세요.";
      wordsInput.focus();
      return;
    }
    if (!parsed.words.length) {
      message.textContent = "단어 목록을 한 줄 이상 입력해 주세요.";
      wordsInput.focus();
      return;
    }
    if (parsed.words.length !== total) {
      message.textContent = "총 문항수 " + total + "개와 읽은 단어 " + parsed.words.length + "개가 달라요.";
      wordsInput.focus();
      return;
    }

    var test;
    try {
      test = await adapter.registerTest({
      title: title,
      totalQuestions: total,
      words: parsed.words
      });
    } catch (error) {
      message.textContent = error.message || "시험을 등록하지 못했어요.";
      return;
    }
    byId("test-register-form").reset();
    message.textContent = "";
    await renderRegisteredTests();
    showToast("‘" + test.title + "’을 등록했어요.");
  }

  async function renderTeacherDetail() {
    var student = await adapter.getStudent(state.teacherStudentId);
    var container = byId("teacher-detail-content");
    var fragment = document.createDocumentFragment();

    if (!student) {
      var empty = makeElement("div", "empty-state");
      empty.append(makeElement("strong", "", "학생 정보를 찾지 못했어요"));
      container.replaceChildren(empty);
      return;
    }

    var heading = makeElement("div", "detail-heading");
    var headingCopy = makeElement("div");
    var eyebrow = makeElement("p", "eyebrow", "학생 상세");
    var title = makeElement("h1", "", student.nickname + " · " + student.grade);
    title.id = "teacher-detail-title";
    headingCopy.append(eyebrow, title);
    heading.appendChild(headingCopy);
    fragment.appendChild(heading);

    var pinCard = makeElement("div", "card pin-card");
    var pinTop = makeElement("div", "detail-heading");
    var pinCopy = makeElement("div");
    var pinLabel = makeElement("span", "analysis-meta", "현재 학생 PIN");
    var pinValue = makeElement("div", "pin-value", adapter.isReal ? "재발급 시 한 번 표시" : student.pin);
    var regenerate = makeButton("PIN 재발급", "button button-secondary", async function () {
      try {
        var newPin = await adapter.regeneratePin(student.id);
        pinValue.textContent = newPin;
        showToast("새 PIN " + newPin + "을 발급했어요.");
      } catch (error) {
        showToast(error.message || "PIN을 재발급하지 못했어요.");
      }
    });
    pinCopy.append(pinLabel, pinValue);
    pinTop.append(pinCopy, regenerate);
    pinCard.appendChild(pinTop);
    fragment.appendChild(pinCard);

    var historyHeading = makeElement("div", "section-heading");
    historyHeading.appendChild(makeElement("h2", "", "성적 이력"));
    fragment.appendChild(historyHeading);

    var tableWrap = makeElement("div", "score-table-wrap");
    var table = makeElement("table", "score-table");
    var thead = makeElement("thead");
    var headerRow = makeElement("tr");
    ["날짜", "시험", "점수"].forEach(function (label) {
      headerRow.appendChild(makeElement("th", "", label));
    });
    thead.appendChild(headerRow);
    var tbody = makeElement("tbody");
    var history = await adapter.getHistory(student.id);
    history.slice().reverse().forEach(function (record) {
      var row = makeElement("tr");
      row.append(
        makeElement("td", "", formatDate(record.date)),
        makeElement("td", "", getTestTitle(record.testId)),
        makeElement("td", "", record.score + "/" + record.total)
      );
      tbody.appendChild(row);
    });
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    fragment.appendChild(tableWrap);

    var wordHeading = makeElement("div", "section-heading");
    wordHeading.appendChild(makeElement("h2", "", "오답 단어"));
    fragment.appendChild(wordHeading);
    var wordList = makeElement("div", "word-list");
    var words = await adapter.getWordbook(student.id);
    words.forEach(function (word) {
      var card = makeElement("article", word.status === "graduated" ? "word-card is-graduated" : "word-card");
      var top = makeElement("div", "word-topline");
      top.append(
        makeElement("strong", "word-english", word.word),
        makeElement("span", word.status === "graduated" ? "status-badge is-graduated" : "status-badge", word.status === "graduated" ? "동그라미" : "학습 중")
      );
      card.append(top, makeElement("p", "word-meaning", word.meaning));
      wordList.appendChild(card);
    });
    fragment.appendChild(wordList);
    container.replaceChildren(fragment);
  }

  function bindEvents() {
    byId("student-tab").addEventListener("click", function () {
      switchLoginTab("student");
    });
    byId("teacher-tab").addEventListener("click", function () {
      switchLoginTab("teacher");
    });
    byId("student-login-form").addEventListener("submit", handleStudentLogin);
    byId("teacher-login-form").addEventListener("submit", handleTeacherLogin);
    byId("consent-checkbox").addEventListener("change", updateConsentAction);
    byId("consent-agree-button").addEventListener("click", saveConsentAndContinue);
    byId("student-pin").addEventListener("input", function (event) {
      event.target.value = event.target.value.replace(/\D/g, "").slice(0, 4);
    });
    byId("logout-button").addEventListener("click", logout);
    byId("brand-home").addEventListener("click", function () {
      if (state.role === "student") {
        showView(adapter.isReal ? "wordbook" : "capture");
      } else if (state.role === "teacher") {
        showView("teacher");
      }
    });
    byId("camera-input").addEventListener("change", function (event) {
      selectImage(event.target.files[0]);
    });
    byId("gallery-input").addEventListener("change", function (event) {
      selectImage(event.target.files[0]);
    });
    byId("analyze-button").addEventListener("click", analyzeSelectedSheet);
    byId("capture-student-select").addEventListener("change", function (event) {
      state.currentStudent = state.captureStudents.find(function (student) {
        return student.id === event.target.value;
      }) || null;
      state.teacherStudentId = state.currentStudent ? state.currentStudent.id : null;
    });
    byId("test-select").addEventListener("change", updateFormPreset);
    byId("form-preset").addEventListener("change", function (event) {
      state.maskRect = presetRect(event.target.value);
      renderImageCanvas();
    });
    byId("mask-enabled").addEventListener("change", function (event) {
      state.maskEnabled = event.target.checked;
      renderImageCanvas();
    });
    byId("rotate-left-button").addEventListener("click", function () { rotateImage(-90); });
    byId("rotate-right-button").addEventListener("click", function () { rotateImage(90); });
    byId("image-canvas").addEventListener("pointerdown", startMaskDrag);
    byId("image-canvas").addEventListener("pointermove", moveMask);
    byId("image-canvas").addEventListener("pointerup", stopMaskDrag);
    byId("image-canvas").addEventListener("pointercancel", stopMaskDrag);
    byId("retake-button").addEventListener("click", function () {
      state.selectedFile = null;
      // 같은 파일을 다시 골라도 change 이벤트가 나도록 입력값 초기화
      byId("camera-input").value = "";
      byId("gallery-input").value = "";
      byId("selected-file").textContent = "";
      showView("capture");
    });
    byId("manual-confirm-checkbox").addEventListener("change", renderGate);
    byId("override-deduction").addEventListener("input", renderGate);
    byId("override-reason").addEventListener("input", renderGate);
    byId("save-words-button").addEventListener("click", function () { saveWords(); });
    byId("wordbook-filters").addEventListener("click", function (event) {
      var button = event.target.closest("button[data-filter]");
      if (!button) {
        return;
      }
      state.wordbookFilter = button.dataset.filter;
      renderWordbook();
    });
    byId("student-navigation").addEventListener("click", function (event) {
      var button = event.target.closest("button[data-view]");
      if (button) {
        showView(button.dataset.view);
      }
    });
    byId("test-register-form").addEventListener("submit", registerTest);
    byId("test-words").addEventListener("input", renderParseMessage);
    byId("student-create-form").addEventListener("submit", createStudent);
    byId("student-pin-copy-button").addEventListener("click", copyIssuedPin);
    byId("password-change-form").addEventListener("submit", changePassword);
    byId("teacher-back-button").addEventListener("click", function () {
      showView("teacher");
    });
    byId("teacher-capture-button").addEventListener("click", function () {
      state.currentStudent = null;
      state.selectedFile = null;
      showView("capture");
    });
  }

  bindEvents();
  if (adapter.isReal) {
    byId("mode-badge").textContent = "API 모드";
    byId("teacher-demo-hint").hidden = true;
  }
  showView("login");
}());
