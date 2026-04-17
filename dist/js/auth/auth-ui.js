// Authentication UI components and handlers

let authModalOpen = false;

/**
 * Show authentication modal
 * @param {Function} onSuccess - Callback when auth succeeds
 */
function showAuthModal(onSuccess) {
  const modal = document.getElementById("auth-modal");
  if (modal) {
    modal.style.display = "flex";
    authModalOpen = true;

    // Disable camera look controls
    disableCameraControls();

    // Focus on email input
    setTimeout(() => {
      const emailInput = document.getElementById("auth-email");
      if (emailInput) {
        emailInput.focus();
      }
    }, 100);
  }
}

/**
 * Hide authentication modal
 */
function hideAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) {
    modal.style.display = "none";
    authModalOpen = false;
    // Clear form
    document.getElementById("auth-email").value = "";
    document.getElementById("auth-password").value = "";
    const confirmInput = document.getElementById("auth-confirm-password");
    if (confirmInput) confirmInput.value = "";
    document.getElementById("auth-error").textContent = "";
    document.getElementById("auth-success").textContent = "";
    // Reset to sign-in mode
    const title = document.getElementById("auth-modal-title");
    const submitBtn = document.getElementById("auth-submit-btn");
    const switchBtn = document.getElementById("auth-switch-btn");
    const switchText = document.getElementById("auth-switch-text");
    const confirmGroup = document.getElementById("auth-confirm-group");
    modal.dataset.mode = "signin";
    if (title) title.textContent = "Sign In";
    if (submitBtn) {
      submitBtn.textContent = "Sign In";
      submitBtn.disabled = false;
    }
    if (switchBtn) switchBtn.textContent = "Sign Up";
    if (switchText) switchText.textContent = "Don't have an account?";
    if (confirmGroup) confirmGroup.style.display = "none";

    // Re-enable camera look controls
    enableCameraControls();
  }
}

/**
 * Switch between sign in and sign up views
 */
function switchAuthMode() {
  const isSignUp =
    document.getElementById("auth-modal").dataset.mode === "signup";
  const modal = document.getElementById("auth-modal");
  const title = document.getElementById("auth-modal-title");
  const submitBtn = document.getElementById("auth-submit-btn");
  const switchBtn = document.getElementById("auth-switch-btn");
  const switchText = document.getElementById("auth-switch-text");
  const confirmGroup = document.getElementById("auth-confirm-group");
  if (isSignUp) {
    // Switch to sign in
    modal.dataset.mode = "signin";
    title.textContent = "Sign In";
    submitBtn.textContent = "Sign In";
    switchBtn.textContent = "Sign Up";
    switchText.textContent = "Don't have an account?";
    if (confirmGroup) confirmGroup.style.display = "none";
  } else {
    // Switch to sign up
    modal.dataset.mode = "signup";
    title.textContent = "Sign Up";
    submitBtn.textContent = "Sign Up";
    switchBtn.textContent = "Sign In";
    switchText.textContent = "Already have an account?";
    if (confirmGroup) confirmGroup.style.display = "block";
  }

  // Clear error messages
  document.getElementById("auth-error").textContent = "";
  document.getElementById("auth-success").textContent = "";
}

/**
 * Handle authentication form submission
 */
async function handleAuthSubmit() {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const confirmPasswordInput = document.getElementById("auth-confirm-password");
  const errorEl = document.getElementById("auth-error");
  const successEl = document.getElementById("auth-success");
  const submitBtn = document.getElementById("auth-submit-btn");
  const isSignUp =
    document.getElementById("auth-modal").dataset.mode === "signup";

  // Clear previous messages
  errorEl.textContent = "";
  successEl.textContent = "";

  // Validation
  if (!email || !password) {
    errorEl.textContent = "Please enter both email and password";
    return;
  }

  if (password.length < 6) {
    errorEl.textContent = "Password must be at least 6 characters";
    return;
  }

  if (isSignUp) {
    const confirmPassword = confirmPasswordInput
      ? confirmPasswordInput.value
      : "";
    if (password !== confirmPassword) {
      errorEl.textContent = "Passwords do not match";
      return;
    }
  }

  // Disable button during request
  submitBtn.disabled = true;
  submitBtn.textContent = isSignUp ? "Signing Up..." : "Signing In...";

  try {
    let result;
    if (isSignUp) {
      result = await signUp(email, password);
    } else {
      result = await signIn(email, password);
    }

    if (result.success) {
      if (isSignUp && result.data && result.data.user && !result.data.session) {
        // Email confirmation required
        successEl.textContent =
          "Account created! Check your email to confirm, then sign in.";
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign Up";
        // Auto-switch to sign in mode after a moment
        setTimeout(() => {
          switchAuthMode();
        }, 3000);
      } else {
        successEl.textContent = isSignUp
          ? "Account created successfully!"
          : "Signed in successfully!";

        setTimeout(() => {
          hideAuthModal();
          // Refresh auth state
          if (typeof updateAuthUI === "function") updateAuthUI();
        }, 1200);
      }
    } else {
      errorEl.textContent = result.error || "Authentication failed";
      submitBtn.disabled = false;
      submitBtn.textContent = isSignUp ? "Sign Up" : "Sign In";
    }
  } catch (error) {
    errorEl.textContent = "An error occurred. Please try again.";
    submitBtn.disabled = false;
    submitBtn.textContent = isSignUp ? "Sign Up" : "Sign In";
  }
}

