// Profile Menu Component

/**
 * Get initials from email (first 2 letters)
 * @param {string} email - User email
 * @returns {string} - 2-letter initials
 */
function getInitials(email) {
  if (!email) return "U";
  const parts = email.split("@")[0];
  if (parts.length >= 2) {
    return parts.substring(0, 2).toUpperCase();
  }
  return (
    parts.charAt(0).toUpperCase() +
    (parts.charAt(1) || parts.charAt(0)).toUpperCase()
  );
}

/** Track auth state for profile click handler */
let _profileAuthenticated = false;
const DASHBOARD_MODAL_ROUTES = {
  profile: "profile.html",
  admin: "admin.html",
};

let _dashboardOverlayInitialized = false;
let _dashboardOverlayEls = null;
let _dashboardOverlayCloseTimer = null;
const _dashboardOverlayLoaded = {
  profile: false,
  admin: false,
};

const DASHBOARD_OVERLAY_CLOSE_MS = 260;

function initDashboardOverlay() {
  if (_dashboardOverlayInitialized) return;

  const overlay = document.getElementById("dashboard-overlay");
  const profileFrame = document.getElementById("dashboard-profile-frame");
  const adminFrame = document.getElementById("dashboard-admin-frame");
  const profileTab = document.getElementById("dashboard-overlay-profile-tab");
  const adminTab = document.getElementById("dashboard-overlay-admin-tab");
  const title = document.getElementById("dashboard-overlay-title");

  if (!overlay || !profileFrame || !adminFrame || !profileTab || !adminTab || !title) {
    return;
  }

  _dashboardOverlayEls = {
    overlay,
    profileFrame,
    adminFrame,
    profileTab,
    adminTab,
    title,
  };

  overlay.addEventListener("click", (e) => {
    if (e.target?.matches("[data-dashboard-close]")) {
      closeDashboardOverlay();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("open")) {
      closeDashboardOverlay();
    }
  });

  window.addEventListener("message", handleDashboardOverlayMessage);
  _dashboardOverlayInitialized = true;
}

function setDashboardFrameVisibility(view) {
  if (!_dashboardOverlayEls) return;

  const isProfile = view === "profile";
  _dashboardOverlayEls.profileFrame.classList.toggle("active", isProfile);
  _dashboardOverlayEls.adminFrame.classList.toggle("active", !isProfile);
  _dashboardOverlayEls.profileTab.classList.toggle("active", isProfile);
  _dashboardOverlayEls.adminTab.classList.toggle("active", !isProfile);
  _dashboardOverlayEls.title.textContent = isProfile
    ? "Profile Dashboard"
    : "Admin Dashboard";

  const frame = isProfile
    ? _dashboardOverlayEls.profileFrame
    : _dashboardOverlayEls.adminFrame;

  if (!_dashboardOverlayLoaded[view]) {
    frame.src = DASHBOARD_MODAL_ROUTES[view];
    _dashboardOverlayLoaded[view] = true;
  }
}

function openDashboardOverlay(view = "profile") {
  if (!_profileAuthenticated) {
    if (typeof showAuthModal === "function") {
      showAuthModal(() => {
        window.location.reload();
      });
    }
    return;
  }

  initDashboardOverlay();
  if (!_dashboardOverlayEls) return;

  const adminVisible = _dashboardOverlayEls.adminTab.style.display !== "none";
  const nextView = view === "admin" && !adminVisible ? "profile" : view;

  setDashboardFrameVisibility(nextView);
  if (_dashboardOverlayCloseTimer) {
    clearTimeout(_dashboardOverlayCloseTimer);
    _dashboardOverlayCloseTimer = null;
  }

  _dashboardOverlayEls.overlay.classList.add("is-visible");
  _dashboardOverlayEls.overlay.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    if (_dashboardOverlayEls?.overlay) {
      _dashboardOverlayEls.overlay.classList.add("open");
    }
  });

  document.body.classList.add("dashboard-modal-open");

  const dropdown = document.getElementById("profile-dropdown");
  if (dropdown) {
    dropdown.style.display = "none";
  }
  document.removeEventListener("click", closeProfileMenuOnOutsideClick);
}

function switchDashboardOverlayTab(view) {
  if (view !== "profile" && view !== "admin") return;
  if (!_dashboardOverlayEls) {
    initDashboardOverlay();
  }
  if (!_dashboardOverlayEls) return;

  if (view === "admin" && _dashboardOverlayEls.adminTab.style.display === "none") {
    return;
  }

  setDashboardFrameVisibility(view);
}

