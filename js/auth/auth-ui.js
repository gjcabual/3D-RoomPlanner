// Authentication UI components and handlers

let authModalOpen = false;

/**
 * Show authentication modal
 * @param {Function} onSuccess - Callback when auth succeeds
 */
function showAuthModal(onSuccess) {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.style.display = 'flex';
    authModalOpen = true;
    
    // Disable camera look controls
    disableCameraControls();
    
    // Focus on email input
    setTimeout(() => {
      const emailInput = document.getElementById('auth-email');
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
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.style.display = 'none';
    authModalOpen = false;
    // Clear form
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    const confirmPasswordInput = document.getElementById('auth-confirm-password');
    if (confirmPasswordInput) {
      confirmPasswordInput.value = '';
    }
    document.getElementById('auth-error').textContent = '';
    document.getElementById('auth-success').textContent = '';
    
    // Re-enable camera look controls
    enableCameraControls();
  }
}

/**
 * Switch between sign in and sign up views
 */
function switchAuthMode() {
  const isSignUp = document.getElementById('auth-modal').dataset.mode === 'signup';
  const modal = document.getElementById('auth-modal');
  const title = document.getElementById('auth-modal-title');
  const submitBtn = document.getElementById('auth-submit-btn');
  const switchBtn = document.getElementById('auth-switch-btn');
  const switchText = document.getElementById('auth-switch-text');
  const confirmPasswordGroup = document.getElementById('auth-confirm-password-group');
  const confirmPasswordInput = document.getElementById('auth-confirm-password');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  
  if (isSignUp) {
    // Switch to sign in
    modal.dataset.mode = 'signin';
    title.textContent = 'Sign In';
    submitBtn.textContent = 'Sign In';
    switchBtn.textContent = 'Sign Up';
    switchText.textContent = "Don't have an account?";
    // Hide confirm password field
    if (confirmPasswordGroup) {
      confirmPasswordGroup.style.display = 'none';
    }
    if (confirmPasswordInput) {
      confirmPasswordInput.required = false;
      confirmPasswordInput.value = '';
    }
  } else {
    // Switch to sign up
    modal.dataset.mode = 'signup';
    title.textContent = 'Sign Up';
    submitBtn.textContent = 'Sign Up';
    switchBtn.textContent = 'Sign In';
    switchText.textContent = 'Already have an account?';
    // Show confirm password field
    if (confirmPasswordGroup) {
      confirmPasswordGroup.style.display = 'block';
    }
    if (confirmPasswordInput) {
      confirmPasswordInput.required = true;
    }
    
    // Trigger real-time validation for existing values
    if (emailInput && emailInput.value) {
      validateEmailRealTime(emailInput.value);
    }
    if (passwordInput && passwordInput.value) {
      validatePasswordRealTime(passwordInput.value);
    }
    if (confirmPasswordInput && confirmPasswordInput.value) {
      validatePasswordMatchRealTime();
    }
  }

  // Clear error messages
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-success').textContent = '';
}

/**
 * Handle authentication form submission
 */
async function handleAuthSubmit() {
  const submitBtn = document.getElementById('auth-submit-btn');
  
  // Prevent multiple submissions
  if (submitBtn && submitBtn.disabled) {
    return;
  }
  
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const confirmPasswordInput = document.getElementById('auth-confirm-password');
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
  const errorEl = document.getElementById('auth-error');
  const successEl = document.getElementById('auth-success');
  const isSignUp = document.getElementById('auth-modal').dataset.mode === 'signup';

  // Clear previous messages
  errorEl.textContent = '';
  successEl.textContent = '';

  // Validation
  if (!email || !password) {
    errorEl.textContent = 'Please enter both email and password';
    return;
  }

  // Email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errorEl.textContent = 'Please enter a valid email address';
    return;
  }

  // Password regex validation (only for sign up)
  if (isSignUp) {
    // Minimum 8 characters, at least one uppercase, one lowercase, one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      errorEl.textContent = 'Password: 8+ chars, uppercase, lowercase, number';
      return;
    }
  } else {
    // For sign in, only check minimum length (6 characters as per Supabase default)
    if (password.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters';
      return;
    }
  }

  // Confirm password validation (only for sign up)
  if (isSignUp) {
    if (!confirmPassword) {
      errorEl.textContent = 'Please confirm your password';
      return;
    }
    
    if (password !== confirmPassword) {
      errorEl.textContent = 'Passwords do not match';
      return;
    }
  }

  // Disable button during request
  submitBtn.disabled = true;
  submitBtn.textContent = isSignUp ? 'Signing Up...' : 'Signing In...';

  try {
    let result;
    if (isSignUp) {
      result = await signUp(email, password);
    } else {
      result = await signIn(email, password);
    }

    if (result.success) {
      successEl.textContent = isSignUp 
        ? 'Account created! You can now save your room plan.' 
        : 'Signed in successfully!';
      
      // Auto-close only on successful sign in, not sign up
      if (!isSignUp) {
        setTimeout(() => {
          hideAuthModal();
        }, 1500);
      } else {
        // For sign up, clear passwords but keep modal open to let user sign in
        // Disable submit button to prevent accidental clicks during transition
        submitBtn.disabled = true;
        
        document.getElementById('auth-password').value = '';
        if (confirmPasswordInput) {
          confirmPasswordInput.value = '';
        }
        
        // Clear error messages
        errorEl.textContent = '';
        
        // Switch to sign in mode after delay (but don't auto-submit)
        setTimeout(() => {
          // Clear success message before switching
          successEl.textContent = '';
          switchAuthMode();
          // Re-enable submit button after switching modes (but don't auto-click)
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
        }, 2000);
      }
    } else {
      // Display error message (truncate only very long ones)
      let errorMsg = result.error || 'Authentication failed';
      
      // Map common error messages to shorter versions
      const errorMap = {
        'Invalid login credentials': 'Invalid email or password',
        'Email not confirmed': 'Please confirm your email first',
        'User already registered': 'Account already exists. Sign in instead.',
        'Password should be at least 6 characters': 'Password: 8+ chars, uppercase, lowercase, number'
      };
      
      // Use mapped error if available
      for (const [key, value] of Object.entries(errorMap)) {
        if (errorMsg.includes(key)) {
          errorMsg = value;
          break;
        }
      }
      
      // Only truncate if still too long
      if (errorMsg.length > 80) {
        errorMsg = errorMsg.substring(0, 77) + '...';
      }
      
      errorEl.textContent = errorMsg;
      submitBtn.disabled = false;
      submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
    }
  } catch (error) {
    errorEl.textContent = 'An error occurred. Please try again.';
    submitBtn.disabled = false;
    submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
  }
}

