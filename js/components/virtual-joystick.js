/**
 * Virtual Joystick for mobile responsiveness.
 * Simulates WASD keys for the custom-movement component.
 */
class VirtualJoystick {
  constructor() {
    this.container = null;
    this.stick = null;
    this.active = false;
    this.isHiddenByConflict = false;
    this.visibilityRaf = null;
    this.conflictObserver = null;
    this.basePosition = { x: 0, y: 0 };
    this.stickPosition = { x: 0, y: 0 };
    this.maxRadius = 40; // Max distance the stick can move

    // To feed info into the movement component
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
    };

    this.init();
  }

  init() {
    // Enable joystick on true touch devices, coarse-pointer devices,
    // and small viewports (covers Chrome DevTools mobile emulation).
    const hasTouch =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0;
    const hasCoarsePointer =
      typeof window.matchMedia === "function" &&
      (window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(any-pointer: coarse)").matches);
    const isSmallViewport =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 1024px)").matches
        : window.innerWidth <= 1024;

    if (!hasTouch && !hasCoarsePointer && !isSmallViewport) {
      return;
    }

    this.container = document.createElement("div");
    this.container.id = "virtual-joystick-base";
    Object.assign(this.container.style, {
      position: "fixed",
      bottom: "120px",
      left: "30px",
      width: "100px",
      height: "100px",
      borderRadius: "50%",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      border: "2px solid rgba(255, 255, 255, 0.5)",
      zIndex: "1700",
      touchAction: "none",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      pointerEvents: "auto",
      opacity: "1",
      transition: "opacity 0.18s ease",
    });

    this.stick = document.createElement("div");
    this.stick.id = "virtual-joystick-stick";
    Object.assign(this.stick.style, {
      width: "50px",
      height: "50px",
      borderRadius: "50%",
      backgroundColor: "rgba(255, 255, 255, 0.7)",
      position: "absolute",
      transform: "translate(0px, 0px)",
      boxShadow: "0 0 10px rgba(0,0,0,0.5)",
      transition: "transform 0.1s ease-out",
    });

    this.container.appendChild(this.stick);
    document.body.appendChild(this.container);

    this.attachEvents();
    this.setupConflictAwareVisibility();
    if (typeof this.overrideMovement === "function") {
      this.overrideMovement();
    }
  }

  attachEvents() {
    this.container.addEventListener("touchstart", this.handleStart.bind(this), {
      passive: false,
    });
    this.container.addEventListener("touchmove", this.handleMove.bind(this), {
      passive: false,
    });
    this.container.addEventListener("touchend", this.handleEnd.bind(this), {
      passive: false,
    });
    this.container.addEventListener("touchcancel", this.handleEnd.bind(this), {
      passive: false,
    });

    // Mouse fallback
    this.container.addEventListener(
      "mousedown",
      this.handleMouseDown.bind(this),
    );
    window.addEventListener("mousemove", this.handleMouseMove.bind(this));
    window.addEventListener("mouseup", this.handleMouseUp.bind(this));
  }

  handleMouseDown(e) {
    if (this.isHiddenByConflict) return;
    if (e.target !== this.container && e.target !== this.stick) return;
    e.preventDefault();
    e.stopPropagation();
    this.active = true;
    this.stick.style.transition = "none";
    const rect = this.container.getBoundingClientRect();
    this.basePosition = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    this.updateStick(e.clientX, e.clientY);
  }

  handleMouseMove(e) {
    if (!this.active) return;
    e.preventDefault();
    e.stopPropagation();
    this.updateStick(e.clientX, e.clientY);
  }

  handleMouseUp(e) {
    if (!this.active) return;
    this.handleEnd(e);
  }

  handleStart(e) {
    if (this.isHiddenByConflict) return;
    e.preventDefault();
    e.stopPropagation();
    this.active = true;
    this.stick.style.transition = "none"; // remove transition for direct control
    const touch = e.changedTouches[0];
    const rect = this.container.getBoundingClientRect();
    this.basePosition = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    this.updateStick(touch.clientX, touch.clientY);
  }

  handleMove(e) {
    if (!this.active) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.changedTouches[0];
    this.updateStick(touch.clientX, touch.clientY);
  }

  handleEnd(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.active = false;
    this.stick.style.transition = "transform 0.2s ease-out";
    this.stick.style.transform = `translate(0px, 0px)`;

    // Reset keys
    this.keys = { w: false, a: false, s: false, d: false };
    this.updateMovementKeys();
  }

  setupConflictAwareVisibility() {
    this.scheduleVisibilityCheck();

    const boundCheck = this.scheduleVisibilityCheck.bind(this);
    window.addEventListener("resize", boundCheck);
    window.addEventListener("orientationchange", boundCheck);

    if (typeof MutationObserver === "function") {
      this.conflictObserver = new MutationObserver(() => {
        this.scheduleVisibilityCheck();
      });
      this.conflictObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "style"],
        childList: true,
        subtree: true,
      });
    }
  }

  scheduleVisibilityCheck() {
    if (this.visibilityRaf) return;
    this.visibilityRaf = window.requestAnimationFrame(() => {
      this.visibilityRaf = null;
      this.updateVisibilityFromConflicts();
    });
  }

  updateVisibilityFromConflicts() {
    if (!this.container) return;

    const sidePanel = document.getElementById("side-panel");
    const resizePanel = document.getElementById("resize-dimension-panel");
    const sourcesPanel = document.getElementById("sources-panel");
    const controlPanel = document.getElementById("furniture-control-panel");
    const costPanel = document.getElementById("cost-panel");

    const sidePanelOpen = !!sidePanel && sidePanel.classList.contains("open");
    const resizePanelOpen =
      !!resizePanel && resizePanel.classList.contains("open");
    const sourcesPanelOpen =
      !!sourcesPanel && sourcesPanel.classList.contains("open");
    const controlPanelVisible = this.isVisibleElement(controlPanel);
    const costPanelExpanded =
      this.isVisibleElement(costPanel) &&
      !costPanel.classList.contains("collapsed");

    // State-driven rule is more reliable than overlap math for sliding panels.
    const hasConflict =
      sidePanelOpen ||
      resizePanelOpen ||
      sourcesPanelOpen ||
      controlPanelVisible ||
      costPanelExpanded;

    if (hasConflict === this.isHiddenByConflict) return;

    this.isHiddenByConflict = hasConflict;
    this.container.style.opacity = hasConflict ? "0" : "1";
    this.container.style.pointerEvents = hasConflict ? "none" : "auto";

    // Prevent stuck movement if UI pops over the joystick mid-drag.
    if (hasConflict && this.active) {
      this.handleEnd();
    }
  }

  isVisibleElement(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    if (parseFloat(style.opacity || "1") <= 0.01) {
      return false;
    }

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  isElementOnScreen(el) {
    if (!this.isVisibleElement(el)) return false;
    const rect = el.getBoundingClientRect();
    return (
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.top < window.innerHeight
    );
  }

  updateStick(clientX, clientY) {
    let dx = clientX - this.basePosition.x;
    let dy = clientY - this.basePosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > this.maxRadius) {
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * this.maxRadius;
      dy = Math.sin(angle) * this.maxRadius;
    }

    this.stick.style.transform = `translate(${dx}px, ${dy}px)`;

    // Map output to WASD keys
    const threshold = this.maxRadius * 0.3; // Minimum distance to trigger key
    this.keys.w = dy < -threshold;
    this.keys.s = dy > threshold;
    this.keys.a = dx < -threshold;
    this.keys.d = dx > threshold;

    this.updateMovementKeys();
  }

  updateMovementKeys() {
    // We hook into the custom-movement component to feed the keys
    const cameraRig = document.querySelector("[custom-movement]");
    if (cameraRig && cameraRig.components["custom-movement"]) {
      const movementComp = cameraRig.components["custom-movement"];
      // Merge our virtual keys with their physical keys state
      Object.keys(this.keys).forEach((k) => {
        movementComp.keys[k] = this.keys[k];
      });
    }
  }
}

// Make sure it initializes when the document is ready
document.addEventListener("DOMContentLoaded", () => {
  window.virtualJoystick = new VirtualJoystick();
});
