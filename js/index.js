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

    const bedModelCandidates = isPremium ? ["bed2", "bed1"] : ["bed1", "bed2"];
    const deskModelCandidates = isPremium
      ? ["desk2", "desk1"]
      : ["desk1", "desk2"];
    const chairModelCandidates = isPremium
      ? ["chair2", "chair1"]
      : ["chair1", "chair2"];
    const wardrobeModelCandidates = isPremium
      ? ["wardrobe2", "wardrobe1", "wardrobe3"]
      : isComfort
        ? ["wardrobe1", "wardrobe2", "wardrobe3"]
        : ["wardrobe3", "wardrobe1", "wardrobe2"];
    const shelfModelCandidates = isPremium
      ? ["shelf2", "shelf1"]
      : ["shelf1", "shelf2"];
    const tableModelCandidates = isPremium
      ? ["center_table2", "center_table1", "table1"]
      : ["center_table1", "table1", "center_table2"];

    const labelByModelKey = {
      bed1: "Bed",
      bed2: "Bed",
      wardrobe1: "Wardrobe",
      wardrobe2: "Wardrobe",
      wardrobe3: "Wardrobe",
      desk1: "Study Desk",
      desk2: "Study Desk",
      chair1: "Office Chair",
      chair2: "Office Chair",
      shelf1: "Shelf 1",
      shelf2: "Shelf 2",
      center_table1: "Center Table 1",
      center_table2: "Center Table 2",
      table1: "Table 1",
      mirror1: "Mirror 1",
    };

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
      table1: 11000,
      mirror1: 2500,
    };

    let startingCost = 0;

    let omitted_items = [];
    const omitted_item_reasons = new Map();

    const addOmittedItem = (label, reason = "space") => {
      const normalizedLabel = typeof label === "string" ? label.trim() : "";
      if (!normalizedLabel) return;

      const normalizedReason = reason === "budget" ? "budget" : "space";
      const existingReason = omitted_item_reasons.get(normalizedLabel);
      if (
        !existingReason ||
        (existingReason === "budget" && normalizedReason === "space")
      ) {
        omitted_item_reasons.set(normalizedLabel, normalizedReason);
      }

      if (!omitted_items.includes(normalizedLabel)) {
        omitted_items.push(normalizedLabel);
      }
    };

    const getModelPrice = (modelKey) => Number(localModelPrices[modelKey] || 0);

    const canAddModelWithinBudget = (modelKey) => {
      return startingCost + getModelPrice(modelKey) <= budget + 0.01;
    };

    // Use conservative real-model footprints so premade layouts match the
    // runtime collision model and avoid post-load overlaps.
    const itemFootprints = {
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
    };

    const WALL_THICKNESS = 0.1;
    const DRAG_BOUNDARY_MARGIN = 0.1;
    const PREMADE_EDGE_BUFFER = 0.04;

    const normalizeRightAngle = (deg = 0) => {
      return (((Math.round(Number(deg || 0) / 90) * 90) % 360) + 360) % 360;
    };

    const getFootprint = (key, rot = { x: 0, y: 0, z: 0 }) => {
      const base = itemFootprints[key] || { w: 1.0, d: 1.0 };
      const snappedY = normalizeRightAngle(rot?.y || 0);
      const isQuarterTurn = snappedY === 90 || snappedY === 270;
      return isQuarterTurn
        ? { w: base.d, d: base.w }
        : { w: base.w, d: base.d };
    };

    const getBoundaryPadding = (key, rot = { x: 0, y: 0, z: 0 }) => {
      const fp = getFootprint(key, rot);
      const inset = WALL_THICKNESS + DRAG_BOUNDARY_MARGIN + PREMADE_EDGE_BUFFER;
      return {
        x: fp.w / 2 + inset,
        z: fp.d / 2 + inset,
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

    const getCategory = (modelKey = "") => {
      const id = String(modelKey || "").toLowerCase();
      if (id.includes("chair")) return "chair";
      if (id.includes("desk")) return "desk";
      if (id.includes("bed")) return "bed";
      if (id.includes("wardrobe")) return "wardrobe";
      if (id.includes("shelf")) return "shelf";
      if (id.includes("table")) return "table";
      return "other";
    };

    const getPairClearance = (keyA, keyB) => {
      const a = getCategory(keyA);
      const b = getCategory(keyB);

      let clearance = 0.12;

      const isChairDesk =
        (a === "chair" && b === "desk") || (a === "desk" && b === "chair");
      if (isChairDesk) {
        return 0.1;
      }

      if (a === "chair" || b === "chair") {
        clearance = 0.15;
      }

      const hasLargeA = a === "bed" || a === "wardrobe" || a === "shelf";
      const hasLargeB = b === "bed" || b === "wardrobe" || b === "shelf";
      if (hasLargeA || hasLargeB) {
        clearance = Math.max(clearance, 0.18);
      }

      if ((a === "chair" && hasLargeB) || (b === "chair" && hasLargeA)) {
        clearance = Math.max(clearance, 0.26);
      }

      return clearance;
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

        const clearance = getPairClearance(key, existing.model_key);

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
      const fp = getFootprint(key, rot);

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
        { x: 0, z: 0 },
        { x: edgeXMin, z: edgeZMin },
        { x: edgeXMax, z: edgeZMin },
        { x: edgeXMin, z: edgeZMax },
        { x: edgeXMax, z: edgeZMax },
        { x: 0, z: edgeZMin },
        { x: 0, z: edgeZMax },
        { x: edgeXMin, z: 0 },
        { x: edgeXMax, z: 0 },
      );

      const wallStep = Math.max(
        0.24,
        Math.min(0.6, Math.max(fp.w, fp.d) * 0.55),
      );

      for (let x = edgeXMin; x <= edgeXMax + 0.001; x += wallStep) {
        candidates.push({ x, z: edgeZMin }, { x, z: edgeZMax });
      }

      for (let z = edgeZMin; z <= edgeZMax + 0.001; z += wallStep) {
        candidates.push({ x: edgeXMin, z }, { x: edgeXMax, z });
      }

      const gridStepX = Math.max(0.24, Math.min(0.55, fp.w * 0.55));
      const gridStepZ = Math.max(0.24, Math.min(0.55, fp.d * 0.55));

      for (let x = edgeXMin; x <= edgeXMax + 0.001; x += gridStepX) {
        for (let z = edgeZMin; z <= edgeZMax + 0.001; z += gridStepZ) {
          candidates.push({ x, z });
        }
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

      const wantsCenter = key.includes("center_table");

      unique.sort((a, b) => {
        const anchorA = (a.x - pos.x) ** 2 + (a.z - pos.z) ** 2;
        const anchorB = (b.x - pos.x) ** 2 + (b.z - pos.z) ** 2;

        const centerA = a.x ** 2 + a.z ** 2;
        const centerB = b.x ** 2 + b.z ** 2;

        const wallA = Math.min(
          Math.abs(a.x - edgeXMin),
          Math.abs(a.x - edgeXMax),
          Math.abs(a.z - edgeZMin),
          Math.abs(a.z - edgeZMax),
        );
        const wallB = Math.min(
          Math.abs(b.x - edgeXMin),
          Math.abs(b.x - edgeXMax),
          Math.abs(b.z - edgeZMin),
          Math.abs(b.z - edgeZMax),
        );

        let scoreA = anchorA;
        let scoreB = anchorB;

        if (wantsCenter) {
          scoreA += centerA * 0.7;
          scoreB += centerB * 0.7;
        } else if (!key.includes("chair")) {
          scoreA += wallA * 0.3;
          scoreB += wallB * 0.3;
        }

        return scoreA - scoreB;
      });

      return unique;
    };

    const getRotationCandidates = (key, rot) => {
      const normalized = {
        x: Number(rot?.x || 0),
        y: normalizeRightAngle(rot?.y || 0),
        z: Number(rot?.z || 0),
      };

      if (key.includes("mirror")) {
        return [normalized];
      }

      const altY = normalizeRightAngle(normalized.y + 90);
      if (altY === normalized.y) {
        return [normalized];
      }

      return [normalized, { ...normalized, y: altY }];
    };

    // Helper to safely add an item checking budget, bounds, and overlaps.
    const pushItem = (modelCandidates, pos, rot, itemName = "Item") => {
      const candidateKeys = Array.isArray(modelCandidates)
        ? modelCandidates
        : [modelCandidates];
      let bestPlacement = null;
      let hasAffordableCandidate = false;

      candidateKeys.forEach((key, keyIndex) => {
        if (!canAddModelWithinBudget(key)) {
          return;
        }

        hasAffordableCandidate = true;

        const rotationCandidates = getRotationCandidates(key, rot);

        for (const candidateRot of rotationCandidates) {
          const pad = getBoundaryPadding(key, candidateRot);
          const padX = pad.x;
          const padZ = pad.z;

          if (padX >= halfW || padZ >= halfL) {
            continue;
          }

          const candidates = buildPlacementCandidates(
            key,
            pos,
            candidateRot,
            padX,
            padZ,
          );

          for (const candidate of candidates) {
            if (!isInsideBounds(candidate.x, candidate.z, padX, padZ)) continue;
            if (isOverlappingAt(key, candidateRot, candidate.x, candidate.z)) {
              continue;
            }

            // Keep preferred variants slightly favored while still allowing
            // cheaper fallbacks when they fit better.
            const variantPenalty = keyIndex * 0.03;
            const score =
              (candidate.x - pos.x) ** 2 +
              (candidate.z - pos.z) ** 2 +
              (candidateRot.y === normalizeRightAngle(rot?.y || 0) ? 0 : 0.04) +
              variantPenalty;

            if (!bestPlacement || score < bestPlacement.score) {
              bestPlacement = {
                key,
                price: getModelPrice(key),
                score,
                pos: candidate,
                rot: candidateRot,
              };
            }
          }
        }
      });

      if (!bestPlacement) {
        if (itemName !== "Item") {
          addOmittedItem(itemName, hasAffordableCandidate ? "space" : "budget");
        }

        return {
          placed: false,
          reason: hasAffordableCandidate ? "space" : "budget",
        };
      }

      furniture_data.push({
        model_key: bestPlacement.key,
        position: {
          x: bestPlacement.pos.x,
          y: pos.y,
          z: bestPlacement.pos.z,
        },
        rotation: bestPlacement.rot,
        scale: { x: 1, y: 1, z: 1 },
      });

      startingCost += bestPlacement.price;

      return {
        placed: true,
        reason: null,
      };
    };

    // Mirrors are wall-mounted, so they should use free wall space
    // instead of competing with floor area constraints.
    const pushWallMirror = (key, itemName = "Mirror 1") => {
      if (!canAddModelWithinBudget(key)) {
        addOmittedItem(itemName, "budget");
        return {
          placed: false,
          reason: "budget",
        };
      }

      const minY = 0.8;
      const maxY = Math.max(minY, heightM - 0.5);
      const mirrorY = Math.max(minY, Math.min(maxY, heightM * 0.45));
      const wallThickness = 0.1;
      const innerZ = halfL - wallThickness / 2;
      const mirrorWallOffset = 0.06;

      furniture_data.push({
        model_key: key,
        position: { x: 0, y: mirrorY, z: -innerZ + mirrorWallOffset },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      });

      startingCost += getModelPrice(key);

      return {
        placed: true,
        reason: null,
      };
    };

    const isFloorItem = (item) => {
      return !String(item?.model_key || "").includes("mirror");
    };

    const isStrictlyInsideBounds = (item) => {
      const footprint = getFootprint(
        item.model_key,
        item.rotation || { x: 0, y: 0, z: 0 },
      );
      const inset = WALL_THICKNESS + DRAG_BOUNDARY_MARGIN + PREMADE_EDGE_BUFFER;
      const padX = footprint.w / 2 + inset;
      const padZ = footprint.d / 2 + inset;
      return isInsideBounds(item.position.x, item.position.z, padX, padZ);
    };

    const hasStrictConflict = (candidate, placedItems) => {
      const candidateFp = getFootprint(
        candidate.model_key,
        candidate.rotation || { x: 0, y: 0, z: 0 },
      );

      for (const existing of placedItems) {
        const existingFp = getFootprint(
          existing.model_key,
          existing.rotation || { x: 0, y: 0, z: 0 },
        );

        const dx = Math.abs(existing.position.x - candidate.position.x);
        const dz = Math.abs(existing.position.z - candidate.position.z);

        const clearance =
          getPairClearance(candidate.model_key, existing.model_key) + 0.04;

        const allowedX = (candidateFp.w + existingFp.w) / 2 + clearance;
        const allowedZ = (candidateFp.d + existingFp.d) / 2 + clearance;

        if (dx < allowedX && dz < allowedZ) {
          return true;
        }
      }

      return false;
    };

    const sanitizePremadeLayout = () => {
      const floorItems = furniture_data.filter((item) => isFloorItem(item));
      const wallMountedItems = furniture_data.filter(
        (item) => !isFloorItem(item),
      );
      const sanitized = [];

      for (const item of floorItems) {
        const modelKey = String(item.model_key || "");

        if (modelKey.includes("chair")) {
          const hasDeskPlaced = sanitized.some((placed) =>
            String(placed.model_key || "").includes("desk"),
          );
          if (!hasDeskPlaced) {
            addOmittedItem(labelByModelKey[modelKey] || "Office Chair");
            continue;
          }
        }

        if (!isStrictlyInsideBounds(item)) {
          addOmittedItem(labelByModelKey[modelKey] || "Item");
          continue;
        }

        if (hasStrictConflict(item, sanitized)) {
          addOmittedItem(labelByModelKey[modelKey] || "Item");
          continue;
        }

        sanitized.push(item);
      }

      furniture_data = [...sanitized, ...wallMountedItems];
      startingCost = furniture_data.reduce((sum, item) => {
        return sum + getModelPrice(item.model_key);
      }, 0);
    };

    // 1. Bed (Essential) - Placed in Back Left corner
    pushItem(
      bedModelCandidates,
      { x: -halfW + 0.55, y: 0, z: -halfL + 0.65 },
      { x: 0, y: 0, z: 0 },
      "Bed",
    );

    // 2. Wardrobe (Essential) - Placed in Back Right corner
    pushItem(
      wardrobeModelCandidates,
      { x: halfW - 0.45, y: 0, z: -halfL + 0.45 },
      { x: 0, y: -90, z: 0 },
      "Wardrobe",
    );

    // 3. Desk & Chair - Only if room is > 7.5 sqm (approx 9x9 ft)
    if (roomArea > 7.5) {
      const deskPlacement = pushItem(
        deskModelCandidates,
        { x: halfW - 0.45, y: 0, z: halfL - 0.55 },
        { x: 0, y: -90, z: 0 },
        "Study Desk",
      );

      if (deskPlacement?.placed) {
        pushItem(
          chairModelCandidates,
          { x: halfW - 0.95, y: 0, z: halfL - 1.3 },
          { x: 0, y: 90, z: 0 },
          "Office Chair",
        );
      } else {
        addOmittedItem(
          "Office Chair",
          deskPlacement?.reason === "budget" ? "budget" : "space",
        );
      }
    } else {
      addOmittedItem("Study Desk");
      addOmittedItem("Office Chair");
    }

    // 4. Shelf - If budget allows AND room is > 10 sqm
    if (isComfort || isPremium) {
      if (roomArea > 10) {
        pushItem(
          shelfModelCandidates,
          { x: -halfW + 0.4, y: 0, z: halfL - 0.4 },
          { x: 0, y: 90, z: 0 },
          "Shelf",
        );
      } else {
        addOmittedItem("Shelf");
      }
    }

    // 5. Center Table & Mirror (Luxury) - Only if Premium/Comfort AND room is huge > 14 sqm
    if (isComfort || isPremium) {
      if (roomArea > 14) {
        pushItem(
          tableModelCandidates,
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 90, z: 0 },
          "Center Table",
        );
      } else {
        addOmittedItem("Center Table");
      }
    }

    if (isPremium) {
      pushWallMirror("mirror1", "Mirror 1");
    }

    sanitizePremadeLayout();

    const generatedCostItems = {};
    furniture_data.forEach((item) => {
      const key = String(item.model_key || "");
      if (!key) return;

      if (!generatedCostItems[key]) {
        const unitCost = getModelPrice(key);
        generatedCostItems[key] = {
          name: labelByModelKey[key] || key,
          price: unitCost,
          unitCost,
          qty: 0,
        };
      }

      generatedCostItems[key].qty += 1;
    });

    const generatedCostTotal = Object.values(generatedCostItems).reduce(
      (sum, item) => sum + item.unitCost * item.qty,
      0,
    );
    startingCost = generatedCostTotal;

    const defaultRoomState = {
      room_width: widthM,
      room_length: lengthM,
      room_height: heightM,
      furniture_data: furniture_data,
      cost_total: generatedCostTotal,
      costState: {
        items: generatedCostItems,
        total: generatedCostTotal,
        baseTotal: 0,
      },
      furnitureCounter: furniture_data.length,
    };

    const omitted_items_meta = omitted_items.map((label) => ({
      label,
      reason: omitted_item_reasons.get(label) || "space",
    }));

    localStorage.setItem("currentRoomState", JSON.stringify(defaultRoomState));
    localStorage.setItem("omittedItems", JSON.stringify(omitted_items));
    localStorage.setItem(
      "omittedItemsMeta",
      JSON.stringify(omitted_items_meta),
    );
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
