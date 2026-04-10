/**
 * Virtual Joystick for mobile responsiveness.
 * Simulates WASD keys for the custom-movement component.
 */
class VirtualJoystick {
  constructor() {
    this.container = null;
    this.stick = null;
    this.active = false;
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
    this.overrideMovement();
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
    e.preventDefault();
    e.stopPropagation();
    this.active = false;
    this.stick.style.transition = "transform 0.2s ease-out";
    this.stick.style.transform = `translate(0px, 0px)`;

    // Reset keys
    this.keys = { w: false, a: false, s: false, d: false };
    this.updateMovementKeys();
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
