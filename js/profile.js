// Profile page functionality

const BLUEPRINT_ITEM_FOOTPRINTS = {
  bed1: { w: 1.75, d: 2.0 },
  bed2: { w: 2.65, d: 2.38 },
  wardrobe1: { w: 1.5, d: 0.55 },
  wardrobe2: { w: 1.05, d: 0.65 },
  wardrobe3: { w: 1.35, d: 0.62 },
  desk1: { w: 1.35, d: 0.55 },
  desk2: { w: 1.45, d: 0.55 },
  chair1: { w: 0.82, d: 0.95 },
  chair2: { w: 0.95, d: 0.9 },
  shelf1: { w: 1.45, d: 0.65 },
  shelf2: { w: 1.22, d: 0.5 },
  center_table1: { w: 2.6, d: 1.4 },
  center_table2: { w: 1.4, d: 0.72 },
  table1: { w: 1.1, d: 0.75 },
  mirror1: { w: 0.6, d: 0.12 },
  mirror2: { w: 0.65, d: 0.12 },
};

const REPORT_CURRENCY_CODE = "PHP";
let PROFILE_ITEM_PRICE_SOURCES = {};

function formatModelName(modelKey) {
  return String(modelKey || "Unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function normalizeRightAngle(deg = 0) {
  return (((Math.round(Number(deg || 0) / 90) * 90) % 360) + 360) % 360;
}

function getStoredPlanFurnitureData(estimation) {
  if (Array.isArray(estimation?.roomPlanData?.furniture_data)) {
    return estimation.roomPlanData.furniture_data;
  }
  if (Array.isArray(estimation?.furnitureData)) {
    return estimation.furnitureData;
  }
  return [];
}

function getTotalItemQuantity(costItems) {
  return Object.values(costItems || {}).reduce((sum, item) => {
    const qty = Number(item?.qty || 0);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);
}

function buildSyntheticFurnitureDataFromCost(estimation) {
  const costItems = getEstimationCostItems(estimation);
  const entries = Object.entries(costItems);
  if (entries.length === 0) return [];

  const roomWidth = Math.max(getRoomDimension(estimation, "width"), 1);
  const roomLength = Math.max(getRoomDimension(estimation, "length"), 1);

  const instances = [];
  entries.forEach(([modelKey, item]) => {
    const qty = Math.max(0, Math.round(Number(item?.qty || 0)));
    for (let i = 0; i < qty; i += 1) {
      instances.push({
        model_key: modelKey,
        rotation: { x: 0, y: i % 2 === 0 ? 0 : 90, z: 0 },
      });
    }
  });

  if (instances.length === 0) return [];

  const cols = Math.max(
    1,
    Math.ceil(
      Math.sqrt(instances.length * (roomWidth / Math.max(roomLength, 0.1))),
    ),
  );
  const rows = Math.max(1, Math.ceil(instances.length / cols));
  const cellW = roomWidth / cols;
  const cellL = roomLength / rows;

  const originX = -roomWidth / 2;
  const originZ = -roomLength / 2;

  return instances.map((entry, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const posX = originX + cellW * (col + 0.5);
    const posZ = originZ + cellL * (row + 0.5);

    return {
      ...entry,
      position: {
        x: Number(posX.toFixed(2)),
        y: 0,
        z: Number(posZ.toFixed(2)),
      },
      _synthetic: true,
    };
  });
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function normalizePlanFurnitureItem(item) {
  const modelKey = item?.model_key || item?.modelKey || null;
  if (!modelKey) return null;

  const posX = Number(item?.position?.x ?? item?.x);
  const posY = Number(item?.position?.y ?? item?.y ?? 0);
  const posZ = Number(item?.position?.z ?? item?.z);

  const rotX = Number(item?.rotation?.x ?? item?.rx ?? 0);
  const rotY = Number(item?.rotation?.y ?? item?.ry ?? 0);
  const rotZ = Number(item?.rotation?.z ?? item?.rz ?? 0);

  return {
    ...item,
    model_key: modelKey,
    position: {
      x: isFiniteNumber(posX) ? posX : null,
      y: isFiniteNumber(posY) ? posY : 0,
      z: isFiniteNumber(posZ) ? posZ : null,
    },
    rotation: {
      x: isFiniteNumber(rotX) ? rotX : 0,
      y: isFiniteNumber(rotY) ? rotY : 0,
      z: isFiniteNumber(rotZ) ? rotZ : 0,
    },
  };
}

function getPlanFurnitureData(estimation) {
  const stored = getStoredPlanFurnitureData(estimation)
    .map((item) => normalizePlanFurnitureItem(item))
    .filter(Boolean);

  const hasStoredCoordinates = stored.some(
    (item) =>
      isFiniteNumber(item?.position?.x) && isFiniteNumber(item?.position?.z),
  );

  if (stored.length > 0 && hasStoredCoordinates) {
    const savedPlacedItems = stored.filter(
      (item) =>
        isFiniteNumber(item?.position?.x) && isFiniteNumber(item?.position?.z),
    );
    return {
      data: savedPlacedItems,
      source: "saved",
    };
  }

  const inferred = buildSyntheticFurnitureDataFromCost(estimation)
    .map((item) => normalizePlanFurnitureItem(item))
    .filter(Boolean);

  if (inferred.length > 0) {
    return {
      data: inferred,
      source: "inferred",
    };
  }

  return {
    data: [],
    source: "none",
  };
}

function buildFallbackLayoutRowsFromCost(estimation) {
  const costItems = getEstimationCostItems(estimation);
  const rows = [];
  let index = 1;

  Object.entries(costItems).forEach(([modelKey, item]) => {
    const qty = Math.max(0, Math.round(Number(item?.qty || 0)));
    const footprint = getFootprint(modelKey, 0);

    for (let i = 0; i < qty; i += 1) {
      rows.push({
        index,
        modelKey,
        itemName: item?.name || formatModelName(modelKey),
        positionX: null,
        positionZ: null,
        rotationY: null,
        width: footprint.w,
        depth: footprint.d,
        inferred: true,
      });
      index += 1;
    }
  });

  return rows;
}

function getEstimationCostItems(estimation) {
  return estimation?.costItems && typeof estimation.costItems === "object"
    ? estimation.costItems
    : {};
}

function getEstimatedFurnitureCount(estimation) {
  const fromEstimation = Number(estimation?.furnitureCount);
  if (Number.isFinite(fromEstimation) && fromEstimation > 0) {
    return fromEstimation;
  }

  const storedFurniture = getStoredPlanFurnitureData(estimation);
  if (storedFurniture.length > 0) {
    return storedFurniture.length;
  }

  return getTotalItemQuantity(getEstimationCostItems(estimation));
}

function getRoomDimension(estimation, dimension) {
  const roomPlanData = estimation?.roomPlanData || {};
  const fallback = dimension === "width" ? 10 : 10;
  const fromPlan = Number(
    dimension === "width" ? roomPlanData.room_width : roomPlanData.room_length,
  );
  if (Number.isFinite(fromPlan) && fromPlan > 0) {
    return fromPlan;
  }

  const fromEstimation = Number(
    dimension === "width" ? estimation?.roomWidth : estimation?.roomLength,
  );
  if (Number.isFinite(fromEstimation) && fromEstimation > 0) {
    return fromEstimation;
  }

  return fallback;
}

function getRoomHeight(estimation) {
  const fromPlan = Number(estimation?.roomPlanData?.room_height);
  if (Number.isFinite(fromPlan) && fromPlan > 0) {
    return fromPlan;
  }

  const fromEstimation = Number(estimation?.roomHeight);
  if (Number.isFinite(fromEstimation) && fromEstimation > 0) {
    return fromEstimation;
  }

  return 3;
}

function getCachedSourcesForModel(modelKey) {
  const sources = PROFILE_ITEM_PRICE_SOURCES?.[modelKey];
  if (!Array.isArray(sources)) return [];

  return sources
    .map((source) => {
      const store = source?.store;
      const price = Number(source?.price);
      if (!store || !Number.isFinite(price)) return null;
      return { store, price };
    })
    .filter(Boolean);
}

async function loadProfilePriceSources() {
  PROFILE_ITEM_PRICE_SOURCES = {};

  if (typeof supabase === "undefined" || !supabase) {
    return;
  }

  try {
    const { data, error } = await supabase
      .from("item_prices")
      .select("price, store_name, items(model_key)");

    if (error || !Array.isArray(data)) {
      if (error) {
        console.warn(
          "Unable to load profile price sources:",
          error.message || error,
        );
      }
      return;
    }

    data.forEach((row) => {
      const modelKey =
        row?.items?.model_key ||
        (Array.isArray(row?.items) ? row.items[0]?.model_key : null);

      const store = row?.store_name;
      const price = Number(row?.price);

      if (!modelKey || !store || !Number.isFinite(price)) return;

      if (!PROFILE_ITEM_PRICE_SOURCES[modelKey]) {
        PROFILE_ITEM_PRICE_SOURCES[modelKey] = [];
      }
      PROFILE_ITEM_PRICE_SOURCES[modelKey].push({ store, price });
    });
  } catch (error) {
    console.warn("Profile price source fetch failed:", error);
  }
}

function getRecommendedSourceForItem(item, modelKey = "") {
  if (!item || typeof item !== "object") {
    return { store: "N/A", price: 0, sources: [] };
  }

  const directSources = Array.isArray(item.sources)
    ? item.sources
        .map((source) => {
          const store = source?.store;
          const price = Number(source?.price);
          if (!store || !Number.isFinite(price)) return null;
          return { store, price };
        })
        .filter(Boolean)
    : [];

  const cachedSources = getCachedSourcesForModel(modelKey);
  const sources = directSources.length > 0 ? directSources : cachedSources;

  if (item.recommendedStore && Number.isFinite(Number(item.recommendedPrice))) {
    return {
      store: item.recommendedStore,
      price: Number(item.recommendedPrice),
      sources,
    };
  }

  if (sources.length > 0) {
    const best = sources.reduce((lowest, entry) =>
      entry.price < lowest.price ? entry : lowest,
    );
    return {
      store: best.store,
      price: best.price,
      sources,
    };
  }

  const fallbackPrice = Number(item.unitCost ?? item.price ?? 0);
  return {
    store: "Estimated Average",
    price: Number.isFinite(fallbackPrice) ? fallbackPrice : 0,
    sources,
  };
}

function getFootprint(modelKey, rotationY = 0) {
  const base = BLUEPRINT_ITEM_FOOTPRINTS[modelKey] || { w: 1.0, d: 1.0 };
  const normalized = normalizeRightAngle(rotationY);
  const quarterTurn = normalized === 90 || normalized === 270;
  return quarterTurn ? { w: base.d, d: base.w } : { w: base.w, d: base.d };
}

function getBlueprintColor(modelKey) {
  const palette = [
    "#dbeafe",
    "#d1fae5",
    "#fee2e2",
    "#fef3c7",
    "#ede9fe",
    "#fce7f3",
    "#cffafe",
    "#e2e8f0",
  ];

  const text = String(modelKey || "item");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function slugifyFileName(name) {
  return (
    String(name || "room-plan")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") || `room-plan-${Date.now()}`
  );
}

function buildBlueprintCanvas(estimation) {
  const roomWidth = getRoomDimension(estimation, "width");
  const roomLength = getRoomDimension(estimation, "length");
  const roomHeight = getRoomHeight(estimation);
  const planFurniture = getPlanFurnitureData(estimation);
  const furnitureData = planFurniture.data;
  const layoutSource = planFurniture.source;
  const costItems = getEstimationCostItems(estimation);

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 760;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to render blueprint canvas.");
  }

  const margin = 90;
  const drawableW = canvas.width - margin * 2;
  const drawableH = canvas.height - margin * 2;
  const safeRoomWidth = Math.max(roomWidth, 0.1);
  const safeRoomLength = Math.max(roomLength, 0.1);
  const scale = Math.min(drawableW / safeRoomWidth, drawableH / safeRoomLength);
  const roomPxW = safeRoomWidth * scale;
  const roomPxH = safeRoomLength * scale;
  const roomX = (canvas.width - roomPxW) / 2;
  const roomY = (canvas.height - roomPxH) / 2;

  const drawRoundedRect = (x, y, width, height, radius) => {
    const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  };

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Light 1m grid to make spatial layout clearer in the PDF.
  ctx.strokeStyle = "#edf2f7";
  ctx.lineWidth = 1;
  for (let meter = 1; meter < safeRoomWidth; meter += 1) {
    const x = roomX + meter * scale;
    ctx.beginPath();
    ctx.moveTo(x, roomY);
    ctx.lineTo(x, roomY + roomPxH);
    ctx.stroke();
  }
  for (let meter = 1; meter < safeRoomLength; meter += 1) {
    const y = roomY + meter * scale;
    ctx.beginPath();
    ctx.moveTo(roomX, y);
    ctx.lineTo(roomX + roomPxW, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 3;
  drawRoundedRect(roomX, roomY, roomPxW, roomPxH, 8);
  ctx.fill();
  ctx.stroke();

  const layoutRows = furnitureData.map((item, index) => {
    const modelKey = String(item?.model_key || "item");
    const itemName = costItems[modelKey]?.name || formatModelName(modelKey);
    const posX = Number(item?.position?.x || 0);
    const posZ = Number(item?.position?.z || 0);
    const rotationY = normalizeRightAngle(item?.rotation?.y || 0);
    const footprint = getFootprint(modelKey, rotationY);

    const centerX = roomX + roomPxW / 2 + posX * scale;
    const centerY = roomY + roomPxH / 2 + posZ * scale;
    const rectW = Math.max(14, footprint.w * scale);
    const rectH = Math.max(14, footprint.d * scale);
    const rectX = centerX - rectW / 2;
    const rectY = centerY - rectH / 2;

    ctx.fillStyle = getBlueprintColor(modelKey);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;
    drawRoundedRect(rectX, rectY, rectW, rectH, 5);
    ctx.fill();
    ctx.stroke();

    const label = `${index + 1}`;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, centerX, centerY);

    return {
      index: index + 1,
      modelKey,
      itemName,
      positionX: posX,
      positionZ: posZ,
      rotationY,
      width: footprint.w,
      depth: footprint.d,
    };
  });

  const drawDimensionLine = ({ x1, y1, x2, y2, label }) => {
    const arrow = 7;
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#0f172a";
    ctx.lineWidth = 1.4;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + arrow, y1 - arrow / 2);
    ctx.lineTo(x1 + arrow, y1 + arrow / 2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - arrow, y2 - arrow / 2);
    ctx.lineTo(x2 - arrow, y2 + arrow / 2);
    ctx.closePath();
    ctx.fill();

    ctx.font = "600 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, (x1 + x2) / 2, y1 - 8);
  };

  drawDimensionLine({
    x1: roomX,
    y1: roomY - 26,
    x2: roomX + roomPxW,
    y2: roomY - 26,
    label: `${safeRoomWidth.toFixed(2)} m`,
  });

  ctx.save();
  ctx.translate(roomX - 30, roomY + roomPxH / 2);
  ctx.rotate(-Math.PI / 2);
  drawDimensionLine({
    x1: -roomPxH / 2,
    y1: 0,
    x2: roomPxH / 2,
    y2: 0,
    label: `${safeRoomLength.toFixed(2)} m`,
  });
  ctx.restore();

  // North marker for orientation reference.
  const northX = roomX + roomPxW - 40;
  const northY = roomY + 18;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText("N", northX, northY - 7);
  ctx.beginPath();
  ctx.moveTo(northX, northY);
  ctx.lineTo(northX - 7, northY + 12);
  ctx.lineTo(northX + 7, northY + 12);
  ctx.closePath();
  ctx.fill();

  return {
    canvas,
    roomWidth: safeRoomWidth,
    roomLength: safeRoomLength,
    roomHeight,
    layoutSource,
    layoutRows,
  };
}

function getEstimationById(planId) {
  const estimations =
    typeof getSavedCostEstimations === "function"
      ? getSavedCostEstimations()
      : [];
  return estimations.find((plan) => String(plan.id) === String(planId)) || null;
}

/**
 * Initialize profile page
 */
async function initProfile() {
  // Check authentication
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: "planner-dashboard-require-auth" },
        window.location.origin,
      );
      return;
    }
    window.location.href = "planner.html";
    return;
  }

  await loadProfileData();
}

