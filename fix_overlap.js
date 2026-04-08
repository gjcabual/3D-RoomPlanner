const fs = require("fs");
let code = fs.readFileSync("js/index.js", "utf8");

let newPushItem = `    let omitted_items = [];

    // Helper to safely add an item checking bounds and overlaps
    const pushItem = (key, pos, rot, itemName = 'Item') => {
      // Strict boundary padding to keep inside room edges
      let padX = 0.8;
      let padZ = 0.8;

      let itemX = pos.x;
      let itemZ = pos.z;
      
      if (itemX > halfW - padX) itemX = halfW - padX;
      if (itemX < -halfW + padX) itemX = -halfW + padX;
      if (itemZ > halfL - padZ) itemZ = halfL - padZ;
      if (itemZ < -halfL + padZ) itemZ = -halfL + padZ;

      // Check for overlap with existing items
      let isOverlapping = false;
      // Allow chairs to be closer to desks, otherwise 1.1m radius
      let minDist = (key.includes('chair')) ? 0.6 : 1.1; 
      
      for (let existing of furniture_data) {
        let dx = existing.position.x - itemX;
        let dz = existing.position.z - itemZ;
        let dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < minDist) {
          isOverlapping = true;
          break;
        }
      }

      // If overlapping with previously placed higher-priority items, omit it
      if (isOverlapping) {
        if (!omitted_items.includes(itemName) && itemName !== 'Item') {
           omitted_items.push(itemName);
        }
        return; // Skip adding this item to the room
      }

      furniture_data.push({
        model_key: key,
        position: { x: itemX, y: pos.y, z: itemZ },
        rotation: rot,
        scale: { x: 1, y: 1, z: 1 },
      });

      if (localModelPrices[key]) {
        startingCost += localModelPrices[key];
      }
    };
`;

let oldRegex =
  /    \/\/ Helper to safely add an item checking bounds[\s\S]*?let omitted_items = \[\];/;
code = code.replace(oldRegex, newPushItem);

// We need to update the pushItem calls to pass the itemName so they can be properly displayed in warnings.
code = code.replace(
  /pushItem\(\s*bedKey([^)]+)\);/g,
  "pushItem(bedKey, 'Bed');",
);
code = code.replace(
  /pushItem\(\s*wardrobeKey([^)]+)\);/g,
  "pushItem(wardrobeKey, 'Wardrobe');",
);
code = code.replace(
  /pushItem\(\s*deskKey([^)]+)\);/g,
  "pushItem(deskKey, 'Study Desk');",
);
code = code.replace(
  /pushItem\(\s*chairKey([^)]+)\);/g,
  "pushItem(chairKey, 'Office Chair');",
);
code = code.replace(
  /pushItem\(\s*shelfKey([^)]+)\);/g,
  "pushItem(shelfKey, 'Bookshelf');",
);
code = code.replace(
  /pushItem\(\s*tableKey([^)]+)\);/g,
  "pushItem(tableKey, 'Center Table');",
);
code = code.replace(
  /pushItem\(\s*"mirror1"([^)]+)\);/g,
  "pushItem('mirror1', 'Standing Mirror');",
);

fs.writeFileSync("js/index.js", code);
console.log("Fixed pushItem overlaps!");
