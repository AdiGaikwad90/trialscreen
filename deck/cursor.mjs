/**
 * Playwright's screencast does not draw the mouse pointer, so a recorded demo
 * shows things happening with nothing causing them. This injects a pointer into
 * the page that follows the real mouse events Playwright dispatches, plus a
 * ring on click, so the recording reads as a person using the product.
 */
export const CURSOR_SCRIPT = `
(() => {
  if (window.__cursorInstalled) return;
  window.__cursorInstalled = true;

  const install = () => {
    const wrap = document.createElement("div");
    wrap.id = "__cursor";
    wrap.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 26 26">' +
      '<path d="M5 2 L5 19.5 L9.7 15.3 L12.6 22.2 L15.9 20.8 L13 14 L19.4 13.6 Z"' +
      ' fill="#ffffff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    Object.assign(wrap.style, {
      position: "fixed", top: "0", left: "0", zIndex: "2147483647",
      pointerEvents: "none", willChange: "transform",
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,.35))",
      transform: "translate(-100px,-100px)",
      transition: "transform 40ms linear",
    });
    document.documentElement.append(wrap);

    let x = -100, y = -100;
    addEventListener("mousemove", (e) => {
      x = e.clientX; y = e.clientY;
      wrap.style.transform = \`translate(\${x}px, \${y}px)\`;
    }, true);

    // A ring that expands and fades, so a click is visible as an action.
    addEventListener("mousedown", () => {
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed", left: x + "px", top: y + "px", zIndex: "2147483646",
        width: "14px", height: "14px", marginLeft: "-7px", marginTop: "-7px",
        borderRadius: "50%", border: "2px solid rgba(74,44,107,.9)",
        pointerEvents: "none",
      });
      document.documentElement.append(ring);
      ring.animate(
        [
          { transform: "scale(1)", opacity: 1 },
          { transform: "scale(3.4)", opacity: 0 },
        ],
        { duration: 520, easing: "cubic-bezier(.2,.7,.3,1)" },
      ).onfinish = () => ring.remove();
    }, true);
  };

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", install)
    : install();
})();
`;