/**
 * Update UI based on auth state
 */
async function updateAuthUI() {
  const isAuthenticated = await checkAuth();
  const user = await getCurrentUser();
  const costPanel = document.getElementById("cost-panel");

  // Cost panel is now always visible, regardless of authentication status
  if (costPanel) {
    costPanel.classList.remove("hidden");
  }

  if (typeof updateProfileMenu === "function") {
    await updateProfileMenu(isAuthenticated, user);
  }
}

/**
 * Initialize auth UI
 */
function initAuthUI() {
  // Update UI on page load
  updateAuthUI();

  // Listen for auth state changes
  onAuthStateChange((event, session) => {
    updateAuthUI();
    // Handle OAuth redirect — user just came back from Google
    if (event === "SIGNED_IN" && session) {
      // Ensure user profile exists in users table
      ensureUserProfile(session.user);
    }
  });

  // Close modal when clicking outside
  const modal = document.getElementById("auth-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hideAuthModal();
      }
    });
  }

  // Allow Enter key to submit form
  const emailInput = document.getElementById("auth-email");
  const passwordInput = document.getElementById("auth-password");
  const confirmPasswordInput = document.getElementById("auth-confirm-password");
  const authInputs = [emailInput, passwordInput, confirmPasswordInput].filter(
    Boolean,
  );
  if (authInputs.length) {
    authInputs.forEach((input) => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          handleAuthSubmit();
        }
      });

      // Stop propagation when input is focused to prevent movement
      input.addEventListener("keydown", (e) => {
        e.stopPropagation();
      });

      input.addEventListener("keyup", (e) => {
        e.stopPropagation();
      });
    });
  }
}

/**
 * Handle Google Sign In button click
 */
async function handleGoogleSignIn() {
  const errorEl = document.getElementById("auth-error");
  const googleBtn = document.getElementById("auth-google-btn");
  if (errorEl) errorEl.textContent = "";

  if (googleBtn) {
    googleBtn.disabled = true;
    googleBtn.textContent = "Redirecting...";
  }

  const result = await signInWithGoogle();

  if (!result.success) {
    if (errorEl) errorEl.textContent = result.error || "Google sign-in failed";
    if (googleBtn) {
      googleBtn.disabled = false;
      googleBtn.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Continue with Google';
    }
  }
  // If success, the browser will redirect to Google — no further action needed here
}

/**
 * Ensure user profile exists in the users table after OAuth sign-in
 * @param {Object} user - Supabase user object
 */
async function ensureUserProfile(user) {
  if (!user) return;
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    // Upsert: insert if not exists, ignore if already present
    const { error } = await supabase.from("users").upsert(
      {
        id: user.id,
        email: user.email,
        role: "user",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

    if (error && error.code !== "23505") {
      console.warn("[auth] Error ensuring user profile:", error);
    }
  } catch (e) {
    console.warn("[auth] Error ensuring user profile:", e);
  }
}

/**
 * Disable camera look controls when modal is open
 */
function disableCameraControls() {
  const camera = document.querySelector("a-camera");
  if (camera) {
    const lookControls = camera.getAttribute("look-controls");
    if (lookControls) {
      // Store original enabled state
      const wasEnabled =
        typeof lookControls === "object"
          ? lookControls.enabled !== false
          : lookControls !== "false" && lookControls !== false;

      camera.setAttribute(
        "data-original-look-enabled",
        wasEnabled ? "true" : "false",
      );
      // Disable look controls
      camera.setAttribute("look-controls", "enabled", false);
    }
  }
}

/**
 * Enable camera look controls when modal is closed
 */
function enableCameraControls() {
  const camera = document.querySelector("a-camera");
  if (camera) {
    const originalEnabled = camera.getAttribute("data-original-look-enabled");
    if (originalEnabled !== null) {
      // Restore original state
      const shouldEnable = originalEnabled === "true";
      camera.setAttribute("look-controls", "enabled", shouldEnable);
      camera.removeAttribute("data-original-look-enabled");
    } else {
      // Just re-enable if no original state stored (default behavior)
      camera.setAttribute("look-controls", "enabled", true);
    }
  }
}
