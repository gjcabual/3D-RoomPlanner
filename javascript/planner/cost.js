const PRICE_LIST = {
  table1: 8500, // ₱8,500 dummy price for center table
  wardrobe1: 12000, // ₱12,000 dummy price for wardrobe 1
  wardrobe2: 15000, // ₱15,000 dummy price for wardrobe 2
  wardrobe3: 18000, // ₱18,000 dummy price for wardrobe 3
};
const costState = {
  items: {}, // key -> {name, price, qty}
  total: 0,
};

function addItemToCost(modelKey, displayName) {
  const price = PRICE_LIST[modelKey] || 0;
  if (!costState.items[modelKey]) {
    costState.items[modelKey] = {
      name: displayName,
      price: price,
      qty: 0,
    };
  }
  costState.items[modelKey].qty += 1;
  renderCost();
}

function peso(n) {
  return `₱${Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Some MSDF fonts in a-text may not include the peso glyph.
// Use a 3D-safe fallback for in-scene text.
function peso3D(n) {
  return `PHP ${Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function renderCost() {
  // Update HTML panel if present
  const itemsContainer = document.getElementById("cost-items");
  if (itemsContainer) {
    itemsContainer.innerHTML = "";
  }
  let total = 0;
  // Update 3D board lines
  const linesRoot = document.getElementById("cost-lines");
  if (linesRoot) {
    while (linesRoot.firstChild) linesRoot.removeChild(linesRoot.firstChild);
  }
  let y = 0; // start at 0, step down per line
  Object.keys(costState.items).forEach((key) => {
    const item = costState.items[key];
    const lineTotal = item.price * item.qty;
    total += lineTotal;
    // HTML list (if exists)
    if (itemsContainer) {
      const row = document.createElement("div");
      row.className = "cost-item";
      row.innerHTML = `
                <div>
                  <div class="cost-item-name">${item.name}</div>
                  <div class="cost-item-meta">${item.qty} × ${peso(
        item.price
      )}</div>
                </div>
                <div>${peso(lineTotal)}</div>
              `;
      itemsContainer.appendChild(row);
    }
    // 3D board line
    if (linesRoot) {
      const line = document.createElement("a-text");
      line.setAttribute(
        "value",
        `${item.name} x ${item.qty} = ${peso3D(lineTotal)}`
      );
      line.setAttribute("color", "#333");
      line.setAttribute("position", `0 ${y.toFixed(2)} 0`);
      line.setAttribute("width", "2.6");
      linesRoot.appendChild(line);
      y -= 0.18; // line spacing
    }
  });
  costState.total = total;
  const totalEl = document.getElementById("cost-total");
  if (totalEl) totalEl.textContent = peso(total);
  const total3D = document.getElementById("cost-total-text");
  if (total3D) total3D.setAttribute("value", `Total: ${peso3D(total)}`);
}
