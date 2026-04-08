const fs = require('fs');
let c = fs.readFileSync('js/index.js', 'utf8');

c = c.replace('window.addEventListener("load", function () {', '');
c = c.replace('  });\n});\n\nfunction handleBudgetChange', '});\n\nfunction handleBudgetChange');

fs.writeFileSync('js/index.js', c, 'utf8');
