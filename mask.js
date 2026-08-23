(function (root) {
  "use strict";

  // API 설정을 못 받는 MockAdapter/오프라인 모드용 세 measured presets + generic fallback.
  var FALLBACK_PRESETS = [
    { id: "jihye", label: "지혜의영어 양식", box: { x: 0.60, y: 0.146, w: 0.275, h: 0.054 } },
    { id: "netutor-unit", label: "NE Tutor DATE/NAME 헤더", box: { x: 0.49, y: 0.174, w: 0.155, h: 0.054 } },
    { id: "netutor-wizard", label: "NE Tutor 이름: 칸", box: { x: 0.65, y: 0.20, w: 0.21, h: 0.041 } },
    { id: "other", label: "기타 양식", box: { x: 0.60, y: 0.13, w: 0.28, h: 0.07 } }
  ];
  var PRESETS = {};
  var LABELS = {};

  function rotation(value) {
    return ((Number(value) || 0) % 360 + 360) % 360;
  }

  function copyRect(rect) {
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  function normalizedPreset(preset) {
    var box = preset && preset.box;
    if (!preset || typeof preset.id !== "string" || typeof preset.label !== "string" || !box) {
      return null;
    }
    var values = [box.x, box.y, box.w, box.h];
    if (!values.every(function (value) { return typeof value === "number" && isFinite(value); })) {
      return null;
    }
    return {
      id: preset.id,
      label: preset.label,
      rect: clampRect({ x: box.x, y: box.y, width: box.w, height: box.h })
    };
  }

  function setPresets(value) {
    var source = Array.isArray(value) && value.length ? value : FALLBACK_PRESETS;
    var normalized = source.map(normalizedPreset).filter(Boolean);
    if (!normalized.length) {
      normalized = FALLBACK_PRESETS.map(normalizedPreset);
    }
    Object.keys(PRESETS).forEach(function (id) { delete PRESETS[id]; });
    Object.keys(LABELS).forEach(function (id) { delete LABELS[id]; });
    normalized.forEach(function (preset) {
      PRESETS[preset.id] = preset.rect;
      LABELS[preset.id] = preset.label;
    });
  }

  function listPresets() {
    return Object.keys(PRESETS).map(function (id) {
      var rect = PRESETS[id];
      return {
        id: id,
        label: LABELS[id],
        box: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
      };
    });
  }

  function learnPreset(id, rect) {
    if (PRESETS[id] && rect) {
      PRESETS[id] = clampRect(rect);
    }
  }

  function presetRect(name) {
    var key = name === "netutor" ? "netutor-unit" : name;
    return copyRect(PRESETS[key] || PRESETS.other || PRESETS[Object.keys(PRESETS)[0]]);
  }

  function transformRect(rect, degrees) {
    switch (rotation(degrees)) {
      case 90:
        return { x: 1 - rect.y - rect.height, y: rect.x, width: rect.height, height: rect.width };
      case 180:
        return { x: 1 - rect.x - rect.width, y: 1 - rect.y - rect.height, width: rect.width, height: rect.height };
      case 270:
        return { x: rect.y, y: 1 - rect.x - rect.width, width: rect.height, height: rect.width };
      default:
        return copyRect(rect);
    }
  }

  function toUprightRect(displayRect, degrees) {
    return transformRect(displayRect, 360 - rotation(degrees));
  }

  function clampRect(rect, minimumSize) {
    var minimum = minimumSize || 0.025;
    var width = Math.max(minimum, Math.min(1, rect.width));
    var height = Math.max(minimum, Math.min(1, rect.height));
    return {
      x: Math.max(0, Math.min(1 - width, rect.x)),
      y: Math.max(0, Math.min(1 - height, rect.y)),
      width: width,
      height: height
    };
  }

  function applyMask(context, canvas, uprightRect, _imageDegrees, editorDecoration) {
    // Presets and edits already use the final upright canvas coordinate system.
    // Image rotation is applied while drawing the bitmap and must not rotate this box again.
    var rect = copyRect(uprightRect);
    var x = rect.x * canvas.width;
    var y = rect.y * canvas.height;
    var width = rect.width * canvas.width;
    var height = rect.height * canvas.height;
    context.fillStyle = "#000";
    context.fillRect(x, y, width, height);
    if (editorDecoration) {
      context.strokeStyle = "#fff";
      context.lineWidth = Math.max(2, canvas.width / 500);
      if (context.setLineDash) {
        context.setLineDash([8, 6]);
      }
      context.strokeRect(x, y, width, height);
      if (context.setLineDash) {
        context.setLineDash([]);
      }
      var handle = Math.max(8, Math.min(canvas.width, canvas.height) * 0.018);
      context.fillStyle = "#fff";
      context.fillRect(x + width - handle, y + height - handle, handle, handle);
      context.strokeStyle = "#000";
      context.strokeRect(x + width - handle, y + height - handle, handle, handle);
    }
    return rect;
  }

  setPresets();

  root.RewordMask = {
    presets: PRESETS,
    setPresets: setPresets,
    listPresets: listPresets,
    learnPreset: learnPreset,
    presetRect: presetRect,
    transformRect: transformRect,
    toUprightRect: toUprightRect,
    clampRect: clampRect,
    applyMask: applyMask
  };
}(typeof window === "undefined" ? globalThis : window));
