(async function () {
  "use strict";

  var query = new URLSearchParams(window.location.search);
  var apiBaseUrl = query.get("api");
  var tenantSlug = query.get("t");
  var adapter = apiBaseUrl && tenantSlug
    ? new window.RewordAdapters.RealAdapter(apiBaseUrl, tenantSlug)
    : new window.RewordAdapters.MockAdapter();

  function mergeTenantTheme(configuration) {
    var fallback = window.RewordTheme || {};
    var remote = configuration && configuration.theme || {};
    var remoteColors = remote.colors || {};
    var colors = Object.assign({}, fallback.colors || {});
    if (remoteColors.background) colors.bg = remoteColors.background;
    if (remoteColors.ink) colors.ink = remoteColors.ink;
    if (remoteColors.deepGreen) {
      colors.accent = remoteColors.deepGreen;
      colors.accentDeep = remoteColors.deepGreen;
      colors.gradientStart = remoteColors.deepGreen;
      colors.gradientEnd = remoteColors.deepGreen;
    }
    if (remoteColors.lightGreen) {
      colors.accentSoft = remoteColors.lightGreen;
      colors.accentLine = remoteColors.lightGreen;
    }
    if (remoteColors.olive) colors.oliveType = remoteColors.olive;
    var logo = remote.logo;
    return Object.assign({}, fallback, remote.copy || {}, {
      brandName: remote.brandName || configuration.name || fallback.brandName || "",
      logoImage: logo || fallback.logoImage,
      logoImageFull: logo || fallback.logoImageFull,
      colors: colors,
      fonts: Object.assign({}, fallback.fonts || {}, remote.fonts || {})
    });
  }

  if (adapter.isReal) {
    try {
      var publicConfiguration = await adapter.getPublicConfiguration();
      window.RewordTheme = mergeTenantTheme(publicConfiguration);
    } catch (error) {
      console.warn("Tenant public configuration unavailable", error && error.code || "API_ERROR");
    }
  }

  function applyTheme() {
    // 다른 공부방용 theme.js에서 값을 빠뜨려도 "undefined" 노출·중단 없이 동작해야 한다
    var theme = window.RewordTheme || {};
    var colors = theme.colors || {};
    var brandName = theme.brandName || "";
    var appName = theme.appName || "";
    var fonts = theme.fonts || {};
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
    if (fonts.sans) document.documentElement.style.setProperty("--font-sans", fonts.sans);
    if (fonts.hand) document.documentElement.style.setProperty("--font-hand", fonts.hand);
    if (fonts.pen) document.documentElement.style.setProperty("--font-pen", fonts.pen);

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
  var state = {
    role: null,
    currentUser: null,
    currentStudent: null,
    currentView: "login",
    pages: [],
    analysis: null,
    wrongItems: [],
    wordbookFilter: "all",
    quizCount: 5,
    quizChoice: "5",
    retestMode: "meaning",
    quiz: null,
    teacherStudentId: null,
    paperRetestChoice: "10",
    printRetest: null,
    failedPinAttempts: 0,
    lockUntil: 0,
    lockTimer: null,
    toastTimer: null,
    tests: [],
    captureStudents: [],
    rotationRetried: false,
    rotateWarned: false,
    pageGeneration: 0,
    deferredPages: [],
    analysisInProgress: false,
    saveInProgress: false,
    correctedHalfRule: true,
    consentLinks: {}
  };

  var viewNames = ["login", "consent", "capture", "analysis", "wordbook", "retest", "records", "teacher", "teacher-detail", "print-preview"];

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

  function reportPipelineError(stage, error) {
    var httpCode = Number.isInteger(error && error.status) ? "HTTP_" + error.status : "NO_HTTP";
    var errorCode = error && error.code ? String(error.code) : "CLIENT_ERROR";
    Promise.resolve(adapter.logClientError({
      stage: String(stage || "unknown").slice(0, 200),
      code: (httpCode + ":" + errorCode).slice(0, 200),
      message: String(error && error.message || "알 수 없는 클라이언트 오류").slice(0, 200),
      ua: String(window.navigator.userAgent || "").slice(0, 200)
    })).catch(function () {
      // 오류 기록 실패가 원래 촬영·판독·저장 흐름을 가리지 않게 한다.
    });
  }

  function hideConsentRequiredPanel() {
    var panel = byId("consent-required-panel");
    panel.hidden = true;
    panel.replaceChildren();
  }

  function renderConsentRequiredPanel() {
    var panel = byId("consent-required-panel");
    var title = makeElement("strong", "", "보호자 동의가 아직 없어요");
    var detail = makeElement("span", "", state.currentUser && state.currentUser.role === "owner"
      ? "아래에서 동의 링크를 만들거나, 받은 종이 동의를 기록해 주세요."
      : "원장님께 보호자 동의 링크 생성을 요청해 주세요.");
    panel.replaceChildren(title, detail);

    if (state.currentUser && state.currentUser.role === "owner" && state.currentStudent) {
      var actions = makeElement("div", "consent-required-actions");
      var linkButton = makeButton("동의 링크 만들기", "button button-secondary", async function () {
        linkButton.disabled = true;
        try {
          var link = await adapter.createConsentLink(state.currentStudent.id);
          var linkInput = makeElement("input", "consent-required-link");
          linkInput.type = "text";
          linkInput.readOnly = true;
          linkInput.value = link.url;
          linkInput.setAttribute("aria-label", "보호자 동의 링크");
          panel.appendChild(linkInput);
          try {
            await navigator.clipboard.writeText(link.url);
            detail.textContent = "동의 링크를 복사했어요. 보호자에게 전달해 주세요.";
          } catch (error) {
            detail.textContent = "링크를 만들었어요. 아래 링크를 복사해 보호자에게 전달해 주세요.";
            linkInput.focus();
            linkInput.select();
          }
        } catch (error) {
          reportPipelineError("consent_link", error);
          showToast(error.message || "동의 링크를 만들지 못했어요.");
        } finally {
          linkButton.disabled = false;
        }
      });
      var paperButton = makeButton("종이로 동의 받음(원장)", "button button-secondary", async function () {
        if (!window.confirm("보호자에게 종이 동의서를 받았나요? 확인하면 보호자 관계는 ‘보호자’로 기록됩니다.")) {
          return;
        }
        paperButton.disabled = true;
        try {
          await adapter.createManualConsent(state.currentStudent.id, { relation: "guardian" });
          hideConsentRequiredPanel();
          await analyzeSelectedSheet();
        } catch (error) {
          reportPipelineError("consent_manual", error);
          showToast(error.message || "종이 동의를 기록하지 못했어요.");
        } finally {
          paperButton.disabled = false;
        }
      });
      actions.append(linkButton, paperButton);
      panel.appendChild(actions);
    }
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
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
    // 인쇄용 DOM은 화면을 떠나면 즉시 비운다 — 남겨두면 다른 화면에서 Cmd-P 시 이전 학생 시험지·정답지가 인쇄됨
    if (viewName !== "print-preview") {
      state.printRetest = null;
      byId("print-preview-content").replaceChildren();
    }
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
    } else if (viewName === "print-preview") {
      renderPrintRetestPreview();
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
    state.retestMode = "meaning";
    state.consentLinks = {};
    clearPages();
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
    state.tests.filter(function (test) {
      return test.source !== "photo" && Array.isArray(test.words) && test.words.length > 0;
    }).forEach(function (test) {
      var option = makeElement("option", "", test.title + " · " + test.id);
      option.value = test.id;
      select.appendChild(option);
    });
  }

  async function renderCapture() {
    hideConsentRequiredPanel();
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
    byId("analysis-progress").hidden = true;
    byId("analysis-progress").classList.remove("is-running");
    byId("analysis-progress").querySelector("[role='progressbar']").setAttribute("aria-valuenow", "0");
    renderPagePreviews();
    updatePageSelection();
  }

  function updatePageSelection() {
    var pageCount = state.pages.length;
    var controlsDisabled = state.analysisInProgress || pageCount >= 3;
    var cameraInput = byId("camera-input");
    var galleryInput = byId("gallery-input");
    var cameraLabel = cameraInput.closest("label");
    var galleryLabel = galleryInput.closest("label");

    byId("selected-file").textContent = pageCount ? "선택한 사진 " + pageCount + "장" : "";
    byId("camera-action-text").textContent = pageCount ? "촬영해서 뒷장 추가하기" : "시험지 촬영하기";
    byId("gallery-action-text").textContent = pageCount ? "갤러리에서 뒷장 추가하기" : "갤러리에서 선택";
    cameraInput.disabled = controlsDisabled;
    galleryInput.disabled = controlsDisabled;
    cameraLabel.classList.toggle("is-disabled", controlsDisabled);
    galleryLabel.classList.toggle("is-disabled", controlsDisabled);
    cameraLabel.setAttribute("aria-disabled", controlsDisabled ? "true" : "false");
    galleryLabel.setAttribute("aria-disabled", controlsDisabled ? "true" : "false");
    byId("test-select").disabled = state.analysisInProgress;
    byId("capture-student-select").disabled = state.analysisInProgress;
    byId("analyze-button").disabled = state.analysisInProgress || !pageCount;
    if (!state.analysisInProgress) {
      byId("analysis-setup").hidden = !pageCount;
    }
  }

  function closePageBitmap(page) {
    if (page && page.bitmap && typeof page.bitmap.close === "function") {
      page.bitmap.close();
    }
  }

  function clearPages() {
    state.pageGeneration += 1;
    if (state.analysisInProgress) {
      state.deferredPages = state.deferredPages.concat(state.pages);
    } else {
      state.pages.forEach(closePageBitmap);
    }
    state.pages = [];
    state.rotationRetried = false;
    state.rotateWarned = false;
    byId("camera-input").value = "";
    byId("gallery-input").value = "";
    byId("page-previews").replaceChildren();
    updatePageSelection();
  }

  function imageFileDimensions(file) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var objectUrl = URL.createObjectURL(file);
      function finish() {
        URL.revokeObjectURL(objectUrl);
        image.removeAttribute("src");
      }
      image.addEventListener("load", function () {
        var dimensions = { width: image.naturalWidth, height: image.naturalHeight };
        finish();
        resolve(dimensions);
      });
      image.addEventListener("error", function () {
        finish();
        reject(new Error("사진 크기를 확인하지 못했어요."));
      });
      image.src = objectUrl;
    });
  }

  async function createResizedBitmap(file) {
    var dimensions = await imageFileDimensions(file);
    var scale = Math.min(2000 / Math.max(dimensions.width, dimensions.height), 1);
    var resizeOptions = {
      imageOrientation: "from-image",
      resizeWidth: Math.max(1, Math.round(dimensions.width * scale)),
      resizeHeight: Math.max(1, Math.round(dimensions.height * scale)),
      resizeQuality: "high"
    };
    try {
      return await window.createImageBitmap(file, resizeOptions);
    } catch (error) {
      try {
        return await window.createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (orientationError) {
        // 풀해상 비트맵이어도 캔버스 렌더에서 긴 변을 2000px로 줄여 인코딩한다.
        return window.createImageBitmap(file);
      }
    }
  }

  async function selectImage(file, batchGeneration) {
    if (!file || state.pages.length >= 3) {
      return false;
    }
    // 배치 선택은 배치 시작 시점의 세대를 공유한다 — 파일별 재샘플이면 세대 교체(로그아웃·판독 시작) 후
    // 남은 파일이 새 세대로 통과해 이전 사용자의 사진이 새 상태에 새어들 수 있다 (핑퐁 R2)
    var decodeGeneration = batchGeneration !== undefined ? batchGeneration : state.pageGeneration;
    if (decodeGeneration !== state.pageGeneration) {
      return false;
    }
    var bitmap = await createResizedBitmap(file);
    if (decodeGeneration !== state.pageGeneration || state.pages.length >= 3) {
      closePageBitmap({ bitmap: bitmap });
      return false;
    }
    if (!state.pages.length) {
      state.rotationRetried = false;
      state.rotateWarned = false;
    }
    state.pages.push({ file: file, bitmap: bitmap, rotation: 0 });
    hideConsentRequiredPanel();
    renderPagePreviews();
    updatePageSelection();
    return true;
  }

  async function handleImageSelection(fileList, input) {
    var files = Array.prototype.slice.call(fileList || []);
    var availableCount = Math.max(3 - state.pages.length, 0);
    var selectedFiles = files.slice(0, availableCount);
    var addedCount = 0;
    var batchGeneration = state.pageGeneration;

    if (files.length > availableCount) {
      showToast("사진은 최대 3장까지예요. 초과한 " + (files.length - availableCount) + "장은 담지 않았어요.");
    }
    for (var index = 0; index < selectedFiles.length; index += 1) {
      if (state.pageGeneration !== batchGeneration) {
        break;
      }
      try {
        if (await selectImage(selectedFiles[index], batchGeneration)) {
          addedCount += 1;
        }
      } catch (error) {
        reportPipelineError("capture", error);
        showToast(error.message || (index + 1) + "번째 사진을 준비하지 못했어요.");
      }
    }
    input.value = "";
    if (addedCount) {
      byId("analysis-setup").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function renderImageCanvas(page, canvas) {
    if (!canvas || !page || !page.bitmap) {
      return;
    }
    var sourceWidth = page.bitmap.width;
    var sourceHeight = page.bitmap.height;
    var quarterTurn = Math.abs(page.rotation % 180) === 90;
    var rotatedWidth = quarterTurn ? sourceHeight : sourceWidth;
    var rotatedHeight = quarterTurn ? sourceWidth : sourceHeight;
    var scale = Math.min(2000 / Math.max(rotatedWidth, rotatedHeight), 1); // 2000px = 서버 상한. 1600에선 작은 세모(△)를 놓침 (2026-08-23 실측)
    canvas.width = Math.max(1, Math.round(rotatedWidth * scale));
    canvas.height = Math.max(1, Math.round(rotatedHeight * scale));
    var context = canvas.getContext("2d");
    context.save();
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(page.rotation * Math.PI / 180);
    context.drawImage(
      page.bitmap,
      -sourceWidth * scale / 2,
      -sourceHeight * scale / 2,
      sourceWidth * scale,
      sourceHeight * scale
    );
    context.restore();
  }

  function rotatePage(pageIndex, degrees) {
    if (state.analysisInProgress || !state.pages[pageIndex]) {
      return;
    }
    state.pages[pageIndex].rotation = (state.pages[pageIndex].rotation + degrees + 360) % 360;
    renderPagePreviews();
  }

  function removePage(pageIndex) {
    if (state.analysisInProgress || !state.pages[pageIndex]) {
      return;
    }
    var removedPages = state.pages.splice(pageIndex, 1);
    closePageBitmap(removedPages[0]);
    if (!state.pages.length) {
      state.rotationRetried = false;
      state.rotateWarned = false;
    }
    byId("camera-input").value = "";
    byId("gallery-input").value = "";
    renderPagePreviews();
    updatePageSelection();
  }

  function renderPagePreviews() {
    var container = byId("page-previews");
    var fragment = document.createDocumentFragment();
    state.pages.forEach(function (page, pageIndex) {
      var card = makeElement("article", "page-preview-card");
      var heading = makeElement("div", "page-preview-heading");
      var label = makeElement("strong", "", (pageIndex + 1) + "번째 장 · " + page.file.name);
      var rotationLabel = makeElement("span", "", page.rotation + "°");
      var canvas = makeElement("canvas", "image-canvas");
      var actions = makeElement("div", "image-editor-actions");
      var rotateLeft = makeButton("왼쪽 90°", "button button-secondary page-rotate-left", function () {
        rotatePage(pageIndex, -90);
      });
      var rotateRight = makeButton("오른쪽 90°", "button button-secondary page-rotate-right", function () {
        rotatePage(pageIndex, 90);
      });
      var remove = makeButton("이 장 빼기", "button button-secondary page-remove-button", function () {
        removePage(pageIndex);
      });

      card.dataset.pageIndex = String(pageIndex);
      canvas.setAttribute("aria-label", (pageIndex + 1) + "번째 시험지 미리보기");
      rotateLeft.dataset.pageAction = "rotate-left";
      rotateRight.dataset.pageAction = "rotate-right";
      remove.dataset.pageAction = "remove";
      rotateLeft.disabled = state.analysisInProgress;
      rotateRight.disabled = state.analysisInProgress;
      remove.disabled = state.analysisInProgress;
      heading.append(label, rotationLabel);
      actions.append(rotateLeft, rotateRight, remove);
      card.append(heading, canvas, actions);
      fragment.appendChild(card);
      renderImageCanvas(page, canvas);
    });
    container.replaceChildren(fragment);
  }

  function canvasBlob(canvas, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error("이미지를 준비하지 못했습니다."));
          return;
        }
        resolve(blob);
      }, "image/jpeg", quality);
    });
  }

  function blobImage(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.addEventListener("load", function () {
        resolve({
          base64: String(reader.result).split(",")[1],
          mimeType: "image/jpeg"
        });
      });
      reader.addEventListener("error", function () { reject(reader.error); });
      reader.readAsDataURL(blob);
    });
  }

  async function preparedPageImage(page, pageIndex) {
    var canvas = document.createElement("canvas");
    renderImageCanvas(page, canvas);
    var blob = await canvasBlob(canvas, 0.85);
    if (blob.size > 1.9 * 1024 * 1024) {
      blob = await canvasBlob(canvas, 0.7);
    }
    if (blob.size > 1.9 * 1024 * 1024) {
      throw new Error((pageIndex + 1) + "번째 장 용량이 너무 커요. 사진을 다시 찍거나 해상도를 낮춰 주세요.");
    }
    return blobImage(blob);
  }

  async function preparedPageImages(pages) {
    var images = [];
    for (var pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      images.push(await preparedPageImage(pages[pageIndex], pageIndex));
    }
    return images;
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

  function isCurrentAnalysisRequest(student, generation) {
    return state.currentStudent && state.currentStudent.id === student.id &&
      state.pageGeneration === generation && state.currentView === "capture";
  }

  function closeDeferredRequestPages(requestPages) {
    var pagesToClose = [];
    requestPages.concat(state.deferredPages).forEach(function (page) {
      var stillSelected = state.pages.some(function (currentPage) {
        return currentPage.bitmap === page.bitmap;
      });
      var alreadyQueued = pagesToClose.some(function (queuedPage) {
        return queuedPage.bitmap === page.bitmap;
      });
      if (!stillSelected && !alreadyQueued) {
        pagesToClose.push(page);
      }
    });
    pagesToClose.forEach(closePageBitmap);
    state.deferredPages = state.deferredPages.filter(function (page) {
      return state.pages.some(function (currentPage) {
        return currentPage.bitmap === page.bitmap;
      });
    });
  }

  async function analyzeSelectedSheet() {
    var setup = byId("analysis-setup");
    var progress = byId("analysis-progress");
    var testId = byId("test-select").value;

    if (!state.pages.length || !state.currentStudent) {
      showToast("사진과 학생을 먼저 선택해 주세요.");
      return;
    }

    state.pageGeneration += 1;
    var requestGeneration = state.pageGeneration;
    var requestPages = state.pages.map(function (page) {
      return { file: page.file, bitmap: page.bitmap, rotation: page.rotation };
    });
    state.analysisInProgress = true;
    updatePageSelection();
    renderPagePreviews();
    setup.hidden = true;
    progress.hidden = false;
    window.requestAnimationFrame(function () {
      progress.classList.add("is-running");
      progress.querySelector("[role='progressbar']").setAttribute("aria-valuenow", "100");
    });

    // 판독 중 로그아웃·재로그인하면 응답이 다른 학생 세션에 저장되는 것 방지
    var requestStudent = state.currentStudent;

    try {
      var images = await preparedPageImages(requestPages);
      if (!isCurrentAnalysisRequest(requestStudent, requestGeneration)) {
        return;
      }
      var analysis = await adapter.analyzeSheet(images, testId, requestStudent.id);
      if (!isCurrentAnalysisRequest(requestStudent, requestGeneration)) {
        return;
      }
      var rotation = correctionDegrees(analysis.orientation);
      if (analysis.hint === "ROTATE" && rotation) {
        if (requestPages.length === 1 && !state.rotationRetried) {
          state.rotationRetried = true;
          requestPages[0].rotation = (requestPages[0].rotation + rotation + 360) % 360;
          if (state.pages[0] && state.pages[0].bitmap === requestPages[0].bitmap) {
            state.pages[0].rotation = requestPages[0].rotation;
          }
          renderPagePreviews();
          images = await preparedPageImages(requestPages);
          if (!isCurrentAnalysisRequest(requestStudent, requestGeneration)) {
            return;
          }
          analysis = await adapter.analyzeSheet(images, testId, requestStudent.id);
          if (!isCurrentAnalysisRequest(requestStudent, requestGeneration)) {
            return;
          }
        } else if (requestPages.length > 1 && !state.rotateWarned) {
          state.rotateWarned = true;
          setup.hidden = false;
          progress.hidden = true;
          progress.classList.remove("is-running");
          showToast("사진 방향을 확인하고 회전 버튼으로 바로잡아 주세요");
          return;
        }
      }
      state.analysis = analysis;
      state.correctedHalfRule = !analysis.rules || analysis.rules.correctedHalfRule !== false;
      state.wrongItems = analysis.wrongItems.map(function (item) {
        return Object.assign({}, item);
      });
      byId("score-deduction").value = "";
      byId("score-error").textContent = "";
      byId("duplicate-resolution").hidden = true;
      byId("score-duplicate-resolution").hidden = true;
      byId("optional-wordbook").open = false;
      hideConsentRequiredPanel();
      renderAnalysis();
      await showView("analysis");
    } catch (error) {
      if (!isCurrentAnalysisRequest(requestStudent, requestGeneration)) {
        return;
      }
      reportPipelineError("analyze", error);
      setup.hidden = false;
      progress.hidden = true;
      progress.classList.remove("is-running");
      if (error.code === "CONSENT_REQUIRED") {
        renderConsentRequiredPanel();
        return;
      }
      showToast(error.message || "판독하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      closeDeferredRequestPages(requestPages);
      state.analysisInProgress = false;
      updatePageSelection();
      renderPagePreviews();
    }
  }

  function renderAnalysisSummary() {
    var container = byId("analysis-summary");
    var registeredTest = getTest(state.analysis.testId);
    var recognizedTest = state.analysis.test || {
      id: state.analysis.testId,
      title: registeredTest ? registeredTest.title : state.analysis.testId,
      totalQuestions: state.analysis.total,
      source: registeredTest && registeredTest.source || "registered"
    };
    var titleRow = makeElement("div", "analysis-test-heading");
    var title = makeElement("h2", "", recognizedTest.title);
    titleRow.appendChild(title);
    if (state.analysis.rules && state.analysis.rules.totalEstimated) {
      titleRow.appendChild(makeElement("span", "version-badge", "추정"));
    }
    var meta = makeElement(
      "div",
      "analysis-meta",
      recognizedTest.totalQuestions + "문항 · " + formatDate(state.analysis.detectedDate)
    );
    var deduction = state.analysis.expected === null
      ? null
      : Number(state.analysis.deduction !== undefined ? state.analysis.deduction : state.analysis.expected);
    var scoreValue = deduction === null ? "—" : state.analysis.total - deduction;
    var scoreLine = makeElement(
      "div",
      "recognized-score-line",
      deduction === null
        ? "인식한 점수: 감점 확인 필요"
        : "인식한 점수: −" + deduction + " → " + scoreValue + "/" + state.analysis.total
    );

    container.replaceChildren(titleRow, meta, scoreLine);
    byId("score-deduction-field").hidden = false;
    byId("score-deduction").value = deduction === null ? "" : String(deduction);
    byId("score-deduction-label").textContent = deduction === null
      ? "시험지에서 확인한 감점 (선택)"
      : "인식한 감점";
    byId("score-deduction-help").textContent = deduction === null
      ? ""
      : "인식이 틀렸으면 감점을 고쳐 주세요.";
  }

  function currentGateResult() {
    var expectedHalf = state.analysis.expected === null
      ? null
      : Math.round(Number(state.analysis.expected) * 2);
    var wrongHalf = state.wrongItems.filter(function (item) {
      return (item.mark || "wrong") === "wrong";
    }).length * 2;
    var corrected = state.wrongItems.filter(function (item) {
      return item.mark === "corrected";
    }).length;
    return {
      pass: expectedHalf !== null && (
        expectedHalf === wrongHalf ||
        (state.correctedHalfRule && expectedHalf === wrongHalf + corrected)
      ),
      expected: expectedHalf === null ? null : expectedHalf / 2
    };
  }

  function deductionHalfFromInput(inputId) {
    var inputValue = byId(inputId).value.trim();
    var value = Number(inputValue);
    var half = Math.round(value * 2);
    return inputValue !== "" && Number.isFinite(value) && value >= 0 &&
      value <= state.analysis.total && half / 2 === value
      ? half : null;
  }

  function scoreDeductionHalf() {
    return deductionHalfFromInput("score-deduction");
  }

  function recognizedDeductionHalf() {
    return state.analysis.expected === null
      ? null
      : Math.round(Number(state.analysis.expected) * 2);
  }

  function scoreOverrideDeductionHalf() {
    var inputHalf = scoreDeductionHalf();
    return inputHalf !== null && inputHalf !== recognizedDeductionHalf() ? inputHalf : null;
  }

  function renderGate() {
    var result = currentGateResult();
    var gate = makeElement("div", result.pass ? "gate" : "gate is-warning");
    var strong;

    if (result.expected === null) {
      strong = makeElement(
        "strong",
        "",
        "감점을 못 읽었어요 — 찾은 표시 개수로 점수를 계산해요 (직접 입력도 가능)"
      );
    } else if (result.pass) {
      strong = makeElement("strong", "", "감점 " + result.expected + "점과 오답 표시가 딱 맞아요");
    } else {
      strong = makeElement(
        "strong",
        "",
        "시험지 감점(" + result.expected + "점)과 찾은 표시가 달라요 — 저장은 되니, 나중에 시험지만 한 번 확인해 주세요"
      );
    }

    gate.appendChild(strong);
    var inputHalf = scoreDeductionHalf();
    if (
      byId("score-deduction").value.trim() !== "" &&
      inputHalf !== null &&
      recognizedDeductionHalf() !== null &&
      inputHalf !== recognizedDeductionHalf()
    ) {
      gate.appendChild(makeElement("span", "gate-info", "선생님이 고친 감점으로 저장돼요."));
    }
    byId("gate-card").replaceChildren(gate);
    byId("wrong-count").textContent = state.wrongItems.length + "개";
    updateAnalysisSaveButtons();
  }

  function updateWrongItem(index, fieldName, value) {
    state.wrongItems[index][fieldName] = value;
    renderGate();
  }

  function excludeWrongItem(index) {
    state.wrongItems.splice(index, 1);
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

  function fillDuplicateResolution(container, existing, onNewAttempt, onReplace) {
    var attemptLabel = existing && existing.attemptLabel ? " · " + existing.attemptLabel : "";
    var title = makeElement("strong", "", "같은 날짜에 저장한 시험 기록이 이미 있어요");
    var detail = makeElement(
      "span",
      "",
      "기존 기록: " + (existing && existing.attemptNo ? existing.attemptNo : "?") + "회차" + attemptLabel
    );
    var actions = makeElement("div", "duplicate-resolution-actions");
    actions.append(
      makeButton("새 회차로 저장", "button button-secondary", onNewAttempt),
      makeButton("이전 것 교체", "button button-primary", onReplace)
    );
    container.replaceChildren(title, detail, actions);
    container.hidden = false;
    container.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderDuplicateResolution(existing, saveMode) {
    var container = byId(saveMode === "score" ? "score-duplicate-resolution" : "duplicate-resolution");
    var saveAgain = saveMode === "score" ? saveScore : saveWords;
    fillDuplicateResolution(
      container,
      existing,
      function () { saveAgain("new_attempt"); },
      function () { saveAgain("replace"); }
    );
    updateAnalysisSaveButtons();
  }

  function updateAnalysisSaveButtons() {
    var unavailable = !state.analysis || state.saveInProgress;
    byId("save-score-button").disabled = unavailable || !byId("duplicate-resolution").hidden;
    byId("save-score-only-button").disabled = unavailable || !byId("score-duplicate-resolution").hidden;
  }

  async function finishAttemptSave(message, studentView) {
    clearPages();
    showToast(message);
    if (state.role === "teacher") {
      state.teacherStudentId = state.currentStudent.id;
    }
    await showView(state.role === "teacher" ? "teacher-detail" : studentView);
  }

  async function saveScore(onDuplicate) {
    var deductionHalf = scoreOverrideDeductionHalf();
    byId("score-error").textContent = "";
    if (byId("score-deduction").value.trim() && scoreDeductionHalf() === null) {
      byId("score-error").textContent = "감점은 0.5점 단위로, 0점부터 만점까지 입력해 주세요.";
      byId("score-deduction").focus();
      return;
    }
    if (state.saveInProgress) {
      return;
    }
    state.saveInProgress = true;
    updateAnalysisSaveButtons();
    try {
      byId("score-duplicate-resolution").hidden = true;
      await adapter.saveAnalysis(
        state.currentStudent.id,
        state.analysis,
        [],
        "",
        { scoreOnly: true, onDuplicate: onDuplicate, deductionHalf: deductionHalf }
      );
    } catch (error) {
      reportPipelineError("save_score", error);
      if (error.code === "DUPLICATE" && error.details && error.details.existing) {
        renderDuplicateResolution(error.details.existing, "score");
        return;
      }
      showToast(error.message || "성적을 저장하지 못했어요.");
      return;
    } finally {
      state.saveInProgress = false;
      updateAnalysisSaveButtons();
    }
    await finishAttemptSave("성적을 저장했어요.", "records");
  }

  async function saveWords(onDuplicate) {
    var deductionHalf = scoreOverrideDeductionHalf();
    var validWrongItems = state.wrongItems.filter(function (item) {
      return item.mark !== "unclear" && item.word.trim() && item.meaning.trim();
    });

    byId("score-error").textContent = "";
    if (byId("score-deduction").value.trim() && scoreDeductionHalf() === null) {
      byId("score-error").textContent = "감점은 0.5점 단위로, 0점부터 만점까지 입력해 주세요.";
      byId("score-deduction").focus();
      return;
    }

    if (state.saveInProgress) {
      return;
    }
    state.saveInProgress = true;
    updateAnalysisSaveButtons();
    try {
      byId("duplicate-resolution").hidden = true;
      await adapter.saveAnalysis(
        state.currentStudent.id,
        state.analysis,
        validWrongItems,
        "",
        { onDuplicate: onDuplicate, deductionHalf: deductionHalf }
      );
    } catch (error) {
      reportPipelineError("save_full", error);
      if (error.code === "DUPLICATE" && error.details && error.details.existing) {
        renderDuplicateResolution(error.details.existing, "full");
        return;
      }
      showToast(error.message || "저장하지 못했어요.");
      return;
    } finally {
      state.saveInProgress = false;
      updateAnalysisSaveButtons();
    }
    await finishAttemptSave(
      validWrongItems.length
        ? "성적과 오답 단어 " + validWrongItems.length + "개를 저장했어요."
        : "성적을 저장했어요. 담을 오답 단어가 없었어요.",
      "wordbook"
    );
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
    var modeTitle = makeElement("h2", "", "어떻게 풀어 볼까요?");
    var modeOptions = makeElement("div", "count-options retest-mode-options");
    var title = makeElement("h2", "", "몇 문제를 풀어 볼까요?");
    var options = makeElement("div", "count-options");
    var modeValues = [
      { key: "meaning", label: "뜻 맞추기" },
      { key: "spelling", label: "철자 쓰기" }
    ];
    var values = [
      { key: "5", label: "5문제", value: 5, disabled: learningWords.length < 5 },
      { key: "10", label: "10문제", value: 10, disabled: learningWords.length < 10 },
      { key: "all", label: "전체", value: learningWords.length, disabled: false }
    ];

    modeOptions.setAttribute("aria-label", "재시험 방식");
    modeValues.forEach(function (option) {
      var button = makeButton(option.label, "count-option", function () {
        state.retestMode = option.key;
        renderRetestStart();
      });
      var active = state.retestMode === option.key;
      button.id = "retest-mode-" + option.key;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      modeOptions.appendChild(button);
    });

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
    start.id = "retest-start-button";
    var guide = makeElement("p", "privacy-note", "두 번 연속 맞히면 '다 외운 단어'가 돼요!");
    card.append(label, count, modeTitle, modeOptions);
    if (state.retestMode === "spelling") {
      card.appendChild(makeElement("p", "retest-mode-guide", "뜻을 보고 영어 철자를 직접 써요"));
    }
    card.append(title, options, start, guide);
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
      mode: state.retestMode,
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
    var correct = quiz.mode === "spelling"
      ? window.RewordCore.normalizeSpelling(answer) === window.RewordCore.normalizeSpelling(question.word)
      : window.RewordCore.normalizeMeaning(answer) === window.RewordCore.normalizeMeaning(question.answer);

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
    var isSpelling = quiz.mode === "spelling";
    var content = byId("retest-content");
    var shell = makeElement("div");
    var topline = makeElement("div", "quiz-topline");
    var number = makeElement("span", "", (quiz.index + 1) + " / " + quiz.questions.length);
    var mode = makeElement("span", "", isSpelling ? "철자 쓰기" : (question.mode === "choice" ? "뜻 고르기" : "뜻 직접 쓰기"));
    var progress = makeElement("div", "quiz-progress-track");
    var progressFill = makeElement("span", "quiz-progress-fill");
    var card = makeElement("div", "card quiz-card");
    var label = makeElement("p", "quiz-word-label", isSpelling ? "이 뜻의 영어 단어는?" : "이 단어의 뜻은?");
    var word = makeElement("h2", "quiz-word", isSpelling ? question.answer : question.word);

    progressFill.style.width = ((quiz.index + 1) / quiz.questions.length * 100) + "%";
    progress.appendChild(progressFill);
    topline.append(number, mode);
    shell.append(topline, progress);

    if (isSpelling) {
      var spellingForm = makeElement("form", "spelling-answer-form");
      var spellingLabel = makeElement("label", "", "영어 철자를 입력해 주세요");
      var spellingInput = makeElement("input");
      var spellingButton = makeElement("button", "button button-primary button-block", "확인");
      spellingLabel.htmlFor = "spelling-answer";
      spellingInput.id = "spelling-answer";
      spellingInput.type = "text";
      spellingInput.autocomplete = "off";
      spellingInput.setAttribute("autocapitalize", "none");
      spellingInput.setAttribute("autocorrect", "off");
      spellingInput.spellcheck = false;
      spellingInput.lang = "en";
      spellingInput.value = quiz.selectedAnswer;
      spellingInput.disabled = quiz.answered;
      spellingButton.type = "submit";
      spellingButton.disabled = quiz.answered;
      spellingForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!spellingInput.value.trim()) {
          spellingInput.focus();
          return;
        }
        gradeAnswer(spellingInput.value.trim());
      });
      spellingForm.append(spellingLabel, spellingInput, spellingButton);
      // 같은 뜻을 가진 단어가 둘일 수 있으므로 글자 수 힌트로 어느 단어인지 특정한다
      var hintSlots = question.word.split("").map(function (ch) {
        return /[\p{L}\p{N}]/u.test(ch) ? "_" : ch;
      }).join(" ");
      var hint = makeElement("p", "spelling-hint", hintSlots);
      hint.setAttribute("aria-label", "글자 수 힌트");
      card.append(label, word, hint, spellingForm);
    } else if (question.mode === "choice") {
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
      if (quiz.currentCorrect) {
        feedback.textContent = "정답이에요. 동그라미!";
      } else if (isSpelling) {
        feedback.append(
          "아쉬워요. 정답은 “",
          makeElement("strong", "spelling-correct-answer", question.word),
          "”이에요."
        );
      } else {
        feedback.textContent = "아쉬워요. 정답은 “" + question.answer + "”이에요.";
      }
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
        makeElement(
          "span",
          "",
          test.id + " · " + test.totalQuestions + "점 · " +
            (test.words.length ? "단어 " + test.words.length + "개" : "점수 기록용")
        )
      );
      row.append(copy, badge);
      fragment.appendChild(row);
    });
    container.replaceChildren(fragment);
  }

  async function renderTeacherDashboard() {
    var isOwner = Boolean(state.currentUser && state.currentUser.role === "owner");
    byId("student-create-section").hidden = !isOwner;
    byId("score-only-test-section").hidden = !isOwner;
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

  async function registerScoreOnlyTest(event) {
    event.preventDefault();
    var titleInput = byId("score-only-test-title");
    var totalInput = byId("score-only-test-total");
    var message = byId("score-only-test-message");
    var submitButton = byId("score-only-test-button");
    var title = titleInput.value.trim();
    var total = Number(totalInput.value);

    if (!title) {
      message.textContent = "시험명을 입력해 주세요.";
      titleInput.focus();
      return;
    }
    if (!Number.isInteger(total) || total < 1) {
      message.textContent = "만점을 1 이상으로 입력해 주세요.";
      totalInput.focus();
      return;
    }

    submitButton.disabled = true;
    message.textContent = "";
    try {
      var test = await adapter.registerTest({
        title: title,
        totalQuestions: total,
        words: []
      });
      byId("score-only-test-form").reset();
      await renderRegisteredTests();
      showToast("‘" + test.title + "’을 만들었어요.");
    } catch (error) {
      message.textContent = error.message || "시험을 만들지 못했어요.";
    } finally {
      submitButton.disabled = false;
    }
  }

  function localTodayString() {
    var now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  function renderTeacherScoreChart(chart, empty, history, testId) {
    var visible = history.filter(function (record) {
      return !testId || record.testId === testId;
    });
    chart.replaceChildren();
    chart.style.width = Math.max(100, visible.length * 70) + "px";
    empty.hidden = visible.length > 0;
    chart.hidden = visible.length === 0;

    visible.forEach(function (record) {
      var percent = record.total ? Math.round(record.score / record.total * 100) : 0;
      var title = getTestTitle(record.testId) + " " + record.score + "/" + record.total;
      var column = makeElement("div", "chart-column");
      var value = makeElement("span", "chart-value", percent + "%");
      var bar = makeElement("span", "chart-bar");
      var label = makeElement("span", "chart-label", record.date.slice(5).replace("-", "."));
      column.title = title;
      bar.title = title;
      bar.style.height = Math.max(percent * 1.55, 4) + "px";
      column.append(value, bar, label);
      chart.appendChild(column);
    });
  }

  function shuffledCopy(items) {
    var result = items.slice();
    var index;

    for (index = result.length - 1; index > 0; index -= 1) {
      var targetIndex = Math.floor(Math.random() * (index + 1));
      var current = result[index];
      result[index] = result[targetIndex];
      result[targetIndex] = current;
    }
    return result;
  }

  function renderPrintRetestPreview() {
    var preview = state.printRetest;
    var content = byId("print-preview-content");
    var printButton = byId("print-button");

    if (!preview || !preview.student || !preview.questions.length) {
      var empty = makeElement("div", "empty-state");
      empty.append(
        makeElement("strong", "", "미리볼 재시험지가 없어요"),
        makeElement("span", "", "학생 상세에서 문제 수를 고른 뒤 다시 열어 주세요.")
      );
      printButton.disabled = true;
      content.replaceChildren(empty);
      return;
    }

    printButton.disabled = false;
    var documentWrap = makeElement("div", "print-document");
    var testSheet = makeElement("section", "print-sheet print-test-sheet");
    var testHeader = makeElement("header", "print-sheet-header");
    var testTitle = makeElement("h1", "", "동그라미 재시험");
    var testMeta = makeElement("div", "print-sheet-meta");
    var questionList = makeElement("ol", "print-question-list");
    testTitle.id = "print-preview-title";
    testMeta.append(
      makeElement("span", "", "학생 " + preview.student.nickname),
      makeElement("span", "", "날짜 ______"),
      makeElement("span", "", "점수 ______")
    );
    testHeader.append(testTitle, testMeta);
    preview.questions.forEach(function (question) {
      var item = makeElement("li");
      item.append(
        makeElement("span", "print-question-meaning", question.meaning),
        makeElement("span", "print-answer-line")
      );
      questionList.appendChild(item);
    });
    testSheet.append(testHeader, questionList);

    var answerSheet = makeElement("section", "print-sheet print-answer-sheet");
    var answerHeader = makeElement("header", "print-sheet-header");
    var answerTitle = makeElement("h1", "", "동그라미 재시험 정답지");
    var answerMeta = makeElement("div", "print-sheet-meta");
    var answerList = makeElement("ol", "print-answer-list");
    answerMeta.append(
      makeElement("span", "", "학생 " + preview.student.nickname),
      makeElement("span", "", "채점용")
    );
    answerHeader.append(answerTitle, answerMeta);
    preview.questions.forEach(function (question) {
      answerList.appendChild(makeElement("li", "", question.word));
    });
    answerSheet.append(answerHeader, answerList);
    documentWrap.append(testSheet, answerSheet);
    content.replaceChildren(documentWrap);
  }

  async function renderTeacherDetail() {
    var student = await adapter.getStudent(state.teacherStudentId);
    var container = byId("teacher-detail-content");
    var fragment = document.createDocumentFragment();

    if (!student) {
      var missingStudent = makeElement("div", "empty-state");
      missingStudent.append(makeElement("strong", "", "학생 정보를 찾지 못했어요"));
      container.replaceChildren(missingStudent);
      return;
    }

    var detailData = await Promise.all([
      adapter.getHistory(student.id),
      adapter.getWordbook(student.id),
      adapter.getTests()
    ]);
    var history = detailData[0].slice().sort(function (first, second) {
      return first.date.localeCompare(second.date);
    });
    var words = detailData[1];
    var isOwner = Boolean(state.currentUser && state.currentUser.role === "owner");
    state.tests = detailData[2];

    var heading = makeElement("div", "detail-heading");
    var headingCopy = makeElement("div");
    var eyebrow = makeElement("p", "eyebrow", "학생 상세");
    var title = makeElement("h1", "", student.nickname + " · " + student.grade);
    title.id = "teacher-detail-title";
    headingCopy.append(eyebrow, title);
    heading.appendChild(headingCopy);
    fragment.appendChild(heading);

    var chartCard = makeElement("section", "card chart-card teacher-chart-card");
    var chartHeading = makeElement("div", "teacher-chart-heading");
    var chartCopy = makeElement("div");
    var chartTitle = makeElement("h2", "", "성적 추이");
    chartCopy.append(chartTitle, makeElement("p", "", "지금까지의 시험 점수를 날짜순으로 보여요."));
    var chartFilterLabel = makeElement("label", "teacher-chart-filter", "시험별 보기");
    var chartFilter = makeElement("select");
    chartFilter.id = "teacher-chart-filter";
    var allTests = makeElement("option", "", "전체 시험");
    allTests.value = "";
    chartFilter.appendChild(allTests);
    Array.from(new Set(history.map(function (record) { return record.testId; }))).forEach(function (testId) {
      var option = makeElement("option", "", getTestTitle(testId));
      option.value = testId;
      chartFilter.appendChild(option);
    });
    chartFilterLabel.htmlFor = chartFilter.id;
    chartFilterLabel.appendChild(chartFilter);
    chartHeading.append(chartCopy, chartFilterLabel);
    var chartScroll = makeElement("div", "teacher-chart-scroll");
    var chart = makeElement("div", "score-chart teacher-score-chart");
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", "학생 성적 추이 막대그래프");
    var chartEmpty = makeElement("div", "empty-state");
    chartEmpty.append(
      makeElement("strong", "", "아직 성적 기록이 없어요"),
      makeElement("span", "", "아래에서 점수를 직접 입력할 수 있어요.")
    );
    chartScroll.appendChild(chart);
    chartCard.append(chartHeading, chartScroll, chartEmpty);
    chartFilter.addEventListener("change", function () {
      renderTeacherScoreChart(chart, chartEmpty, history, chartFilter.value);
    });
    renderTeacherScoreChart(chart, chartEmpty, history, "");
    fragment.appendChild(chartCard);

    var manualCard = makeElement("section", "card manual-score-card");
    var manualHeading = makeElement("div", "section-heading");
    var manualHeadingCopy = makeElement("div");
    manualHeadingCopy.append(
      makeElement("p", "eyebrow", "사진 없이 기록"),
      makeElement("h2", "", "점수 직접 입력"),
      makeElement("p", "", "시험과 점수를 고르면 그래프에 바로 더해져요.")
    );
    manualHeading.appendChild(manualHeadingCopy);
    var manualForm = makeElement("form");
    manualForm.id = "manual-score-form";
    manualForm.noValidate = true;
    var manualFields = makeElement("div", "manual-score-fields");

    var testField = makeElement("div");
    var testLabel = makeElement("label", "", "시험");
    var testSelect = makeElement("select");
    testSelect.id = "manual-test-select";
    testLabel.htmlFor = testSelect.id;
    state.tests.forEach(function (test) {
      var option = makeElement("option", "", test.title);
      option.value = test.id;
      testSelect.appendChild(option);
    });
    testField.append(testLabel, testSelect);

    var scoreField = makeElement("div");
    var scoreLabel = makeElement("label", "", "점수");
    var scoreInput = makeElement("input");
    scoreInput.id = "manual-score-input";
    scoreInput.type = "number";
    scoreInput.min = "0";
    scoreInput.step = "0.5";
    scoreInput.inputMode = "decimal";
    scoreLabel.htmlFor = scoreInput.id;
    var totalHelp = makeElement("span", "field-help manual-score-total");
    totalHelp.id = "manual-score-total";
    scoreField.append(scoreLabel, scoreInput, totalHelp);

    var dateField = makeElement("div");
    var dateLabel = makeElement("label", "", "날짜");
    var dateInput = makeElement("input");
    dateInput.id = "manual-taken-on";
    dateInput.type = "date";
    dateInput.value = localTodayString();
    dateLabel.htmlFor = dateInput.id;
    dateField.append(dateLabel, dateInput);

    var attemptField = makeElement("div");
    var attemptLabel = makeElement("label", "", "회차 라벨");
    var optional = makeElement("span", "optional-label", "선택");
    var attemptInput = makeElement("input");
    attemptInput.id = "manual-attempt-label";
    attemptInput.type = "text";
    attemptInput.maxLength = 40;
    attemptInput.placeholder = "예: 첫 시험, 보충 시험";
    attemptLabel.htmlFor = attemptInput.id;
    attemptLabel.append(" ", optional);
    attemptField.append(attemptLabel, attemptInput);
    manualFields.append(testField, scoreField, dateField, attemptField);

    var manualMessage = makeElement("p", "form-message");
    manualMessage.id = "manual-score-message";
    manualMessage.setAttribute("role", "status");
    manualMessage.setAttribute("aria-live", "polite");
    var manualDuplicate = makeElement("div", "duplicate-resolution score-duplicate-resolution");
    manualDuplicate.id = "manual-score-duplicate-resolution";
    manualDuplicate.hidden = true;
    var manualButton = makeButton("점수 기록하기", "button button-primary", null);
    manualButton.id = "manual-score-button";
    manualButton.type = "submit";
    manualForm.append(manualFields, manualMessage, manualDuplicate, manualButton);
    manualCard.append(manualHeading, manualForm);
    fragment.appendChild(manualCard);

    var learningWords = words.filter(function (word) { return word.status === "learning"; });
    var paperCard = makeElement("section", "card paper-retest-card");
    paperCard.id = "paper-retest-card";
    var paperHeading = makeElement("div", "section-heading");
    var paperHeadingCopy = makeElement("div");
    paperHeadingCopy.append(
      makeElement("p", "eyebrow", "인쇄용 재시험"),
      makeElement("h2", "", "종이 재시험지"),
      makeElement("p", "", "뜻을 보고 영어 단어를 쓰는 시험지를 만들어요.")
    );
    var paperLearningCount = makeElement("strong", "paper-learning-count", "학습 중 " + learningWords.length + "개");
    paperLearningCount.id = "paper-learning-count";
    paperHeading.append(paperHeadingCopy, paperLearningCount);
    var paperCountTitle = makeElement("h3", "", "문제 수");
    var paperCountOptions = makeElement("div", "count-options paper-count-options");
    paperCountOptions.id = "paper-count-options";
    paperCountOptions.setAttribute("aria-label", "종이 재시험 문제 수");
    var paperValues = [
      { key: "10", label: "10문제", value: 10, disabled: learningWords.length < 10 },
      { key: "20", label: "20문제", value: 20, disabled: learningWords.length < 20 },
      { key: "all", label: "전체", value: learningWords.length, disabled: learningWords.length === 0 }
    ];
    if (
      (state.paperRetestChoice === "10" && learningWords.length < 10) ||
      (state.paperRetestChoice === "20" && learningWords.length < 20)
    ) {
      state.paperRetestChoice = "all";
    }
    var paperButtons = [];
    paperValues.forEach(function (option) {
      var button = makeButton(option.label, "count-option", function () {
        state.paperRetestChoice = option.key;
        updatePaperControls();
      });
      button.id = "paper-count-" + option.key;
      button.disabled = option.disabled;
      button.dataset.paperCount = option.key;
      paperButtons.push(button);
      paperCountOptions.appendChild(button);
    });
    var paperMessage = makeElement(
      "p",
      "paper-retest-message",
      learningWords.length ? "미리보기를 열 때마다 문항 순서가 바뀌어요." : "학습 중인 단어가 없어요"
    );
    var previewButton = makeButton("시험지 미리보기", "button button-primary button-block", function () {
      var selected = paperValues.find(function (option) { return option.key === state.paperRetestChoice; });
      var selectedCount = selected ? selected.value : learningWords.length;
      state.printRetest = {
        student: { id: student.id, nickname: student.nickname, grade: student.grade },
        questions: shuffledCopy(learningWords).slice(0, selectedCount)
      };
      showView("print-preview");
    });
    previewButton.id = "paper-preview-button";

    function updatePaperControls() {
      paperButtons.forEach(function (button) {
        var active = button.dataset.paperCount === state.paperRetestChoice;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      previewButton.disabled = learningWords.length === 0;
    }

    paperCard.append(paperHeading, paperCountTitle, paperCountOptions, paperMessage, previewButton);
    fragment.appendChild(paperCard);
    updatePaperControls();

    function selectedManualTest() {
      return state.tests.find(function (test) { return test.id === testSelect.value; }) || null;
    }

    function updateManualTotal() {
      var selectedTest = selectedManualTest();
      scoreInput.max = selectedTest ? String(selectedTest.totalQuestions) : "0";
      totalHelp.textContent = selectedTest ? "만점 " + selectedTest.totalQuestions + "점" : "시험을 먼저 만들어 주세요.";
      manualButton.disabled = !selectedTest;
    }

    var manualRequestId = null;
    async function saveManualScore(onDuplicate) {
      var selectedTest = selectedManualTest();
      var score = Number(scoreInput.value);
      var takenOn = dateInput.value;
      if (!selectedTest) {
        manualMessage.textContent = "시험을 먼저 선택해 주세요.";
        return;
      }
      if (
        scoreInput.value.trim() === "" || !Number.isFinite(score) || score < 0 ||
        score > selectedTest.totalQuestions || Math.round(score * 2) / 2 !== score
      ) {
        manualMessage.textContent = "점수는 0점부터 만점까지 0.5점 단위로 입력해 주세요.";
        scoreInput.focus();
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) {
        manualMessage.textContent = "시험 날짜를 선택해 주세요.";
        dateInput.focus();
        return;
      }

      manualMessage.textContent = "";
      manualDuplicate.hidden = true;
      manualButton.disabled = true;
      manualRequestId = manualRequestId || (window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : "manual-" + Date.now() + "-" + Math.random());
      try {
        await adapter.saveManualAttempt(student.id, {
          testId: selectedTest.id,
          deductionHalf: Math.round((selectedTest.totalQuestions - score) * 2),
          takenOn: takenOn,
          attemptLabel: attemptInput.value.trim() || undefined,
          clientRequestId: manualRequestId,
          onDuplicate: onDuplicate
        });
        await renderTeacherDetail();
        showToast("점수를 기록했어요");
      } catch (error) {
        if (error.code === "DUPLICATE" && error.details && error.details.existing) {
          fillDuplicateResolution(
            manualDuplicate,
            error.details.existing,
            function () { saveManualScore("new_attempt"); },
            function () { saveManualScore("replace"); }
          );
          return;
        }
        manualMessage.textContent = error.message || "점수를 기록하지 못했어요.";
      } finally {
        if (manualDuplicate.hidden) {
          manualButton.disabled = false;
        }
      }
    }

    testSelect.addEventListener("change", updateManualTotal);
    manualForm.addEventListener("submit", function (event) {
      event.preventDefault();
      saveManualScore();
    });
    updateManualTotal();

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
    var historyLabels = ["날짜", "시험", "점수"];
    if (isOwner) {
      historyLabels.push("관리");
    }
    historyLabels.forEach(function (label) {
      headerRow.appendChild(makeElement("th", "", label));
    });
    thead.appendChild(headerRow);
    var tbody = makeElement("tbody");
    history.slice().reverse().forEach(function (record) {
      var row = makeElement("tr");
      var testName = getTestTitle(record.testId) + (record.attemptLabel ? " · " + record.attemptLabel : "");
      var scoreCell = makeElement("td", "", record.score + "/" + record.total);
      row.append(
        makeElement("td", "", formatDate(record.date)),
        makeElement("td", "", testName),
        scoreCell
      );
      if (isOwner) {
        var actionCell = makeElement("td", "score-edit-cell");
        var editButton = makeButton("고치기", "text-button score-edit-button", function () {
          var editor = makeElement("div", "score-edit");
          var input = makeElement("input", "score-edit-input");
          var preview = makeElement("span", "score-edit-preview");
          var message = makeElement("span", "score-edit-message");
          var actions = makeElement("div", "score-edit-actions");
          var saveButton = makeButton("저장", "button button-primary", async function () {
            var deduction = Number(input.value);
            if (
              input.value.trim() === "" || !Number.isFinite(deduction) || deduction < 0 ||
              deduction > record.total || Math.round(deduction * 2) / 2 !== deduction
            ) {
              message.textContent = "감점은 0점부터 만점까지 0.5점 단위로 입력해 주세요.";
              input.focus();
              return;
            }
            message.textContent = "";
            saveButton.disabled = true;
            try {
              await adapter.correctAttemptScore(record.id, Math.round(deduction * 2));
            } catch (error) {
              message.textContent = error.message || "성적을 고치지 못했어요.";
              saveButton.disabled = false;
              return;
            }
            showToast("성적을 고쳤어요.");
            try {
              await renderTeacherDetail();
            } catch (error) {
              showToast("고친 점수는 저장됐어요. 화면을 새로 열면 반영돼 있어요.");
            }
          });
          var cancelButton = makeButton("취소", "button button-secondary", function () {
            actionCell.replaceChildren(editButton);
          });

          function updateScorePreview() {
            var deduction = Number(input.value);
            var valid = input.value.trim() !== "" && Number.isFinite(deduction) && deduction >= 0 &&
              deduction <= record.total && Math.round(deduction * 2) / 2 === deduction;
            preview.textContent = valid ? "→ " + (record.total - deduction) + "/" + record.total : "";
            message.textContent = "";
          }

          input.type = "number";
          input.min = "0";
          input.max = String(record.total);
          input.step = "0.5";
          input.inputMode = "decimal";
          input.value = String(record.total - record.score);
          input.setAttribute("aria-label", "감점");
          input.addEventListener("input", updateScorePreview);
          message.setAttribute("role", "status");
          actions.append(saveButton, cancelButton);
          editor.append(makeElement("span", "score-edit-label", "감점"), input, preview, actions, message);
          actionCell.replaceChildren(editor);
          updateScorePreview();
          input.focus();
          input.select();
        });
        actionCell.appendChild(editButton);
        row.appendChild(actionCell);
      }
      tbody.appendChild(row);
    });
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    fragment.appendChild(tableWrap);

    var wordHeading = makeElement("div", "section-heading");
    wordHeading.appendChild(makeElement("h2", "", "오답 단어"));
    fragment.appendChild(wordHeading);
    var wordList = makeElement("div", "word-list");
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
      if (state.currentView === "capture" || state.currentView === "analysis") {
        clearPages();
      }
      if (state.role === "student") {
        showView(adapter.isReal ? "wordbook" : "capture");
      } else if (state.role === "teacher") {
        showView("teacher");
      }
    });
    byId("camera-input").addEventListener("change", function (event) {
      handleImageSelection(event.target.files, event.target);
    });
    byId("gallery-input").addEventListener("change", function (event) {
      handleImageSelection(event.target.files, event.target);
    });
    byId("analyze-button").addEventListener("click", analyzeSelectedSheet);
    byId("capture-student-select").addEventListener("change", function (event) {
      state.currentStudent = state.captureStudents.find(function (student) {
        return student.id === event.target.value;
      }) || null;
      state.teacherStudentId = state.currentStudent ? state.currentStudent.id : null;
    });
    byId("retake-button").addEventListener("click", function () {
      clearPages();
      showView("capture");
    });
    byId("score-deduction").addEventListener("input", function () {
      byId("score-error").textContent = "";
      renderGate();
    });
    byId("save-score-button").addEventListener("click", function () { saveWords(); });
    byId("save-score-only-button").addEventListener("click", function () { saveScore(); });
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
        if ((state.currentView === "capture" && button.dataset.view !== "capture") ||
            state.currentView === "analysis") {
          clearPages();
        }
        showView(button.dataset.view);
      }
    });
    byId("test-register-form").addEventListener("submit", registerTest);
    byId("test-words").addEventListener("input", renderParseMessage);
    byId("score-only-test-form").addEventListener("submit", registerScoreOnlyTest);
    byId("student-create-form").addEventListener("submit", createStudent);
    byId("student-pin-copy-button").addEventListener("click", copyIssuedPin);
    byId("password-change-form").addEventListener("submit", changePassword);
    byId("teacher-back-button").addEventListener("click", function () {
      showView("teacher");
    });
    byId("print-preview-back-button").addEventListener("click", function () {
      showView("teacher-detail");
    });
    byId("print-button").addEventListener("click", function () {
      window.print();
    });
    byId("teacher-capture-button").addEventListener("click", function () {
      state.currentStudent = null;
      clearPages();
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
