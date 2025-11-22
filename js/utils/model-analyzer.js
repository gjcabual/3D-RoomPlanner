// Model File Analyzer - Maps model files from asset/models folder to model keys

/**
 * Model file mapping - maps filenames to model keys
 * This is automatically generated based on files in asset/models folder
 */
const MODEL_FILE_MAP = {
  // Existing models
  'table1.obj': 'table1',
  'center_table1.obj': 'center_table1',
  'center_table2.obj': 'center_table2',
  'wardrobe_modern.obj': 'wardrobe1',
  'wardrobe_traditional.obj': 'wardrobe2',
  'wardrobe_openframe.obj': 'wardrobe3',
  
  // New models from asset/models folder
  'bed1.obj': 'bed1',
  'bed2.obj': 'bed2',
  'chair1.obj': 'chair1',
  'chair2.obj': 'chair2',
  'desk1.obj': 'desk1',
  'desk2.obj': 'desk2',
  'mirror1.obj': 'mirror1',
  'mirror2.obj': 'mirror2',
  'shelf1.obj': 'shelf1',
  'shelf2.obj': 'shelf2',
};

/**
 * Reverse mapping - model key to filename
 */
const MODEL_KEY_TO_FILE = {};
Object.entries(MODEL_FILE_MAP).forEach(([filename, modelKey]) => {
  MODEL_KEY_TO_FILE[modelKey] = filename;
});

/**
 * Get model filename from model key
 * @param {string} modelKey - Model key (e.g., 'wardrobe1', 'bed1')
 * @returns {string|null} - Filename or null if not found
 */
function getModelFilename(modelKey) {
  return MODEL_KEY_TO_FILE[modelKey] || null;
}

/**
 * Get model key from filename
 * @param {string} filename - Model filename (e.g., 'wardrobe_modern.obj')
 * @returns {string|null} - Model key or null if not found
 */
function getModelKeyFromFilename(filename) {
  return MODEL_FILE_MAP[filename] || null;
}

/**
 * Get all available model keys
 * @returns {string[]} - Array of model keys
 */
function getAllModelKeys() {
  return Object.values(MODEL_FILE_MAP);
}

/**
 * Get local model path
 * @param {string} modelKey - Model key
 * @returns {string} - Local path to model file
 */
function getLocalModelPath(modelKey) {
  const filename = getModelFilename(modelKey);
  if (filename) {
    return `asset/models/${filename}`;
  }
  // Fallback: try to construct from model key
  return `asset/models/${modelKey}.obj`;
}

/**
 * Check if model file exists locally (by checking if it's in our map)
 * @param {string} modelKey - Model key
 * @returns {boolean} - True if model exists in local mapping
 */
function hasLocalModel(modelKey) {
  return modelKey in MODEL_KEY_TO_FILE;
}

// Export functions
if (typeof window !== 'undefined') {
  window.getModelFilename = getModelFilename;
  window.getModelKeyFromFilename = getModelKeyFromFilename;
  window.getAllModelKeys = getAllModelKeys;
  window.getLocalModelPath = getLocalModelPath;
  window.hasLocalModel = hasLocalModel;
}

