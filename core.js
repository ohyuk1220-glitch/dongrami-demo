(function () {
  "use strict";

  function gateCheck(total, score, foundCount) {
    var valid = Number.isInteger(total) && Number.isInteger(score) && Number.isInteger(foundCount) &&
      total >= 0 && score >= 0 && foundCount >= 0 && score <= total;

    if (!valid) {
      return { pass: false, expected: null };
    }

    return {
      pass: total - score === foundCount,
      expected: total - score
    };
  }

  function normalizeMeaning(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[()[\]{}]/g, ",")
      .replace(/[·/;、，]/g, ",")
      .replace(/[.!?]/g, "")
      .split(",")
      .map(function (part) {
        return part.replace(/\s+/g, "").trim();
      })
      .filter(Boolean)
      .filter(function (part, index, parts) {
        return parts.indexOf(part) === index;
      })
      .sort()
      .join(",");
  }

  function meaningParts(value) {
    var normalized = normalizeMeaning(value);
    return normalized ? normalized.split(",") : [];
  }

  function meaningsConflict(first, second) {
    var firstParts = meaningParts(first);
    var secondParts = meaningParts(second);

    if (!firstParts.length || !secondParts.length) {
      return true;
    }

    return firstParts.some(function (firstPart) {
      return secondParts.some(function (secondPart) {
        return firstPart === secondPart || firstPart.indexOf(secondPart) !== -1 || secondPart.indexOf(firstPart) !== -1;
      });
    });
  }

  function shuffled(items) {
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

  function buildQuiz(targetWords, allWords, count) {
    var safeTargets = Array.isArray(targetWords) ? targetWords.filter(function (item) {
      return item && typeof item.word === "string" && typeof item.meaning === "string";
    }) : [];
    var safeAllWords = Array.isArray(allWords) ? allWords.filter(function (item) {
      return item && typeof item.meaning === "string";
    }) : [];
    var requestedCount = Number.isInteger(count) && count > 0 ? count : safeTargets.length;

    return shuffled(safeTargets).slice(0, requestedCount).map(function (target, questionIndex) {
      var distractors = [];

      shuffled(safeAllWords).forEach(function (candidate) {
        var conflictsWithAnswer = meaningsConflict(target.meaning, candidate.meaning);
        var conflictsWithExisting = distractors.some(function (meaning) {
          return meaningsConflict(meaning, candidate.meaning);
        });

        if (!conflictsWithAnswer && !conflictsWithExisting && distractors.length < 3) {
          distractors.push(candidate.meaning);
        }
      });

      var baseQuestion = {
        id: target.id || "question-" + (questionIndex + 1),
        wordId: target.id || null,
        word: target.word,
        answer: target.meaning
      };

      if (distractors.length < 3) {
        baseQuestion.mode = "typing";
        baseQuestion.choices = [];
        return baseQuestion;
      }

      baseQuestion.mode = "choice";
      baseQuestion.choices = shuffled([target.meaning].concat(distractors));
      return baseQuestion;
    });
  }

  function applyRetestResult(word, correct) {
    var nextWord = Object.assign({}, word);
    var currentCount = Number.isInteger(nextWord.consecutiveCorrect) ? nextWord.consecutiveCorrect : 0;

    if (correct) {
      nextWord.consecutiveCorrect = Math.min(currentCount + 1, 2);
      if (nextWord.consecutiveCorrect >= 2) {
        nextWord.status = "graduated";
      }
    } else {
      nextWord.consecutiveCorrect = 0;
      if (nextWord.status !== "graduated") {
        nextWord.status = "learning";
      }
    }

    return nextWord;
  }

  function parseWordList(text) {
    var words = [];
    var errors = [];
    var lines = typeof text === "string" ? text.split(/\r?\n/) : [];

    lines.forEach(function (line, index) {
      var trimmed = line.trim();
      var match;

      if (!trimmed) {
        return;
      }

      match = trimmed.match(/^(.+?)\s*(?:\t+|\s+-\s+|[:：])\s*(.+)$/);
      if (!match || !match[1].trim() || !match[2].trim()) {
        errors.push(index + 1);
        return;
      }

      words.push({
        word: match[1].trim(),
        meaning: match[2].trim()
      });
    });

    return { words: words, errors: errors };
  }

  window.RewordCore = {
    gateCheck: gateCheck,
    buildQuiz: buildQuiz,
    applyRetestResult: applyRetestResult,
    parseWordList: parseWordList,
    normalizeMeaning: normalizeMeaning
  };
}());
