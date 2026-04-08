const fs = require('fs');
let c = fs.readFileSync('js/index.js', 'utf8');

const targetStr = `
      // Helper to safely add an item checking bounds`;
const firstIdx = c.indexOf(targetStr);
if (firstIdx !== -1) {
    const secondIdx = c.indexOf(targetStr, firstIdx + 1);
    if (secondIdx !== -1) {
        c = c.substring(0, secondIdx) + c.substring(c.indexOf('if (omitted_items.length > 0)', secondIdx)).substring(c.substring(c.indexOf('if (omitted_items.length > 0)', secondIdx)).indexOf('}') + 1);
        fs.writeFileSync('js/index.js', c, 'utf8');
        console.log("Fixed Dupe.");
    }
}