function closeDashboardOverlay() {
  if (!_dashboardOverlayEls) return;

  _dashboardOverlayEls.overlay.classList.remove("open");
  _dashboardOverlayEls.overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("dashboard-modal-open");

  if (_dashboardOverlayCloseTimer) {
    clearTimeout(_dashboardOverlayCloseTimer);
  }

  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  _dashboardOverlayCloseTimer = setTimeout(
    () => {
      if (_dashboardOverlayEls?.overlay) {
        _dashboardOverlayEls.overlay.classList.remove("is-visible");
      }
      _dashboardOverlayCloseTimer = null;
    },
    prefersReducedMotion ? 0 : DASHBOARD_OVERLAY_CLOSE_MS,
  );
}

function handleDashboardOverlayMessage(event) {
  if (event.origin !== window.location.origin) return;
  const messageType = event?.data?.type;

  if (messageType === "planner-dashboard-close") {
    closeDashboardOverlay();
  } else if (messageType === "planner-dashboard-signed-out") {
    closeDashboardOverlay();
    window.location.reload();
  } else if (messageType === "planner-dashboard-require-auth") {
    closeDashboardOverlay();
    if (typeof showAuthModal === "function") {
      showAuthModal(() => {
        window.location.reload();
      });
    }
  }
}

window.openDashboardOverlay = openDashboardOverlay;
window.closeDashboardOverlay = closeDashboardOverlay;
window.switchDashboardOverlayTab = switchDashboardOverlayTab;

/**
 * Handle profile circle click — opens auth modal when logged out,
 * toggles dropdown when logged in.
 */
function handleProfileClick() {
  if (_profileAuthenticated) {
    toggleProfileMenu();
  } else {
    if (typeof showAuthModal === "function") {
      showAuthModal(() => {
        window.location.reload();
      });
    }
  }
}

/**
 * Toggle profile dropdown menu
 */
function toggleProfileMenu() {
  const dropdown = document.getElementById("profile-dropdown");
  if (!dropdown) return;

  const isVisible = dropdown.style.display === "block";
  dropdown.style.display = isVisible ? "none" : "block";

  if (isVisible) {
    document.removeEventListener("click", closeProfileMenuOnOutsideClick);
  } else {
    // Close dropdown when clicking outside
    setTimeout(() => {
      document.addEventListener("click", closeProfileMenuOnOutsideClick);
    }, 0);
  }
}

/**
 * Close profile menu when clicking outside
 */
function closeProfileMenuOnOutsideClick(e) {
  const profileCircle = document.getElementById("profile-circle");
  const dropdown = document.getElementById("profile-dropdown");

  if (
    profileCircle &&
    dropdown &&
    !profileCircle.contains(e.target) &&
    !dropdown.contains(e.target)
  ) {
    dropdown.style.display = "none";
    document.removeEventListener("click", closeProfileMenuOnOutsideClick);
  }
}

/**
 * Update profile menu based on auth state
 * @param {boolean} isAuthenticated - Whether user is authenticated
 * @param {Object} user - User object
 */
async function updateProfileMenu(isAuthenticated, user) {
  const profileCircle = document.getElementById("profile-circle");
  const profileInitials = document.getElementById("profile-initials");
  const dropdown = document.getElementById("profile-dropdown");
  const profileEmail = document.getElementById("profile-user-email");
  const body = document.body;

  if (!profileCircle) return;

  // Always show the profile circle
  profileCircle.style.display = "flex";
  _profileAuthenticated = isAuthenticated;

  if (isAuthenticated && user) {
    profileCircle.classList.remove("logged-out");
    if (profileInitials) {
      profileInitials.textContent = getInitials(user.email);
    }
    if (profileEmail) {
      profileEmail.textContent = user.email;
    }
    if (body) {
      body.classList.add("profile-visible");
    }

    // Update admin dashboard link visibility
    const userIsAdmin = await isAdmin();
    const adminDashboardLink = document.getElementById("profile-admin-link");
    if (adminDashboardLink) {
      adminDashboardLink.style.display = userIsAdmin ? "block" : "none";
    }
    const adminDashboardTab = document.getElementById("dashboard-overlay-admin-tab");
    if (adminDashboardTab) {
      adminDashboardTab.style.display = userIsAdmin ? "" : "none";
    }
  } else {
    profileCircle.classList.add("logged-out");
    if (dropdown) {
      dropdown.style.display = "none";
    }
    document.removeEventListener("click", closeProfileMenuOnOutsideClick);
    if (body) {
      body.classList.remove("profile-visible");
    }
    if (profileEmail) {
      profileEmail.textContent = "Not signed in";
    }
    const adminDashboardTab = document.getElementById("dashboard-overlay-admin-tab");
    if (adminDashboardTab) {
      adminDashboardTab.style.display = "none";
    }
    closeDashboardOverlay();
  }
}

/**
 * Handle logout
 */
async function handleProfileLogout() {
  const result = await signOut();
  if (result.success) {
    window.location.reload();
  } else {
    if (typeof showDialog === "function") {
      showDialog("Error signing out: " + result.error, "Error");
    } else {
      alert("Error signing out: " + result.error);
    }
  }
}
