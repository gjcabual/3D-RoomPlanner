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
