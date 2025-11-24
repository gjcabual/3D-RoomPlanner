// Cost Estimation utility for saving and loading cost estimation data

const LOCAL_COST_ESTIMATIONS_KEY = 'localCostEstimations';

/**
 * Get all saved cost estimations for the current user
 * @returns {Array} - Array of saved cost estimations for current user
 */
async function getSavedCostEstimations() {
  try {
    // Get current user ID
    let currentUserId = null;
    if (typeof getCurrentUser === 'function') {
      try {
        const user = await getCurrentUser();
        currentUserId = user?.id || null;
      } catch (error) {
        console.warn('Could not get current user:', error);
        // If not authenticated, return empty array
        return [];
      }
    }
    
    // If no user ID, return empty array (user not authenticated)
    if (!currentUserId) {
      return [];
    }
    
    const raw = localStorage.getItem(LOCAL_COST_ESTIMATIONS_KEY);
    const allEstimations = raw ? JSON.parse(raw) : [];
    const estimations = Array.isArray(allEstimations) ? allEstimations : [];
    
    // Filter by current user ID
    return estimations.filter(est => est.userId === currentUserId);
  } catch (error) {
    console.warn('Error parsing saved cost estimations:', error);
    return [];
  }
}

/**
 * Save cost estimations to localStorage
 * @param {Array} estimations - Array of cost estimations
 */
function saveCostEstimations(estimations) {
  localStorage.setItem(LOCAL_COST_ESTIMATIONS_KEY, JSON.stringify(estimations));
}

/**
 * Add a new cost estimation
 * @param {Object} estimation - Cost estimation object
 * @returns {Array} - Updated array of estimations
 */
async function addCostEstimation(estimation) {
  // Get all estimations (not filtered by user)
  const raw = localStorage.getItem(LOCAL_COST_ESTIMATIONS_KEY);
  const allEstimations = raw ? JSON.parse(raw) : [];
  const estimations = Array.isArray(allEstimations) ? allEstimations : [];
  
  estimations.unshift(estimation);
  saveCostEstimations(estimations);
  
  // Return filtered estimations for current user
  return await getSavedCostEstimations();
}

/**
 * Delete a cost estimation by ID
 * @param {string} id - Estimation ID
 * @returns {Array} - Updated array of estimations
 */
async function deleteCostEstimation(id) {
  // Get current user ID to ensure we only delete user's own estimations
  let currentUserId = null;
  if (typeof getCurrentUser === 'function') {
    try {
      const user = await getCurrentUser();
      currentUserId = user?.id || null;
    } catch (error) {
      console.warn('Could not get current user:', error);
      return [];
    }
  }
  
  // Get all estimations (not filtered by user)
  const raw = localStorage.getItem(LOCAL_COST_ESTIMATIONS_KEY);
  const allEstimations = raw ? JSON.parse(raw) : [];
  const estimations = Array.isArray(allEstimations) ? allEstimations : [];
  
  // Filter out the estimation to delete (only if it belongs to current user)
  const updatedEstimations = estimations.filter(est => {
    // Only delete if it's the matching ID AND belongs to current user
    if (est.id === id) {
      return est.userId !== currentUserId; // Remove if it matches current user
    }
    return true; // Keep all other estimations
  });
  
  saveCostEstimations(updatedEstimations);
  
  // Return filtered estimations for current user
  return await getSavedCostEstimations();
}

/**
 * Save current cost estimation
 * @param {string} name - Project name
 * @returns {Promise<Object>} - Saved estimation object
 */
async function saveCostEstimation(name) {
  // Get current user ID
  let currentUserId = null;
  if (typeof getCurrentUser === 'function') {
    try {
      const user = await getCurrentUser();
      currentUserId = user?.id || null;
    } catch (error) {
      console.warn('Could not get current user:', error);
      throw new Error('User must be authenticated to save cost estimations');
    }
  }
  
  if (!currentUserId) {
    throw new Error('User must be authenticated to save cost estimations');
  }
  
  const roomWidth = parseFloat(localStorage.getItem('roomWidth')) || 10;
  const roomLength = parseFloat(localStorage.getItem('roomLength')) || 10;
  
  // Get current cost state (must be available globally)
  const costItems = typeof costState !== 'undefined' ? costState.items : {};
  const costTotal = typeof costState !== 'undefined' ? costState.total : 0;
  
  // Count furniture items
  const furnitureContainer = document.getElementById('furniture-container');
  let furnitureCount = 0;
  if (furnitureContainer) {
    furnitureCount = furnitureContainer.querySelectorAll('[id^="furniture-"]').length;
  }
  
  const estimation = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    userId: currentUserId, // Store user ID with estimation
    name: name || `Cost Estimation ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    roomWidth: roomWidth,
    roomLength: roomLength,
    costItems: JSON.parse(JSON.stringify(costItems)), // Deep copy
    costTotal: costTotal,
    furnitureCount: furnitureCount
  };
  
  await addCostEstimation(estimation);
  return estimation;
}

// Expose functions globally
window.getSavedCostEstimations = getSavedCostEstimations;
window.deleteCostEstimation = deleteCostEstimation;
window.saveCostEstimation = saveCostEstimation;

