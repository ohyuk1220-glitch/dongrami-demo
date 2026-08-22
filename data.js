(function () {
  "use strict";

  var test1Words = [
    { word: "stand out", meaning: "두드러지다, 눈에 띄다" },
    { word: "anxiety", meaning: "불안, 걱정" },
    { word: "give up", meaning: "포기하다, 단념하다" },
    { word: "imagination", meaning: "상상력" },
    { word: "recent", meaning: "최근의" },
    { word: "come to mind", meaning: "생각이 나다, 떠오르다" },
    { word: "apologize", meaning: "사과하다" },
    { word: "achieve", meaning: "달성하다, 이루다" },
    { word: "adventure", meaning: "모험" },
    { word: "ancient", meaning: "고대의" },
    { word: "attention", meaning: "주의, 관심" },
    { word: "breathe", meaning: "숨 쉬다" },
    { word: "celebrate", meaning: "축하하다" },
    { word: "communicate", meaning: "의사소통하다" },
    { word: "compare", meaning: "비교하다" },
    { word: "confident", meaning: "자신감 있는" },
    { word: "discover", meaning: "발견하다" },
    { word: "environment", meaning: "환경" },
    { word: "experience", meaning: "경험" },
    { word: "familiar", meaning: "익숙한" },
    { word: "improve", meaning: "향상시키다" },
    { word: "include", meaning: "포함하다" },
    { word: "independent", meaning: "독립적인" },
    { word: "necessary", meaning: "필요한" },
    { word: "opportunity", meaning: "기회" },
    { word: "prepare", meaning: "준비하다" },
    { word: "protect", meaning: "보호하다" },
    { word: "responsible", meaning: "책임감 있는" },
    { word: "solution", meaning: "해결책" },
    { word: "wonder", meaning: "궁금해하다" }
  ];

  var test2Words = [
    { word: "accept", meaning: "받아들이다" },
    { word: "borrow", meaning: "빌리다" },
    { word: "challenge", meaning: "도전" },
    { word: "decide", meaning: "결정하다" },
    { word: "effort", meaning: "노력" },
    { word: "favorite", meaning: "가장 좋아하는" },
    { word: "generous", meaning: "관대한" },
    { word: "habit", meaning: "습관" },
    { word: "invite", meaning: "초대하다" },
    { word: "journey", meaning: "여행" },
    { word: "knowledge", meaning: "지식" },
    { word: "local", meaning: "지역의" },
    { word: "manage", meaning: "관리하다, 해내다" },
    { word: "notice", meaning: "알아차리다" },
    { word: "ordinary", meaning: "평범한" },
    { word: "patient", meaning: "참을성 있는" },
    { word: "quality", meaning: "품질" },
    { word: "respect", meaning: "존중하다" },
    { word: "sudden", meaning: "갑작스러운" },
    { word: "tradition", meaning: "전통" },
    { word: "useful", meaning: "유용한" },
    { word: "various", meaning: "다양한" },
    { word: "waste", meaning: "낭비하다" },
    { word: "youth", meaning: "젊음, 청소년" },
    { word: "balance", meaning: "균형" },
    { word: "curious", meaning: "호기심 많은" },
    { word: "describe", meaning: "묘사하다" },
    { word: "encourage", meaning: "격려하다" },
    { word: "honest", meaning: "정직한" },
    { word: "memory", meaning: "기억" }
  ];

  function wordRecord(id, word, meaning, sourceTestId, status, consecutiveCorrect, addedAt) {
    return {
      id: id,
      word: word,
      meaning: meaning,
      sourceTestId: sourceTestId,
      status: status,
      consecutiveCorrect: consecutiveCorrect,
      addedAt: addedAt
    };
  }

  window.RewordData = {
    schemaVersion: 1,
    students: [
      { id: "student-minjun", nickname: "민준", pin: "1234", grade: "초5" },
      { id: "student-seoyeon", nickname: "서연", pin: "5678", grade: "초6" },
      { id: "student-haeun", nickname: "하은", pin: "2468", grade: "중1" }
    ],
    consents: {
      "student-seoyeon": "2026-08-20T01:00:00.000Z",
      "student-haeun": "2026-08-20T01:05:00.000Z"
    },
    // 데모용 비밀번호입니다. 실서비스에서 교체하세요.
    teacherPassword: "jihye2026!",
    tests: [
      {
        id: "VOCA-D0304",
        title: "주니어 능률 VOCA 실력 DAY 03-04",
        version: 1,
        totalQuestions: 30,
        words: test1Words
      },
      {
        id: "VOCA-D0506",
        title: "주니어 능률 VOCA 실력 DAY 05-06",
        version: 1,
        totalQuestions: 30,
        words: test2Words
      }
    ],
    histories: {
      "student-minjun": [
        { id: "history-minjun-1", testId: "VOCA-D0304", score: 23, total: 30, date: "2026-08-13" }
      ],
      "student-seoyeon": [
        { id: "history-seoyeon-1", testId: "VOCA-D0304", score: 27, total: 30, date: "2026-08-12" }
      ],
      "student-haeun": [
        { id: "history-haeun-1", testId: "VOCA-D0304", score: 19, total: 30, date: "2026-08-06" },
        { id: "history-haeun-2", testId: "VOCA-D0506", score: 25, total: 30, date: "2026-08-15" }
      ]
    },
    wordbooks: {
      "student-minjun": [
        wordRecord("mw-1", "stand out", "두드러지다, 눈에 띄다", "VOCA-D0304", "learning", 1, "2026-08-13"),
        wordRecord("mw-2", "anxiety", "불안, 걱정", "VOCA-D0304", "learning", 0, "2026-08-13"),
        wordRecord("mw-3", "give up", "포기하다, 단념하다", "VOCA-D0304", "learning", 0, "2026-08-13"),
        wordRecord("mw-4", "imagination", "상상력", "VOCA-D0304", "learning", 1, "2026-08-13"),
        wordRecord("mw-5", "recent", "최근의", "VOCA-D0304", "learning", 0, "2026-08-13"),
        wordRecord("mw-6", "achieve", "달성하다, 이루다", "VOCA-D0304", "graduated", 2, "2026-08-08")
      ],
      "student-seoyeon": [
        wordRecord("sw-1", "come to mind", "생각이 나다, 떠오르다", "VOCA-D0304", "learning", 1, "2026-08-12"),
        wordRecord("sw-2", "apologize", "사과하다", "VOCA-D0304", "learning", 0, "2026-08-12"),
        wordRecord("sw-3", "attention", "주의, 관심", "VOCA-D0304", "learning", 1, "2026-08-12"),
        wordRecord("sw-4", "confident", "자신감 있는", "VOCA-D0304", "learning", 0, "2026-08-12"),
        wordRecord("sw-5", "discover", "발견하다", "VOCA-D0304", "graduated", 2, "2026-08-10")
      ],
      "student-haeun": [
        wordRecord("hw-1", "accept", "받아들이다", "VOCA-D0506", "learning", 1, "2026-08-15"),
        wordRecord("hw-2", "challenge", "도전", "VOCA-D0506", "learning", 0, "2026-08-15"),
        wordRecord("hw-3", "effort", "노력", "VOCA-D0506", "learning", 1, "2026-08-15"),
        wordRecord("hw-4", "generous", "관대한", "VOCA-D0506", "learning", 0, "2026-08-15"),
        wordRecord("hw-5", "habit", "습관", "VOCA-D0506", "learning", 0, "2026-08-15"),
        wordRecord("hw-6", "patient", "참을성 있는", "VOCA-D0506", "graduated", 2, "2026-08-11"),
        wordRecord("hw-7", "respect", "존중하다", "VOCA-D0506", "graduated", 2, "2026-08-14")
      ]
    }
  };
}());
