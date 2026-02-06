const fs = require("fs");
const dir = "e:/Programming/thesis 3js/3D-RoomPlanner/asset/models/";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".obj"));
let total = 0;
for (const f of files) {
  const sz = fs.statSync(dir + f).size;
  total += sz;
  console.log(`${f}: ${(sz / 1048576).toFixed(2)} MB`);
}
console.log(
  `\nTotal: ${(total / 1048576).toFixed(2)} MB across ${files.length} files`,
);

// Also read first 5 lines of the smallest file to check OBJ format
const smallest = files.reduce((a, b) =>
  fs.statSync(dir + a).size < fs.statSync(dir + b).size ? a : b,
);
const head = fs
  .readFileSync(dir + smallest, "utf8")
  .split("\n")
  .slice(0, 15)
  .join("\n");
console.log(`\nFirst 15 lines of ${smallest}:\n${head}`);
