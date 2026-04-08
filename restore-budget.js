const fs = require('fs');
let c = fs.readFileSync('js/index.js', 'utf8');

c = c.replace(
`    const budgetInput = document.getElementById("project-budget");
    if (budgetInput) {
        budgetInput.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                if (typeof window.startPlanner === "function") window.startPlanner();
            }
        });
    }`,
`    const budgetInput = document.getElementById("project-budget");
    if (budgetInput) {
        budgetInput.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                if (typeof window.startPlanner === "function") window.startPlanner();
            }
        });
        budgetInput.addEventListener("input", handleBudgetChange);
    }
`);

const handleFun = `
function handleBudgetChange(e) {
  const budget = parseFloat(e.target.value);
  const wrapper = document.getElementById("recommendation-wrapper");
  const content = document.getElementById("recommendation-content");

  if (!wrapper || !content) return;

  if (!budget || isNaN(budget) || budget <= 0) {
    content.innerHTML = \`<div class="recommendation-placeholder">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
      <span>Enter budget to see recommendations</span>
    </div>\`;
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

  content.innerHTML = \`
    <div style="width: 100%; height: 100%; position: relative;">
      <img src="\${templateInfo.img}" class="recommendation-image" alt="\${templateInfo.name}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0; animation: fadeIn 0.5s forwards;">
      <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); padding: 8px 10px; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
        <div style="color: \${templateInfo.color}; font-weight: bold; font-size: 0.9rem; margin-bottom: 2px;">\${templateInfo.name}</div>
        <div style="color: rgba(255,255,255,0.7); font-size: 0.7rem; line-height: 1.2;">\${templateInfo.desc}</div>
      </div>
    </div>
  \`;
}
`;

if (!c.includes('function handleBudgetChange')) {
    c += handleFun;
    fs.writeFileSync('js/index.js', c, 'utf8');
    console.log("Restored budget handler");
} else {
    console.log("Already has handler");
}

