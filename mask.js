(function (root) {
  "use strict";

  var PRESETS = {
    // Upright page-relative boxes measured from the masked real-sheet fixtures.
    jihye: { x: 0.60, y: 0.146, width: 0.275, height: 0.054 },
    "netutor-unit": { x: 0.49, y: 0.174, width: 0.155, height: 0.054 },
    "netutor-wizard": { x: 0.65, y: 0.20, width: 0.21, height: 0.041 },
    other: { x: 0.60, y: 0.13, width: 0.28, height: 0.07 }
  };

  function rotation(value) {
    return ((Number(value) || 0) % 360 + 360) % 360;
  }

  function copyRect(rect) {
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  function presetRect(name) {
    var key = name === "netutor" ? "netutor-unit" : name;
    return copyRect(PRESETS[key] || PRESETS.other);
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

  root.RewordMask = {
    presets: PRESETS,
    presetRect: presetRect,
    transformRect: transformRect,
    toUprightRect: toUprightRect,
    clampRect: clampRect,
    applyMask: applyMask
  };
}(typeof window === "undefined" ? globalThis : window));
