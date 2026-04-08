document.addEventListener("DOMContentLoaded", function () {
  // Expose function to global scope directly here as well
  window.startPlanner = function () {
    const budgetInput = document.getElementById("project-budget");
    const widthInput = document.getElementById("room-width");
    const lengthInput = document.getElementById("room-length");
    const heightInput = document.getElementById("room-height");

    const budget = parseFloat(budgetInput.value);
    const width = parseFloat(widthInput.value);
    const length = parseFloat(lengthInput.value);
    const height = parseFloat(heightInput.value);

    // Validation
    if (!budget) {
      showDialog("Please enter a project budget", "Validation Error");
      return;
    }

    if (budget <= 0) {
      showDialog(
        "Please enter a valid budget amount greater than 0",
        "Validation Error",
      );
      return;
    }

    if (!width || !length || !height) {
      showDialog(
        "Please enter width, length, and height dimensions",
        "Validation Error",
      );
      return;
    }

    if (
      width < 1 ||
      width > 20 ||
      length < 1 ||
      length > 20 ||
      height < 1 ||
      height > 20
    ) {
      showDialog(
        "Please enter dimensions between 1ft and 20ft",
        "Validation Error",
      );
      return;
    }

    // Convert feet to meters for internal storage (planner uses meters)
    const M_PER_FT = 0.3048;
    const widthM = +(width * M_PER_FT).toFixed(2);
    const lengthM = +(length * M_PER_FT).toFixed(2);
    const heightM = +(height * M_PER_FT).toFixed(2);

    localStorage.setItem("projectBudget", budget);
    localStorage.setItem("roomWidth", widthM);
    localStorage.setItem("roomLength", lengthM);
    localStorage.setItem("roomHeight", heightM);

    // Auto-populate room dynamically based on both BUDGET and ROOM SIZE
    // This prevents overlap in small rooms and reduces lag from too many objects
    const halfW = widthM / 2;
    const halfL = lengthM / 2;
    const roomArea = widthM * lengthM; // in Square Meters
    let furniture_data = [];

    // Determine model quality based on budget
    const isPremium = budget >= 30000;
    const isComfort = budget >= 10000 && budget < 30000;

    const bedKey = isPremium ? "bed2" : "bed1";
    const deskKey = isPremium ? "desk2" : "desk1";
    const chairKey = isPremium ? "chair2" : "chair1";
    const wardrobeKey = isPremium
      ? "wardrobe2"
      : isComfort
        ? "wardrobe1"
        : "wardrobe3";
    const shelfKey = isPremium ? "shelf2" : "shelf1";
    const tableKey = isPremium ? "center_table2" : "center_table1";
    const shelfLabel = shelfKey === "shelf2" ? "Shelf 2" : "Shelf 1";
    const tableLabel =
      tableKey === "center_table2" ? "Center Table 2" : "Center Table 1";

    const localModelPrices = {
      bed1: 25000,
      bed2: 30000,
      wardrobe1: 11950,
      wardrobe2: 14950,
      wardrobe3: 17950,
      desk1: 18000,
      desk2: 22000,
      chair1: 3500,
      chair2: 4500,
      shelf1: 8500,
      shelf2: 11500,
      center_table1: 12000,
      center_table2: 15000,
      mirror1: 2500,
    };

    let startingCost = 0;

    let omitted_items = [];

    // Approximate floor footprints (meters) used for premade conflict checks.
    const itemFootprints = {
      bed1: { w: 1.7, d: 1.8 },
      bed2: { w: 1.75, d: 1.9 },
      wardrobe1: { w: 1.0, d: 0.7 },
      wardrobe2: { w: 1.0, d: 0.75 },
      wardrobe3: { w: 1.0, d: 0.7 },
      desk1: { w: 1.1, d: 0.65 },
      desk2: { w: 1.2, d: 0.7 },
      chair1: { w: 0.85, d: 0.9 },
      chair2: { w: 0.85, d: 0.9 },
      shelf1: { w: 1.1, d: 0.6 },
      shelf2: { w: 1.1, d: 0.6 },
      center_table1: { w: 1.0, d: 0.7 },
      center_table2: { w: 1.0, d: 0.7 },
      table1: { w: 1.0, d: 0.7 },
    };

    const getFootprint = (key, rot = { x: 0, y: 0, z: 0 }) => {
      const base = itemFootprints[key] || { w: 0.9, d: 0.9 };
      const rawY = Number(rot?.y || 0);
      const snappedY = (((Math.round(rawY / 90) * 90) % 360) + 360) % 360;
      const isQuarterTurn = snappedY === 90 || snappedY === 270;
      return isQuarterTurn
        ? { w: base.d, d: base.w }
        : { w: base.w, d: base.d };
    };

    const getBoundaryPadding = (key, rot = { x: 0, y: 0, z: 0 }) => {
      const fp = getFootprint(key, rot);
      return {
        x: fp.w / 2 + 0.06,
        z: fp.d / 2 + 0.06,
      };
    };

    const clampPosToBounds = (x, z, padX, padZ) => ({
      x: Math.max(-halfW + padX, Math.min(halfW - padX, x)),
      z: Math.max(-halfL + padZ, Math.min(halfL - padZ, z)),
    });

    const isInsideBounds = (x, z, padX, padZ) => {
      return (
        x <= halfW - padX &&
        x >= -halfW + padX &&
        z <= halfL - padZ &&
        z >= -halfL + padZ
      );
    };

    const isOverlappingAt = (key, rot, x, z) => {
      const footprint = getFootprint(key, rot);

      for (let existing of furniture_data) {
        const existingFp = getFootprint(
          existing.model_key,
          existing.rotation || { x: 0, y: 0, z: 0 },
        );

        const dx = Math.abs(existing.position.x - x);
        const dz = Math.abs(existing.position.z - z);

        let clearance = 0.11;
        const chairDeskPair =
          (key.includes("chair") && existing.model_key.includes("desk")) ||
          (key.includes("desk") && existing.model_key.includes("chair"));
        if (chairDeskPair) clearance = 0.08;
        else if (
          key.includes("chair") ||
          existing.model_key.includes("chair")
        ) {
          clearance = 0.1;
        }

        const involvesLargeItem =
          key.includes("bed") ||
          existing.model_key.includes("bed") ||
          key.includes("wardrobe") ||
          existing.model_key.includes("wardrobe") ||
          key.includes("shelf") ||
          existing.model_key.includes("shelf");
        if (involvesLargeItem) {
          clearance = Math.max(clearance, 0.13);
        }

        const chairLargePair =
          (key.includes("chair") &&
            (existing.model_key.includes("bed") ||
              existing.model_key.includes("wardrobe") ||
              existing.model_key.includes("shelf"))) ||
          (existing.model_key.includes("chair") &&
            (key.includes("bed") ||
              key.includes("wardrobe") ||
              key.includes("shelf")));
        if (chairLargePair) {
          clearance = Math.max(clearance, 0.2);
        }

        const allowedX = (footprint.w + existingFp.w) / 2 + clearance;
        const allowedZ = (footprint.d + existingFp.d) / 2 + clearance;

        if (dx < allowedX && dz < allowedZ) {
          return true;
        }
      }

      return false;
    };

    const buildPlacementCandidates = (key, pos, rot, padX, padZ) => {
      const clamped = clampPosToBounds(pos.x, pos.z, padX, padZ);
      const edgeXMin = -halfW + padX;
      const edgeXMax = halfW - padX;
      const edgeZMin = -halfL + padZ;
      const edgeZMax = halfL - padZ;

      const candidates = [];

      // For chairs, first try to seat around any placed desk.
      if (key.includes("chair")) {
        const desk = [...furniture_data]
          .reverse()
          .find((entry) => String(entry.model_key || "").includes("desk"));

        if (desk) {
          const chairFp = getFootprint(key, rot);
          const deskFp = getFootprint(
            desk.model_key,
            desk.rotation || { x: 0, y: 0, z: 0 },
          );

          const seatGap = 0.16;
          const xOffset = (deskFp.w + chairFp.w) / 2 + seatGap;
          const zOffset = (deskFp.d + chairFp.d) / 2 + seatGap;

          candidates.push(
            { x: desk.position.x - xOffset, z: desk.position.z },
            { x: desk.position.x + xOffset, z: desk.position.z },
            { x: desk.position.x, z: desk.position.z - zOffset },
            { x: desk.position.x, z: desk.position.z + zOffset },
          );
        }
      }

      candidates.push(
        { x: pos.x, z: pos.z },
        { x: clamped.x, z: clamped.z },
        { x: edgeXMin, z: edgeZMin },
        { x: edgeXMax, z: edgeZMin },
        { x: edgeXMin, z: edgeZMax },
        { x: edgeXMax, z: edgeZMax },
        { x: 0, z: edgeZMin },
        { x: 0, z: edgeZMax },
        { x: edgeXMin, z: 0 },
        { x: edgeXMax, z: 0 },
      );

      if (!key.includes("chair")) {
        candidates.push({ x: 0, z: 0 });
      }

      // De-duplicate and prioritize nearest to intended anchor.
      const unique = [];
      const seen = new Set();
      candidates.forEach((c) => {
        const keyStr = `${c.x.toFixed(3)}_${c.z.toFixed(3)}`;
        if (!seen.has(keyStr)) {
          seen.add(keyStr);
          unique.push(c);
        }
      });

      unique.sort((a, b) => {
        const da = (a.x - pos.x) ** 2 + (a.z - pos.z) ** 2;
        const db = (b.x - pos.x) ** 2 + (b.z - pos.z) ** 2;
        return da - db;
      });

      return unique;
    };

    // Helper to safely add an item checking bounds and overlaps
    const pushItem = (key, pos, rot, itemName = "Item") => {
      const pad = getBoundaryPadding(key, rot);
      let padX = Math.min(pad.x, Math.max(0.15, halfW - 0.1));
      let padZ = Math.min(pad.z, Math.max(0.15, halfL - 0.1));

      const candidates = buildPlacementCandidates(key, pos, rot, padX, padZ);
      let placed = null;

      for (const candidate of candidates) {
        if (!isInsideBounds(candidate.x, candidate.z, padX, padZ)) continue;
        if (isOverlappingAt(key, rot, candidate.x, candidate.z)) continue;
        placed = candidate;
        break;
      }

      if (!placed) {
        if (!omitted_items.includes(itemName) && itemName !== "Item") {
          omitted_items.push(itemName);
        }
        return;
      }

      furniture_data.push({
        model_key: key,
        position: { x: placed.x, y: pos.y, z: placed.z },
        rotation: rot,
        scale: { x: 1, y: 1, z: 1 },
      });

      if (localModelPrices[key]) {
        startingCost += localModelPrices[key];
      }
    };

    // Mirrors are wall-mounted, so they should use free wall space
    // instead of competing with floor area constraints.
    const pushWallMirror = (key, itemName = "Mirror 1") => {
      const minY = 0.8;
      const maxY = Math.max(minY, heightM - 0.5);
      const mirrorY = Math.max(minY, Math.min(maxY, heightM * 0.45));

      furniture_data.push({
        model_key: key,
        position: { x: 0, y: mirrorY, z: -halfL + 0.04 },
        rotation: { x: 0, y: 180, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      });

      if (localModelPrices[key]) {
        startingCost += localModelPrices[key];
      }
    };

    // 1. Bed (Essential) - Placed in Back Left corner
    pushItem(
      bedKey,
      { x: -halfW + 0.55, y: 0, z: -halfL + 0.65 },
      { x: 0, y: 0, z: 0 },
      "Bed",
    );

    // 2. Wardrobe (Essential) - Placed in Back Right corner
    pushItem(
      wardrobeKey,
      { x: halfW - 0.45, y: 0, z: -halfL + 0.45 },
      { x: 0, y: -90, z: 0 },
      "Wardrobe",
    );

    // 3. Desk & Chair - Only if room is > 7.5 sqm (approx 9x9 ft)
    if (roomArea > 7.5) {
      pushItem(
        deskKey,
        { x: halfW - 0.45, y: 0, z: halfL - 0.55 },
        { x: 0, y: -90, z: 0 },
        "Study Desk",
      );
      pushItem(
        chairKey,
        { x: halfW - 0.95, y: 0, z: halfL - 1.3 },
        { x: 0, y: 90, z: 0 },
        "Office Chair",
      );
    } else {
      omitted_items.push("Study Desk");
      omitted_items.push("Office Chair");
    }

    // 4. Shelf - If budget allows AND room is > 10 sqm
    if (isComfort || isPremium) {
      if (roomArea > 10) {
        pushItem(
          shelfKey,
          { x: -halfW + 0.4, y: 0, z: halfL - 0.4 },
          { x: 0, y: 90, z: 0 },
          shelfLabel,
        );
      } else {
        omitted_items.push(shelfLabel);
      }
    }

    // 5. Center Table & Mirror (Luxury) - Only if Premium/Comfort AND room is huge > 14 sqm
    if (isComfort || isPremium) {
      if (roomArea > 14) {
        pushItem(
          tableKey,
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 90, z: 0 },
          tableLabel,
        );
      } else {
        omitted_items.push(tableLabel);
      }
    }

    if (isPremium) {
      pushWallMirror("mirror1", "Mirror 1");
    }

    const defaultRoomState = {
      room_width: widthM,
      room_length: lengthM,
      room_height: heightM,
      furniture_data: furniture_data,
      cost_total: startingCost,
      furnitureCounter: furniture_data.length,
    };

    localStorage.setItem("currentRoomState", JSON.stringify(defaultRoomState));
    localStorage.setItem("omittedItems", JSON.stringify(omitted_items));
    localStorage.removeItem("workspaceState"); // Clear legacy state

    // Navigate directly to planner - loading is handled there
    window.location.href = "planner.html";
  };

  // Allow Enter key to start planner
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      if (typeof window.startPlanner === "function") {
        window.startPlanner();
      }
    }
  });

  // Set up input event listeners (focus is handled by preloader after loading completes)

  // Add tab navigation between inputs
  const inputs = ["room-width", "room-length", "room-height"];
  inputs.forEach((id, index) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          if (index < inputs.length - 1) {
            e.preventDefault();
            document.getElementById(inputs[index + 1]).focus();
          } else {
            if (typeof window.startPlanner === "function")
              window.startPlanner();
          }
        }
      });
    }
  });

  const budgetInput = document.getElementById("project-budget");
  if (budgetInput) {
    budgetInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        if (typeof window.startPlanner === "function") window.startPlanner();
      }
    });
    budgetInput.addEventListener("input", handleBudgetChange);
  }

  const startBtn = document.getElementById("start-btn");
  if (startBtn) {
    startBtn.addEventListener("click", window.startPlanner);
  }
});

