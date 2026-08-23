(function () {
  "use strict";

  var STORAGE_PREFIX = "reword_";
  var SCHEMA_KEY = STORAGE_PREFIX + "schema_version";
  var STATE_KEY = STORAGE_PREFIX + "state";
  var memoryStorage = {};

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function resolved(value) {
    return Promise.resolve(value);
  }

  function readStorage(key) {
    if (Object.prototype.hasOwnProperty.call(memoryStorage, key)) {
      return memoryStorage[key];
    }
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    memoryStorage[key] = value;
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // localStorage를 쓸 수 없는 환경에서는 현재 탭의 메모리 상태만 유지한다.
    }
  }

  function createSeedState() {
    return {
      students: clone(window.RewordData.students),
      tests: clone(window.RewordData.tests),
      histories: clone(window.RewordData.histories),
      wordbooks: clone(window.RewordData.wordbooks),
      consents: clone(window.RewordData.consents || {}),
      acknowledgements: {},
      retests: []
    };
  }

  function todayString() {
    return new Date().toISOString().slice(0, 10);
  }

  function DataAdapter() {}

  [
    "authenticateStudent",
    "authenticateTeacher",
    "logout",
    "analyzeSheet",
    "getTests",
    "getStudents",
    "getStudent",
    "getHistory",
    "getWordbook",
    "getAllWords",
    "getRetestQuiz",
    "saveAnalysis",
    "saveRetestResult",
    "registerTest",
    "createStudent",
    "regeneratePin",
    "changePassword",
    "getConsent",
    "getConsentStatus",
    "createConsentLink",
    "createManualConsent",
    "acknowledge"
  ].forEach(function (methodName) {
    DataAdapter.prototype[methodName] = function () {
      return Promise.reject(new Error(methodName + "를 구현해야 합니다."));
    };
  });

  function MockAdapter() {
    this.isReal = false;
    this.schemaVersion = window.RewordData.schemaVersion;
    this.ensureState();
  }

  MockAdapter.prototype = Object.create(DataAdapter.prototype);
  MockAdapter.prototype.constructor = MockAdapter;

  MockAdapter.prototype.ensureState = function () {
    var storedVersion = Number(readStorage(SCHEMA_KEY));
    var storedState = readStorage(STATE_KEY);
    if (storedVersion !== this.schemaVersion || !storedState) {
      this.state = createSeedState();
      this.persist();
      return;
    }
    try {
      var parsed = JSON.parse(storedState);
      var valid = parsed && typeof parsed === "object" &&
        Array.isArray(parsed.students) && Array.isArray(parsed.tests) &&
        parsed.histories && typeof parsed.histories === "object" &&
        parsed.wordbooks && typeof parsed.wordbooks === "object" &&
        Array.isArray(parsed.retests);
      if (!valid) {
        throw new Error("저장 상태 구조가 손상됨");
      }
      parsed.consents = parsed.consents && typeof parsed.consents === "object" ? parsed.consents : {};
      parsed.acknowledgements = parsed.acknowledgements && typeof parsed.acknowledgements === "object"
        ? parsed.acknowledgements : {};
      this.state = parsed;
    } catch (error) {
      this.state = createSeedState();
      this.persist();
    }
  };

  MockAdapter.prototype.persist = function () {
    writeStorage(SCHEMA_KEY, String(this.schemaVersion));
    writeStorage(STATE_KEY, JSON.stringify(this.state));
  };

  MockAdapter.prototype.authenticateStudent = function (pin) {
    var student = this.state.students.find(function (item) { return item.pin === pin; });
    return resolved(student ? clone(student) : null);
  };

  MockAdapter.prototype.authenticateTeacher = function (loginId, password) {
    var candidate = typeof password === "string" ? password : loginId;
    return resolved(candidate === window.RewordData.teacherPassword
      ? { id: "mock-teacher", loginId: loginId || "owner", role: "owner" }
      : null);
  };

  MockAdapter.prototype.logout = function () {
    return resolved();
  };

  MockAdapter.prototype.getConsent = function (studentId) {
    var consent = this.state.consents[studentId] || null;
    return resolved(typeof consent === "string" ? consent : consent && consent.acceptedAt);
  };

  MockAdapter.prototype.getConsentStatus = function (studentId) {
    var consent = this.state.consents[studentId] || null;
    var acceptedAt = typeof consent === "string" ? consent : consent && consent.acceptedAt;
    var source = typeof consent === "string" ? "link" : consent && consent.source;
    return resolved({
      status: acceptedAt ? "accepted" : "none",
      acceptedAt: acceptedAt,
      source: source || null,
      pendingUntil: null
    });
  };

  MockAdapter.prototype.createConsentLink = function (studentId) {
    var acceptedAt = new Date().toISOString();
    var expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    this.state.consents[studentId] = { acceptedAt: acceptedAt, source: "link" };
    this.persist();
    return resolved({
      url: "https://demo.invalid/consent/" + encodeURIComponent(studentId),
      expiresAt: expiresAt
    });
  };

  MockAdapter.prototype.createManualConsent = function (studentId, input) {
    var acceptedAt = new Date().toISOString();
    this.state.consents[studentId] = {
      acceptedAt: acceptedAt,
      source: "paper",
      relation: input && input.relation || "guardian",
      note: input && input.note || null
    };
    this.persist();
    return resolved({ status: "accepted", source: "paper", acceptedAt: acceptedAt });
  };

  MockAdapter.prototype.acknowledge = function (studentId) {
    var acknowledgedAt = new Date().toISOString();
    this.state.acknowledgements[studentId] = acknowledgedAt;
    this.persist();
    return resolved(acknowledgedAt);
  };

  MockAdapter.prototype.getTests = function () {
    return resolved(clone(this.state.tests));
  };

  MockAdapter.prototype.getStudents = function () {
    return resolved(clone(this.state.students));
  };

  MockAdapter.prototype.getStudent = function (studentId) {
    var student = this.state.students.find(function (item) { return item.id === studentId; });
    return resolved(student ? clone(student) : null);
  };

  MockAdapter.prototype.getHistory = function (studentId) {
    return resolved(clone(this.state.histories[studentId] || []));
  };

  MockAdapter.prototype.getWordbook = function (studentId) {
    return resolved(clone(this.state.wordbooks[studentId] || []));
  };

  MockAdapter.prototype.getAllWords = function () {
    return resolved(clone(this.state.tests.reduce(function (allWords, test) {
      return allWords.concat(test.words);
    }, [])));
  };

  MockAdapter.prototype.getRetestQuiz = function (studentId, count) {
    var learningWords = (this.state.wordbooks[studentId] || []).filter(function (word) {
      return word.status === "learning";
    });
    return resolved({
      questions: window.RewordCore.buildQuiz(
        learningWords,
        this.state.tests.reduce(function (allWords, test) { return allWords.concat(test.words); }, []),
        count
      )
    });
  };

  MockAdapter.prototype.findTest = function (testId) {
    return this.state.tests.find(function (item) { return item.id === testId; }) || null;
  };

  MockAdapter.prototype.analyzeSheet = function (_image, testId, studentId) {
    var test = this.findTest(testId);
    if (!testId) {
      return new Promise(function (resolve) {
        window.setTimeout(function () {
          resolve({
            draftId: "mock-draft-" + Date.now(),
            testId: "mock-photo-test",
            test: {
              id: "mock-photo-test",
              title: "목 시험지",
              totalQuestions: 30,
              source: "photo"
            },
            studentId: studentId,
            score: 28,
            total: 30,
            gate: "pass",
            rules: { correctedHalfRule: true },
            wrongItems: [
              {
                itemId: "mock-photo-item-3",
                questionNo: 3,
                word: "adventure",
                meaning: "모험",
                mark: "wrong"
              },
              {
                itemId: "mock-photo-item-11",
                questionNo: 11,
                word: "기억",
                meaning: "memory",
                mark: "wrong"
              }
            ],
            detectedDate: todayString(),
            orientation: "upright"
          });
        }, 350);
      });
    }
    var history = (this.state.histories[studentId] || []).filter(function (item) {
      return item.testId === testId;
    });
    var scoreByStudent = {
      "student-minjun": 23,
      "student-seoyeon": 27,
      "student-haeun": testId === "VOCA-D0506" ? 25 : 19
    };
    var total = test ? test.totalQuestions : 30;
    var fallback = history.length ? history[history.length - 1].score : Math.max(total - 5, 0);
    var score = Object.prototype.hasOwnProperty.call(scoreByStudent, studentId)
      ? scoreByStudent[studentId] : fallback;
    score = Math.max(0, Math.min(score, total));
    var words = test ? test.words.slice(0, Math.max(total - score, 0)) : [];
    return new Promise(function (resolve) {
      window.setTimeout(function () {
        resolve({
          draftId: "mock-draft-" + Date.now(),
          testId: testId,
          test: {
            id: testId,
            title: test.title,
            totalQuestions: total,
            source: test.source || "registered"
          },
          studentId: studentId,
          score: score,
          total: total,
          gate: "pass",
          wrongItems: words.map(function (item, index) {
            return {
              itemId: item.id || "mock-item-" + (index + 1),
              questionNo: index + 1,
              word: item.word,
              meaning: item.meaning,
              mark: "wrong"
            };
          }),
          detectedDate: todayString(),
          orientation: "upright"
        });
      }, 350);
    });
  };

  MockAdapter.prototype.saveAnalysis = function (studentId, analysis, wrongItems) {
    var currentWords = this.state.wordbooks[studentId] || [];
    var now = analysis.detectedDate || todayString();
    wrongItems.forEach(function (item, index) {
      var existing = currentWords.find(function (word) {
        return word.word.toLowerCase() === item.word.toLowerCase();
      });
      if (existing) {
        existing.meaning = item.meaning;
        existing.sourceTestId = analysis.testId;
        existing.status = "learning";
        existing.consecutiveCorrect = 0;
      } else {
        currentWords.push({
          id: "word-" + Date.now() + "-" + index,
          word: item.word,
          meaning: item.meaning,
          sourceTestId: analysis.testId,
          status: "learning",
          consecutiveCorrect: 0,
          addedAt: now
        });
      }
    });
    this.state.wordbooks[studentId] = currentWords;
    this.state.histories[studentId] = this.state.histories[studentId] || [];
    this.state.histories[studentId].push({
      id: "history-" + Date.now(),
      testId: analysis.testId,
      score: analysis.score,
      total: analysis.total,
      date: now
    });
    this.persist();
    return resolved({ attempt: clone(analysis), wordbook: clone(currentWords) });
  };

  MockAdapter.prototype.saveRetestResult = function (studentId, results) {
    var words = this.state.wordbooks[studentId] || [];
    var graduatedWords = [];
    results.forEach(function (result) {
      var index = words.findIndex(function (word) { return word.id === result.wordId; });
      if (index === -1) {
        return;
      }
      var wasGraduated = words[index].status === "graduated";
      words[index] = window.RewordCore.applyRetestResult(words[index], result.correct);
      if (!wasGraduated && words[index].status === "graduated") {
        graduatedWords.push(clone(words[index]));
      }
    });
    this.state.wordbooks[studentId] = words;
    this.state.retests.push({
      id: "retest-" + Date.now(),
      studentId: studentId,
      date: todayString(),
      results: clone(results)
    });
    this.persist();
    return resolved({ words: clone(words), graduatedWords: graduatedWords });
  };

  MockAdapter.prototype.registerTest = function (testInput) {
    var compactDate = todayString().replace(/-/g, "");
    var count = this.state.tests.filter(function (test) {
      return test.id.indexOf("CUSTOM-" + compactDate) === 0;
    }).length;
    var test = {
      id: "CUSTOM-" + compactDate + "-" + String(count + 1).padStart(2, "0"),
      code: "CUSTOM-" + compactDate + "-" + String(count + 1).padStart(2, "0"),
      title: testInput.title,
      version: 1,
      totalQuestions: testInput.totalQuestions,
      formHint: testInput.formHint || "other",
      words: clone(testInput.words)
    };
    this.state.tests.push(test);
    this.persist();
    return resolved(clone(test));
  };

  MockAdapter.prototype.createStudent = function (studentInput) {
    var id = "student-" + Date.now();
    var pin;
    while (this.state.students.some(function (item) { return item.id === id; })) {
      id += "-new";
    }
    do {
      pin = String(Math.floor(1000 + Math.random() * 9000));
    } while (this.state.students.some(function (item) { return item.pin === pin; }));
    var student = {
      id: id,
      nickname: String(studentInput.nickname || "").trim(),
      grade: String(studentInput.grade || "").trim() || "미정",
      pin: pin
    };
    this.state.students.push(student);
    this.state.histories[id] = [];
    this.state.wordbooks[id] = [];
    this.persist();
    return resolved(clone(student));
  };

  MockAdapter.prototype.regeneratePin = function (studentId) {
    var student = this.state.students.find(function (item) { return item.id === studentId; });
    var pin;
    if (!student) {
      return resolved(null);
    }
    do {
      pin = String(Math.floor(1000 + Math.random() * 9000));
    } while (this.state.students.some(function (item) { return item.pin === pin; }));
    student.pin = pin;
    this.persist();
    return resolved(pin);
  };

  MockAdapter.prototype.changePassword = function () {
    return resolved({ success: true });
  };

  function RealAdapter(baseUrl, slug) {
    this.isReal = true;
    this.baseUrl = String(baseUrl || "").replace(/\/+$/, "");
    this.slug = slug || "";
    this.tokenKey = "reword_api_token_" + this.slug;
    this.token = window.sessionStorage.getItem(this.tokenKey);
    this.principal = null;
  }

  RealAdapter.prototype = Object.create(DataAdapter.prototype);
  RealAdapter.prototype.constructor = RealAdapter;

  RealAdapter.prototype.endpoint = function (path) {
    return this.baseUrl + "/api/t/" + encodeURIComponent(this.slug) + path;
  };

  RealAdapter.prototype.request = async function (path, options) {
    var requestOptions = Object.assign({}, options || {});
    var headers = new Headers(requestOptions.headers || {});
    if (this.token && requestOptions.auth !== false) {
      headers.set("Authorization", "Bearer " + this.token);
    }
    delete requestOptions.auth;
    if (requestOptions.body !== undefined && typeof requestOptions.body !== "string") {
      headers.set("Content-Type", "application/json");
      requestOptions.body = JSON.stringify(requestOptions.body);
    }
    requestOptions.headers = headers;
    var response = await window.fetch(this.endpoint(path), requestOptions);
    var payload = response.status === 204 ? null : await response.json().catch(function () { return null; });
    if (!response.ok) {
      var error = new Error(payload && payload.error ? payload.error.message : "API 요청에 실패했습니다.");
      error.code = payload && payload.error ? payload.error.code : "API_ERROR";
      error.status = response.status;
      error.details = payload && payload.error ? payload.error : null;
      throw error;
    }
    return payload;
  };

  RealAdapter.prototype.setSession = function (token, principal) {
    this.token = token;
    this.principal = principal;
    window.sessionStorage.setItem(this.tokenKey, token);
    return principal;
  };

  RealAdapter.prototype.authenticateStudent = async function (pin) {
    try {
      var payload = await this.request("/auth/student", { method: "POST", auth: false, body: { pin: pin } });
      return this.setSession(payload.token, payload.student);
    } catch (error) {
      if (error.status === 401) {
        return null;
      }
      throw error;
    }
  };

  RealAdapter.prototype.authenticateTeacher = async function (loginId, password) {
    try {
      var payload = await this.request("/auth/user", {
        method: "POST",
        auth: false,
        body: { loginId: loginId, password: password }
      });
      return this.setSession(payload.token, payload.user);
    } catch (error) {
      if (error.status === 401) {
        return null;
      }
      throw error;
    }
  };

  RealAdapter.prototype.logout = async function () {
    try {
      if (this.token) {
        await this.request("/auth/logout", { method: "POST" });
      }
    } finally {
      this.token = null;
      this.principal = null;
      window.sessionStorage.removeItem(this.tokenKey);
    }
  };

  RealAdapter.prototype.getTests = function () { return this.request("/tests"); };
  RealAdapter.prototype.getStudents = function () { return this.request("/students"); };
  RealAdapter.prototype.createStudent = function (studentInput) {
    return this.request("/students", {
      method: "POST",
      body: {
        nickname: studentInput.nickname,
        // 현재 API는 학년 값을 필수로 받으므로 선택 입력은 명시적인 기본값으로 보낸다.
        grade: studentInput.grade || "미정"
      }
    });
  };
  RealAdapter.prototype.getStudent = function (id) { return this.request("/students/" + encodeURIComponent(id)); };
  RealAdapter.prototype.getHistory = function (id) { return this.request("/students/" + encodeURIComponent(id) + "/history"); };
  RealAdapter.prototype.getWordbook = function (id) { return this.request("/students/" + encodeURIComponent(id) + "/wordbook"); };
  RealAdapter.prototype.getAllWords = function () { return this.request("/words"); };
  RealAdapter.prototype.getRetestQuiz = function (id, count) {
    return this.request(
      "/students/" + encodeURIComponent(id) + "/retests/next?count=" + encodeURIComponent(count)
    );
  };

  RealAdapter.prototype.getConsentStatus = function (studentId) {
    return this.request("/students/" + encodeURIComponent(studentId) + "/consent");
  };

  RealAdapter.prototype.getConsent = async function (studentId) {
    var status = await this.getConsentStatus(studentId);
    return status.acceptedAt;
  };

  RealAdapter.prototype.createConsentLink = function (studentId) {
    return this.request("/students/" + encodeURIComponent(studentId) + "/consent-links", {
      method: "POST",
      body: {}
    });
  };

  RealAdapter.prototype.createManualConsent = function (studentId, input) {
    return this.request("/students/" + encodeURIComponent(studentId) + "/consent/manual", {
      method: "POST",
      body: {
        relation: input && input.relation || "guardian",
        note: input && input.note || undefined
      }
    });
  };

  RealAdapter.prototype.acknowledge = async function (studentId) {
    var payload = await this.request("/students/" + encodeURIComponent(studentId) + "/acknowledge", {
      method: "POST",
      body: {}
    });
    return payload.acknowledgedAt;
  };

  RealAdapter.prototype.analyzeSheet = function (image, testId, studentId, options) {
    if (!this.principal || !this.principal.role) {
      return Promise.reject(new Error("실서비스 촬영은 선생님 또는 조교 세션에서만 가능합니다."));
    }
    var images = Array.isArray(image) ? image : [image];
    return this.request("/analyze", {
      method: "POST",
      body: {
        images: images,
        testId: testId || undefined,
        studentId: studentId,
        attemptLabel: options && options.attemptLabel,
        batchSessionId: options && options.batchSessionId
      }
    });
  };

  RealAdapter.prototype.saveAnalysis = function (studentId, analysis, wrongItems, overrideReason, options) {
    var saveOptions = options || {};
    var current = new Map(wrongItems.map(function (item) { return [item.itemId, item]; }));
    var edits = [];
    (analysis.wrongItems || []).forEach(function (item) {
      var currentItem = current.get(item.itemId);
      if (!currentItem) {
        edits.push({ itemId: item.itemId, mark: "none" });
      } else {
        var edit = { itemId: item.itemId };
        if ((currentItem.mark || "wrong") !== item.mark) {
          edit.mark = currentItem.mark || "wrong";
        }
        if (currentItem.word.trim() !== item.word.trim()) {
          edit.word = currentItem.word;
        }
        if (currentItem.meaning.trim() !== item.meaning.trim()) {
          edit.meaning = currentItem.meaning;
        }
        if (Object.keys(edit).length > 1) {
          edits.push(edit);
        }
      }
      current.delete(item.itemId);
    });
    current.forEach(function (item, itemId) {
      edits.push({
        itemId: itemId,
        mark: item.mark || "wrong",
        word: item.word,
        meaning: item.meaning
      });
    });
    analysis.clientRequestId = analysis.clientRequestId || window.crypto.randomUUID();
    var override = overrideReason ? { reason: overrideReason } : undefined;
    if (override && Number.isInteger(saveOptions.deductionHalf)) {
      override.deductionHalf = saveOptions.deductionHalf;
    }
    return this.request("/attempts", {
      method: "POST",
      body: {
        draftId: analysis.draftId,
        edits: edits,
        override: override,
        batchSessionId: analysis.batchSessionId || undefined,
        takenOn: analysis.detectedDate,
        attemptLabel: analysis.attemptLabel || undefined,
        onDuplicate: saveOptions.onDuplicate || undefined,
        clientRequestId: analysis.clientRequestId
      }
    });
  };

  RealAdapter.prototype.saveRetestResult = function (studentId, results) {
    return this.request("/students/" + encodeURIComponent(studentId) + "/retests", {
      method: "POST",
      body: { results: results.map(function (result) { return { wordId: result.wordId, correct: result.correct }; }) }
    });
  };

  RealAdapter.prototype.registerTest = function (testInput) {
    return this.request("/tests", {
      method: "POST",
      body: {
        title: testInput.title,
        words: testInput.words,
        formHint: testInput.formHint || "other"
      }
    });
  };

  RealAdapter.prototype.regeneratePin = async function (studentId) {
    var payload = await this.request("/students/" + encodeURIComponent(studentId) + "/pin", {
      method: "POST",
      body: {}
    });
    return payload.pin;
  };

  RealAdapter.prototype.changePassword = function (passwordInput) {
    return this.request("/auth/password", {
      method: "POST",
      body: {
        currentPassword: passwordInput.currentPassword,
        newPassword: passwordInput.newPassword
      }
    });
  };

  window.RewordAdapters = {
    DataAdapter: DataAdapter,
    MockAdapter: MockAdapter,
    RealAdapter: RealAdapter,
    storageKeys: { schema: SCHEMA_KEY, state: STATE_KEY }
  };
}());