/**
 * Update UI based on auth state
 */
async function updateAuthUI() {
  const isAuthenticated = await checkAuth();
  const user = await getCurrentUser();
  const costPanel = document.getElementById('cost-panel');

  // Cost panel is now always visible, regardless of authentication status
  if (costPanel) {
    costPanel.classList.remove('hidden');
  }

  if (typeof updateProfileMenu === 'function') {
    await updateProfileMenu(isAuthenticated, user);
  }
}

/**
 * Real-time email validation
 */
function validateEmailRealTime(email) {
  const errorEl = document.getElementById('auth-error');
  const isSignUp = document.getElementById('auth-modal').dataset.mode === 'signup';
  
  // Only show validation errors during sign up
  if (!isSignUp) {
    return;
  }
  
  if (!email || email.trim() === '') {
    // Don't show error if field is empty and user hasn't tried to submit
    return;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    errorEl.textContent = 'Please enter a valid email address';
  } else {
    // Clear email error if valid, but keep other errors
    const currentError = errorEl.textContent;
    if (currentError === 'Please enter a valid email address') {
      errorEl.textContent = '';
      validatePasswordRealTime(document.getElementById('auth-password').value);
      validatePasswordMatchRealTime();
    }
  }
}

/**
 * Real-time password validation
 */
function validatePasswordRealTime(password) {
  const errorEl = document.getElementById('auth-error');
  const isSignUp = document.getElementById('auth-modal').dataset.mode === 'signup';
  
  // Only show validation errors during sign up
  if (!isSignUp) {
    return;
  }
  
  if (!password || password === '') {
    // Don't show error if field is empty and user hasn't tried to submit
    return;
  }
  
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    errorEl.textContent = 'Password: 8+ chars, uppercase, lowercase, number';
  } else {
    // Clear password error if valid
    const currentError = errorEl.textContent;
    if (currentError === 'Password: 8+ chars, uppercase, lowercase, number') {
      errorEl.textContent = '';
      validatePasswordMatchRealTime();
    }
  }
}