function handleBudgetChange(e) {
  const budget = parseFloat(e.target.value);
  const wrapper = document.getElementById("recommendation-wrapper");
  const content = document.getElementById("recommendation-content");

  if (!wrapper || !content) return;

  if (!budget || isNaN(budget) || budget <= 0) {
    content.innerHTML = `<div class="recommendation-placeholder">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
      <span>Enter budget to see recommendations</span>
    </div>`;
    return;
  }

  let templateInfo = null;

  if (budget < 10000) {
    templateInfo = {
      name: "Basic Essentials",
      desc: "Perfect starting point with essential furniture.",
      img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 400 250'><rect width='400' height='250' fill='%232a2a2a'/><path d='M100 150 L300 150 L250 100 L150 100 Z' fill='%234a4a4a'/><rect x='180' y='80' width='40' height='40' fill='%236a6a6a'/><text x='200' y='210' font-family='sans-serif' font-size='16' fill='%23ffffff' text-anchor='middle'>Basic Setup</text></svg>",
      color: "#4ade80",
    };
  } else if (budget < 30000) {
    templateInfo = {
      name: "Standard Comfort",
      desc: "A well-rounded room with additional decor.",
      img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 400 250'><rect width='400' height='250' fill='%232a2a3a'/><path d='M80 160 L320 160 L260 90 L140 90 Z' fill='%234a4a5a'/><rect x='150' y='70' width='100' height='50' fill='%236a6a7a'/><circle cx='100' cy='120' r='15' fill='%238a8a9a'/><text x='200' y='210' font-family='sans-serif' font-size='16' fill='%23ffffff' text-anchor='middle'>Comfort Setup</text></svg>",
      color: "#60a5fa",
    };
  } else {
    templateInfo = {
      name: "Premium Living",
      desc: "Fully furnished with high-end items.",
      img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 400 250'><rect width='400' height='250' fill='%233a2a2a'/><path d='M60 170 L340 170 L280 80 L120 80 Z' fill='%235a4a4a'/><rect x='130' y='60' width='140' height='50' fill='%237a6a6a'/><circle cx='90' cy='110' r='20' fill='%239a8a8a'/><rect x='300' y='90' width='30' height='60' fill='%238a7a7a'/><text x='200' y='210' font-family='sans-serif' font-size='16' fill='%23ffffff' text-anchor='middle'>Premium Setup</text></svg>",
      color: "#c084fc",
    };
  }

  content.innerHTML = `
    <div style="width: 100%; height: 100%; position: relative;">
      <img src="${templateInfo.img}" class="recommendation-image" alt="${templateInfo.name}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0; animation: fadeIn 0.5s forwards;">
      <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); padding: 8px 10px; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
        <div style="color: ${templateInfo.color}; font-weight: bold; font-size: 0.9rem; margin-bottom: 2px;">${templateInfo.name}</div>
        <div style="color: rgba(255,255,255,0.7); font-size: 0.7rem; line-height: 1.2;">${templateInfo.desc}</div>
      </div>
    </div>
  `;
}