/**
 * Load user profile and saved plans
 */
async function loadProfileData() {
  try {
    document.getElementById("loading").style.display = "block";
    document.getElementById("error").style.display = "none";

    // Get user profile
    const profile = await getUserProfile();
    if (!profile) {
      throw new Error("Could not load user profile");
    }

    await loadProfilePriceSources();

    // Display profile info
    document.getElementById("profile-email").textContent = profile.email || "-";
    document.getElementById("profile-role").textContent =
      profile.role === "admin" ? "Admin" : "User";
    document.getElementById("profile-created").textContent = profile.created_at
      ? new Date(profile.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "-";

    // Load saved cost estimations
    const estimations =
      typeof getSavedCostEstimations === "function"
        ? getSavedCostEstimations()
        : [];
    document.getElementById("profile-plans-count").textContent =
      estimations.length;

    // Display estimations
    renderPlans(estimations);

    document.getElementById("loading").style.display = "none";
    document.getElementById("profile-info").style.display = "block";
    document.getElementById("plans-section").style.display = "block";
  } catch (error) {
    console.error("Error loading profile:", error);
    showError(`Error loading profile: ${error.message}`);
    document.getElementById("loading").style.display = "none";
  }
}

/**
 * Render saved room plans
 */
function renderPlans(plans) {
  const container = document.getElementById("plans-list");
  container.innerHTML = "";

  if (plans.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No saved cost estimations yet</p>
        <p>Create your first cost estimation in the planner!</p>
      </div>
    `;
    return;
  }

  plans.forEach((estimation) => {
    const card = document.createElement("div");
    card.className = "plan-card";
    card.dataset.planId = estimation.id;

    const createdDate = estimation.createdAt
      ? new Date(estimation.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";

    const estimationName = estimation.name || "Unnamed Cost Estimation";
    const totalCost = estimation.costTotal ?? 0;
    const totalCostDisplay = formatCurrency(totalCost);
    const roomWidth = getRoomDimension(estimation, "width");
    const roomLength = getRoomDimension(estimation, "length");
    const roomHeight = getRoomHeight(estimation);
    const furnitureCount = getEstimatedFurnitureCount(estimation);
    const costItems = getEstimationCostItems(estimation);

    // Build cost breakdown HTML
    const costBreakdown =
      Object.keys(costItems).length > 0
        ? Object.entries(costItems)
            .map(([modelKey, item]) => {
              const unitCost = Number(item.unitCost ?? item.price ?? 0) || 0;
              const qty = Number(item.qty || 0) || 0;
              const itemTotal = Number(item.lineTotal ?? unitCost * qty) || 0;
              const recommendation = getRecommendedSourceForItem(
                item,
                modelKey,
              );
              return `
            <div class="cost-breakdown-item">
              <span>${item.name || modelKey}</span>
              <span>
                ${qty} × ${formatCurrency(unitCost)} = ${formatCurrency(itemTotal)}<br>
                <small>Recommended: ${recommendation.store} (${formatCurrency(recommendation.price)})</small>
              </span>
            </div>
          `;
            })
            .join("")
        : '<div class="cost-breakdown-empty">No items in this estimation</div>';

    card.innerHTML = `
      <div class="plan-header">
        <div>
          <div class="plan-name">${estimationName}</div>
          <div class="plan-date">Created: ${createdDate}</div>
        </div>
        <div class="plan-total">
          <span>Total Estimated Cost</span>
          <strong>${totalCostDisplay}</strong>
        </div>
      </div>
      <div class="plan-details">
        <div class="plan-detail-item">
          <label>Room Size</label>
          <div class="value">${roomWidth.toFixed(2)}M × ${roomLength.toFixed(2)}M × ${roomHeight.toFixed(2)}M</div>
        </div>
        <div class="plan-detail-item">
          <label>Furniture Items</label>
          <div class="value">${furnitureCount} items</div>
        </div>
        <div class="plan-detail-item">
          <label>Cost Breakdown</label>
          <div class="cost-breakdown">
            ${costBreakdown}
          </div>
        </div>
      </div>
      <div class="plan-actions">
        <button class="btn-primary" onclick="downloadPlanPdf('${estimation.id}')">
          Download PDF
        </button>
        <button class="btn-danger" onclick="deletePlan('${estimation.id}')">
          Delete
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

/**
 * Delete a room plan
 * @param {string} planId - Plan ID
 */
async function deletePlan(planId) {
  const confirmed = await showConfirm(
    "Delete this saved cost estimation?",
    "Confirm Delete",
  );
  if (!confirmed) {
    return;
  }

  try {
    if (typeof deleteCostEstimation === "function") {
      deleteCostEstimation(planId);
    } else {
      throw new Error("Delete function not available");
    }
    await loadProfileData();
  } catch (error) {
    console.error("Error deleting cost estimation:", error);
    await showDialog(
      "Error deleting cost estimation: " + error.message,
      "Error",
    );
  }
}

/**
 * Download a full blueprint-style PDF report for the selected estimation.
 * @param {string} planId - Plan ID
 */
async function downloadPlanPdf(planId) {
  try {
    const estimation = getEstimationById(planId);
    if (!estimation) {
      throw new Error("The selected estimation could not be found.");
    }

    generatePlanPdf(estimation);
  } catch (error) {
    console.error("Error generating PDF:", error);
    await showDialog(
      "Unable to generate PDF report: " + (error.message || "Unknown error"),
      "PDF Export Error",
    );
  }
}

function generatePlanPdf(estimation) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error(
      "PDF generator is not available. Check your internet connection and reload this page.",
    );
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const formatReportCurrency = (value) => {
    const amount = Number(value) || 0;
    return `${REPORT_CURRENCY_CODE} ${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const drawMinimalisticLogo = (x, top, size = 14) => {
    const borderRadius = 2;
    doc.setDrawColor(82, 82, 82);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(x, top, size, size, borderRadius, borderRadius, "FD");

    const iconPadding = 2.2;
    const iconGap = 1.6;
    const iconSize = (size - iconPadding * 2 - iconGap) / 2;
    const startX = x + iconPadding;
    const startY = top + iconPadding;

    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.5);
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const cx = startX + col * (iconSize + iconGap);
        const cy = startY + row * (iconSize + iconGap);
        doc.roundedRect(cx, cy, iconSize, iconSize, 0.6, 0.6, "S");
      }
    }
  };

  const ensureSpace = (requiredHeight = 8) => {
    if (y + requiredHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrappedText = (text, options = {}) => {
    const {
      fontSize = 9,
      lineHeight = 4.1,
      indent = 0,
      fontStyle = "normal",
    } = options;

    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);

    const lines = doc.splitTextToSize(String(text), contentWidth - indent);
    ensureSpace(lines.length * lineHeight + 1);
    doc.text(lines, margin + indent, y);
    y += lines.length * lineHeight;
  };

  const drawSectionHeader = (title) => {
    ensureSpace(10);
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(210, 214, 220);
    doc.roundedRect(margin, y, contentWidth, 7, 1.2, 1.2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text(title, margin + 2.5, y + 4.7);
    y += 9;
    doc.setTextColor(0, 0, 0);
  };

  const metadataLabelColumnWidth = (() => {
    const metadataLabels = [
      "Project",
      "Generated",
      "Saved Plan Date",
      "Room Dimensions",
      "Floor Area / Furniture",
      "Layout Source",
    ];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);

    const widestLabel = metadataLabels.reduce(
      (max, label) => Math.max(max, doc.getTextWidth(`${label}:`)),
      0,
    );

    // Keep values aligned and avoid label/value collisions on long labels.
    return Math.max(33, widestLabel + 2.5);
  })();

  const drawMetadataRow = (label, value) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.3);
    const valueLines = doc.splitTextToSize(
      String(value),
      contentWidth - metadataLabelColumnWidth,
    );
    const rowHeight = Math.max(5, valueLines.length * 4.2);
    ensureSpace(rowHeight + 1);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(`${label}:`, margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.3);
    doc.text(valueLines, margin + metadataLabelColumnWidth, y);

    y += rowHeight;
  };

  const drawHorizontalRule = () => {
    ensureSpace(2);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7; // Increased for more bottom space after the line
  };

  const planName = estimation.name || "Unnamed Cost Estimation";
  const createdAtText = estimation.createdAt
    ? new Date(estimation.createdAt).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  const blueprint = buildBlueprintCanvas(estimation);
  const roomWidth = blueprint.roomWidth;
  const roomLength = blueprint.roomLength;
  const roomHeight = blueprint.roomHeight;
  const layoutRows = blueprint.layoutRows;
  const fallbackLayoutRows = buildFallbackLayoutRowsFromCost(estimation);
  const placementRows = layoutRows.length > 0 ? layoutRows : fallbackLayoutRows;
  const layoutSourceLabel =
    blueprint.layoutSource === "saved"
      ? "Saved coordinates from planner"
      : blueprint.layoutSource === "inferred"
        ? "Inferred placements from item quantities (legacy plan)"
        : placementRows.length > 0
          ? "Itemized entries only (coordinates unavailable)"
          : "No layout data available";

  const costItems = getEstimationCostItems(estimation);
  const costEntries = Object.entries(costItems);
  const computedTotal = costEntries.reduce((sum, [, item]) => {
    const qty = Number(item?.qty || 0) || 0;
    const unitCost = Number(item?.unitCost ?? item?.price ?? 0) || 0;
    const lineTotal = Number(item?.lineTotal ?? unitCost * qty);
    return sum + (Number.isFinite(lineTotal) ? lineTotal : 0);
  }, 0);
  const finalTotal = Number.isFinite(Number(estimation?.costTotal))
    ? Number(estimation.costTotal)
    : computedTotal;

  const generatedAtText = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const furnitureCount =
    placementRows.length > 0
      ? placementRows.length
      : getEstimatedFurnitureCount(estimation);

  const headerTop = y;
  drawMinimalisticLogo(pageWidth - margin - 15, headerTop, 15);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("ROOM PLANNER BLUEPRINT REPORT", margin, headerTop + 5.2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    "Formal Room Layout, Costing, and Supplier Recommendation Summary",
    margin,
    headerTop + 10.4,
  );

  y = headerTop + 20;
  drawHorizontalRule();

  drawMetadataRow("Project", planName);
  drawMetadataRow("Generated", generatedAtText);
  drawMetadataRow("Saved Plan Date", createdAtText);
  drawMetadataRow(
    "Room Dimensions",
    `${roomWidth.toFixed(2)} m x ${roomLength.toFixed(2)} m x ${roomHeight.toFixed(2)} m`,
  );
  drawMetadataRow(
    "Floor Area / Furniture",
    `${(roomWidth * roomLength).toFixed(2)} sq.m. / ${furnitureCount} placed item(s)`,
  );
  drawMetadataRow("Layout Source", layoutSourceLabel);
  drawHorizontalRule();

  drawSectionHeader("I. ROOM BLUEPRINT (2D TOP VIEW)");
  y += 2; // Add extra space before the section header for visual balance

  const blueprintImage = blueprint.canvas.toDataURL("image/png");
  const blueprintWidth = contentWidth - 8;
  const blueprintHeight =
    blueprintWidth * (blueprint.canvas.height / blueprint.canvas.width);
  ensureSpace(blueprintHeight + 10);

  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(
    margin + 4,
    y - 1.5,
    blueprintWidth,
    blueprintHeight + 3,
    1.5,
    1.5,
    "S",
  );
  doc.addImage(
    blueprintImage,
    "PNG",
    margin + 4,
    y,
    blueprintWidth,
    blueprintHeight,
    undefined,
    "FAST",
  );
  y += blueprintHeight + 4.5;

  if (blueprint.layoutSource === "inferred") {
    writeWrappedText(
      "Note: This plan does not include saved coordinates. Item placements in the blueprint are inferred from item quantities and room size for visual reference.",
      { fontSize: 8.4, lineHeight: 3.8 },
    );
    y += 1;
  } else if (layoutRows.length === 0 && placementRows.length > 0) {
    writeWrappedText(
      "Note: This legacy plan does not contain saved coordinates. The room blueprint is shown without plotted placements, while complete item entries are listed in the layout details table below.",
      { fontSize: 8.4, lineHeight: 3.8 },
    );
    y += 1;
  }

  drawSectionHeader("II. PLACED ITEMS LAYOUT DETAILS");

  const placementColumns = [
    { key: "no", title: "No.", width: 8, align: "center" },
    { key: "item", title: "Item", width: 54, align: "left" },
    { key: "pos", title: "Position (m)", width: 52, align: "left" },
    { key: "rot", title: "Rotation", width: 20, align: "center" },
    { key: "size", title: "Footprint (m)", width: 52, align: "left" },
  ];

  const placementRowsForReport =
    layoutRows.length > 0 ? layoutRows : placementRows;

  const drawPlacementTableHeader = () => {
    ensureSpace(7);
    let x = margin;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 6.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    placementColumns.forEach((column) => {
      const tx = column.align === "center" ? x + column.width / 2 : x + 1.6;
      doc.text(column.title, tx, y + 4.3, {
        align: column.align === "center" ? "center" : "left",
      });
      x += column.width;
    });
    y += 6.5;
  };

  if (placementRowsForReport.length === 0) {
    writeWrappedText(
      "No placed item records are available for this estimation.",
      {
        fontSize: 9,
      },
    );
  } else {
    drawPlacementTableHeader();

    placementRowsForReport.forEach((row, rowIndex) => {
      const hasPosition =
        Number.isFinite(row.positionX) && Number.isFinite(row.positionZ);
      const hasRotation = Number.isFinite(row.rotationY);
      const rowValues = {
        no: String(row.index || rowIndex + 1),
        item: `${row.itemName} (${row.modelKey})`,
        pos: hasPosition
          ? `x ${row.positionX.toFixed(2)}, z ${row.positionZ.toFixed(2)}`
          : "N/A (legacy)",
        rot: hasRotation ? `${row.rotationY}°` : "N/A",
        size: `${row.width.toFixed(2)} x ${row.depth.toFixed(2)}`,
      };

      const lineSets = placementColumns.map((column) => {
        const value = rowValues[column.key] || "";
        return doc.splitTextToSize(value, column.width - 2.4);
      });

      const lineCount = Math.max(...lineSets.map((lines) => lines.length));
      const rowLineHeight = 4.1;
      const rowTopPadding = 2.2;
      const rowBottomPadding = 2.4;
      const rowHeight = Math.max(
        7,
        lineCount * rowLineHeight + rowTopPadding + rowBottomPadding,
      );

      if (y + rowHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
        drawPlacementTableHeader();
      }

      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, rowHeight, "S");

      let x = margin;
      placementColumns.forEach((column, idx) => {
        const lines = lineSets[idx];
        const tx = column.align === "center" ? x + column.width / 2 : x + 1.4;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.9);
        doc.text(lines, tx, y + rowTopPadding + rowLineHeight - 0.4, {
          align: column.align === "center" ? "center" : "left",
        });

        x += column.width;
      });

      y += rowHeight;
    });
  }

  y += 3;
  drawSectionHeader("III. COST BREAKDOWN AND STORE RECOMMENDATION");

  const costColumns = [
    { key: "no", title: "No.", width: 8, align: "center" },
    { key: "item", title: "Item", width: 46, align: "left" },
    { key: "qty", title: "Qty", width: 12, align: "center" },
    { key: "unit", title: "Unit Cost", width: 21, align: "left" },
    { key: "line", title: "Line Total", width: 21, align: "left" },
    {
      key: "recommendation",
      title: "Recommended Supplier and Price",
      width: 78,
      align: "left",
    },
  ];

  const drawCostTableHeader = () => {
    ensureSpace(7);
    let x = margin;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 6.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.1);
    costColumns.forEach((column) => {
      const tx = column.align === "center" ? x + column.width / 2 : x + 1.4;
      doc.text(column.title, tx, y + 4.2, {
        align: column.align === "center" ? "center" : "left",
      });
      x += column.width;
    });
    y += 6.5;
  };

  if (costEntries.length === 0) {
    writeWrappedText("No itemized cost data found in this estimation.", {
      fontSize: 9,
    });
  } else {
    drawCostTableHeader();

    costEntries.forEach(([modelKey, item], index) => {
      const qty = Number(item.qty || 0) || 0;
      const unitCost = Number(item.unitCost ?? item.price ?? 0) || 0;
      const lineTotal = Number(item.lineTotal ?? unitCost * qty) || 0;
      const recommendation = getRecommendedSourceForItem(item, modelKey);
      const alternateSuppliers = Array.isArray(recommendation.sources)
        ? recommendation.sources
            .filter((source) => source.store !== recommendation.store)
            .slice(0, 2)
            .map(
              (source) =>
                `${source.store} (${formatReportCurrency(source.price)})`,
            )
            .join("; ")
        : "";

      const rowValues = {
        no: String(index + 1),
        item: `${item.name || formatModelName(modelKey)} (${modelKey})`,
        qty: String(qty),
        unit: formatReportCurrency(unitCost),
        line: formatReportCurrency(lineTotal),
        recommendation: alternateSuppliers
          ? `${recommendation.store} (${formatReportCurrency(recommendation.price)})\nOptions: ${alternateSuppliers}`
          : `${recommendation.store} (${formatReportCurrency(recommendation.price)})`,
      };

      const lineSets = costColumns.map((column) => {
        const value = rowValues[column.key] || "";
        return doc.splitTextToSize(value, column.width - 2.2);
      });

      const lineCount = Math.max(...lineSets.map((lines) => lines.length));
      const rowLineHeight = 3.9;
      const rowTopPadding = 2.1;
      const rowBottomPadding = 2.3;
      const rowHeight = Math.max(
        7,
        lineCount * rowLineHeight + rowTopPadding + rowBottomPadding,
      );

      if (y + rowHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
        drawCostTableHeader();
      }

      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, rowHeight, "S");

      let x = margin;
      costColumns.forEach((column, idx) => {
        const lines = lineSets[idx];
        const tx = column.align === "center" ? x + column.width / 2 : x + 1.3;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.6);
        doc.text(lines, tx, y + rowTopPadding + rowLineHeight - 0.4, {
          align: column.align === "center" ? "center" : "left",
        });

        x += column.width;
      });

      y += rowHeight;
    });
  }

  ensureSpace(22);
  const summaryWidth = 82;
  const summaryHeight = 17;
  const summaryX = pageWidth - margin - summaryWidth;
  doc.setDrawColor(148, 163, 184);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(summaryX, y, summaryWidth, summaryHeight, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("GRAND TOTAL", summaryX + 3, y + 5.5);
  doc.setFontSize(11.8);
  doc.text(
    formatReportCurrency(finalTotal),
    summaryX + summaryWidth - 3,
    y + 12.5,
    {
      align: "right",
    },
  );
  y += summaryHeight + 4;

  writeWrappedText(
    `All monetary values are expressed in ${REPORT_CURRENCY_CODE} (Philippine Peso).`,
    { fontSize: 8.5, lineHeight: 3.8 },
  );
  writeWrappedText(
    "Recommended store criterion: lowest available supplier price per item at report generation time.",
    { fontSize: 8.5, lineHeight: 3.8 },
  );

  const fileName = `${slugifyFileName(planName)}-blueprint-report.pdf`;
  doc.save(fileName);
}

/**
 * Handle logout
 */
async function handleLogout() {
  const result = await signOut();
  if (result.success) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: "planner-dashboard-signed-out" },
        window.location.origin,
      );
      return;
    }
    window.location.href = "planner.html";
  } else {
    await showDialog("Error signing out: " + result.error, "Error");
  }
}

/**
 * Show error message
 */
function showError(message) {
  const errorEl = document.getElementById("error");
  const errorText = document.getElementById("error-text");
  errorText.textContent = message;
  errorEl.style.display = "block";
}

// Initialize on page load
window.addEventListener("load", async () => {
  await initProfile();
});

function formatCurrency(value) {
  const number = Number(value) || 0;
  return `₱${number.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

window.downloadPlanPdf = downloadPlanPdf;