/**
 * Real-time password match validation
 */
function validatePasswordMatchRealTime() {
  const errorEl = document.getElementById('auth-error');
  const isSignUp = document.getElementById('auth-modal').dataset.mode === 'signup';
  const confirmPasswordGroup = document.getElementById('auth-confirm-password-group');
  
  // Only validate if in sign up mode and confirm password field is visible
  if (!isSignUp || !confirmPasswordGroup || confirmPasswordGroup.style.display === 'none') {
    return;
  }
  
  const password = document.getElementById('auth-password').value;
  const confirmPasswordInput = document.getElementById('auth-confirm-password');
  
  if (!confirmPasswordInput) return;
  
  const confirmPassword = confirmPasswordInput.value;
  
  // Don't show error if confirm password field is empty
  if (!confirmPassword || confirmPassword === '') {
    return;
  }
  
  // If password requirements aren't met yet, don't check match
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    return;
  }
  
  if (password !== confirmPassword) {
    errorEl.textContent = 'Passwords do not match';
  } else {
    // Clear password match error if passwords match
    const currentError = errorEl.textContent;
    if (currentError === 'Passwords do not match') {
      errorEl.textContent = '';
    }
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
  });

  // Don't close modal when clicking outside - only close with X button
  // Removed backdrop click handler

  // Get input elements
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const confirmPasswordInput = document.getElementById('auth-confirm-password');
  
  // Set up real-time validation for email (only for sign up)
  if (emailInput) {
    emailInput.addEventListener('input', (e) => {
      const isSignUp = document.getElementById('auth-modal').dataset.mode === 'signup';
      if (isSignUp) {
        validateEmailRealTime(e.target.value);
      }
    });
    
    emailInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAuthSubmit();
      }
    });
    
    emailInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    
    emailInput.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });
  }
  
  // Set up real-time validation for password (only for sign up)
  if (passwordInput) {
    passwordInput.addEventListener('input', (e) => {
      const isSignUp = document.getElementById('auth-modal').dataset.mode === 'signup';
      if (isSignUp) {
        validatePasswordRealTime(e.target.value);
        // Also check password match when password changes
        validatePasswordMatchRealTime();
      }
    });
    
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAuthSubmit();
      }
    });
    
    passwordInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    
    passwordInput.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });
  }
  
  // Set up real-time validation for confirm password
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', (e) => {
      validatePasswordMatchRealTime();
    });
    
    confirmPasswordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAuthSubmit();
      }
    });
    
    confirmPasswordInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    
    confirmPasswordInput.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });
  }
  
  // Set up submit button click handler (prevent double submissions)
  const submitBtn = document.getElementById('auth-submit-btn');
  if (submitBtn) {
    // Remove any existing onclick attribute to prevent double execution
    submitBtn.removeAttribute('onclick');
    
    // Add event listener with proper prevention
    submitBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Prevent if already processing
      if (this.disabled) {
        return false;
      }
      
      handleAuthSubmit();
      return false;
    });
  }
}

/**
 * Disable camera look controls when modal is open
 */
function disableCameraControls() {
  const camera = document.querySelector('a-camera');
  if (camera) {
    const lookControls = camera.getAttribute('look-controls');
    if (lookControls) {
      // Store original enabled state
      const wasEnabled = typeof lookControls === 'object' 
        ? (lookControls.enabled !== false)
        : (lookControls !== 'false' && lookControls !== false);
      
      camera.setAttribute('data-original-look-enabled', wasEnabled ? 'true' : 'false');
      // Disable look controls
      camera.setAttribute('look-controls', 'enabled', false);
    }
  }
}

/**
 * Enable camera look controls when modal is closed
 */
function enableCameraControls() {
  const camera = document.querySelector('a-camera');
  if (camera) {
    const originalEnabled = camera.getAttribute('data-original-look-enabled');
    if (originalEnabled !== null) {
      // Restore original state
      const shouldEnable = originalEnabled === 'true';
      camera.setAttribute('look-controls', 'enabled', shouldEnable);
      camera.removeAttribute('data-original-look-enabled');
    } else {
      // Just re-enable if no original state stored (default behavior)
      camera.setAttribute('look-controls', 'enabled', true);
    }
  }
}

