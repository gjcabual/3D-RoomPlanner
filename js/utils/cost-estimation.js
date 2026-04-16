// Cost Estimation utility for saving and loading estimation data

const LOCAL_COST_ESTIMATIONS_KEY = "localCostEstimations";

/**
 * Get all saved cost estimations.
 * @returns {Array}
 */
function getSavedCostEstimations() {
  try {
    const raw = localStorage.getItem(LOCAL_COST_ESTIMATIONS_KEY);
    const estimations = raw ? JSON.parse(raw) : [];
    return Array.isArray(estimations) ? estimations : [];
  } catch (error) {
    console.warn("Error parsing saved cost estimations:", error);
    return [];
  }
}

/**
 * Persist all cost estimations to localStorage.
 * @param {Array} estimations
 */
function saveCostEstimations(estimations) {
  localStorage.setItem(LOCAL_COST_ESTIMATIONS_KEY, JSON.stringify(estimations));
}

/**
 * Add a new cost estimation.
 * @param {Object} estimation
 * @returns {Array}
 */
function addCostEstimation(estimation) {
  const estimations = getSavedCostEstimations();
  estimations.unshift(estimation);
  saveCostEstimations(estimations);
  return estimations;
}

/**
 * Delete a cost estimation by ID.
 * @param {string} id
 * @returns {Array}
 */
function deleteCostEstimation(id) {
  const estimations = getSavedCostEstimations().filter(
    (estimation) => estimation.id !== id,
  );
  saveCostEstimations(estimations);
  return estimations;
}

/**
 * Save current cost estimation.
 * Adds room layout data and store recommendation metadata for reporting.
 * @param {string} name
 * @returns {Object}
 */
function saveCostEstimation(name) {
  const toNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  const cloneValue = (value, fallback) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  };

  const normalizeSources = (rawSources) => {
    if (!Array.isArray(rawSources)) return [];

    return rawSources
      .map((source) => {
        const store =
          source && typeof source.store === "string" ? source.store : "";
        const price = toNumber(source ? source.price : NaN, NaN);
        if (!store || !Number.isFinite(price)) return null;
        return { store, price };
      })
      .filter(Boolean);
  };

  const currentCostItems =
    typeof costState !== "undefined" && costState && costState.items
      ? costState.items
      : {};

  const getSourcesForModel = (modelKey) => {
    const stateItem = currentCostItems[modelKey];
    const fromState = normalizeSources(stateItem && stateItem.sources);
    if (fromState.length > 0) return fromState;

    if (
      typeof ITEM_PRICE_SOURCES !== "undefined" &&
      ITEM_PRICE_SOURCES &&
      ITEM_PRICE_SOURCES[modelKey]
    ) {
      return normalizeSources(ITEM_PRICE_SOURCES[modelKey]);
    }

    return [];
  };

  const getRecommendedSource = (sources) => {
    if (!Array.isArray(sources) || sources.length === 0) return null;
    return sources.reduce((best, current) =>
      current.price < best.price ? current : best,
    );
  };

  let rawRoomPlanData = null;
  if (typeof collectRoomPlanData === "function") {
    try {
      rawRoomPlanData = collectRoomPlanData();
    } catch (error) {
      console.warn("Room plan snapshot failed during cost save:", error);
      rawRoomPlanData = null;
    }
  }

  const savedRoomHeight = toNumber(
    rawRoomPlanData ? rawRoomPlanData.room_height : NaN,
    toNumber(parseFloat(localStorage.getItem("roomHeight")), 3),
  );

  const roomWidth = toNumber(
    rawRoomPlanData ? rawRoomPlanData.room_width : NaN,
    parseFloat(localStorage.getItem("roomWidth")) || 10,
  );

  const roomLength = toNumber(
    rawRoomPlanData ? rawRoomPlanData.room_length : NaN,
    parseFloat(localStorage.getItem("roomLength")) || 10,
  );

  const roomHeight = savedRoomHeight;

  const roomPlanData =
    rawRoomPlanData && typeof rawRoomPlanData === "object"
      ? {
          ...rawRoomPlanData,
          room_height: roomHeight,
        }
      : null;

  const costItems = {};
  Object.entries(currentCostItems).forEach(([modelKey, item]) => {
    const qty = Math.max(0, Math.round(toNumber(item && item.qty, 0)));
    const unitCost = toNumber(item && (item.unitCost ?? item.price), 0);
    const lineTotal = unitCost * qty;
    const sources = getSourcesForModel(modelKey);
    const recommendedSource = getRecommendedSource(sources);

    costItems[modelKey] = {
      name: (item && item.name) || modelKey,
      modelKey,
      qty,
      price: unitCost,
      unitCost,
      lineTotal,
      sources,
      recommendedStore: recommendedSource ? recommendedSource.store : null,
      recommendedPrice: recommendedSource ? recommendedSource.price : unitCost,
      recommendationStrategy: recommendedSource
        ? "lowest-price"
        : "estimated-average",
    };
  });

  const itemizedTotal = Object.values(costItems).reduce((sum, item) => {
    return sum + toNumber(item && item.lineTotal, 0);
  }, 0);

  const costTotal =
    typeof costState !== "undefined" && costState
      ? toNumber(costState.total, itemizedTotal)
      : itemizedTotal;

  let furnitureData =
    roomPlanData && Array.isArray(roomPlanData.furniture_data)
      ? cloneValue(roomPlanData.furniture_data, [])
      : [];

  if (roomPlanData) {
    roomPlanData.furniture_data = cloneValue(furnitureData, []);
  }

  let furnitureCount = furnitureData.length;
  if (furnitureCount === 0) {
    const furnitureContainer = document.getElementById("furniture-container");
    if (furnitureContainer) {
      furnitureCount =
        furnitureContainer.querySelectorAll('[id^="furniture-"]').length;
    }
  }

  const estimation = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`,
    name: name || `Cost Estimation ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    roomWidth,
    roomLength,
    roomHeight,
    costItems: cloneValue(costItems, {}),
    costTotal,
    furnitureCount,
    roomPlanData: roomPlanData ? cloneValue(roomPlanData, null) : null,
    furnitureData,
    recommendationSummary: {
      strategy: "lowest-price",
      generatedAt: new Date().toISOString(),
    },
    costSummary: {
      itemizedTotal,
      finalTotal: costTotal,
    },
  };

  addCostEstimation(estimation);
  return estimation;
}

// Expose helpers globally
window.getSavedCostEstimations = getSavedCostEstimations;
window.deleteCostEstimation = deleteCostEstimation;
window.saveCostEstimation = saveCostEstimation;
