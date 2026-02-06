const fs = require("fs");
const readline = require("readline");
const path = require("path");

async function analyzeOBJ(filePath) {
  const result = {
    file: path.basename(filePath),
    fileSizeMB: 0,
    groups: [],
    objects: [],
    materials: { mtllib: [], usemtl: [] },
    vertexCount: 0,
    faceCount: 0,
    normalCount: 0,
    texCoordCount: 0,
  };

  const stats = fs.statSync(filePath);
  result.fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.startsWith("g ")) {
      result.groups.push(trimmed);
    } else if (trimmed.startsWith("o ")) {
      result.objects.push(trimmed);
    } else if (trimmed.startsWith("mtllib ")) {
      result.materials.mtllib.push(trimmed);
    } else if (trimmed.startsWith("usemtl ")) {
      result.materials.usemtl.push(trimmed);
    } else if (trimmed.startsWith("v ")) {
      result.vertexCount++;
    } else if (trimmed.startsWith("f ")) {
      result.faceCount++;
    } else if (trimmed.startsWith("vn ")) {
      result.normalCount++;
    } else if (trimmed.startsWith("vt ")) {
      result.texCoordCount++;
    }
  }

  return result;
}

(async () => {
  const files = [
    path.join(__dirname, "asset", "models", "bed1.obj"),
    path.join(__dirname, "asset", "models", "bed2.obj"),
  ];

  const results = [];
  for (const f of files) {
    console.log(`Analyzing ${path.basename(f)}...`);
    if (!fs.existsSync(f)) {
      results.push({ file: path.basename(f), error: "File not found" });
      continue;
    }
    const r = await analyzeOBJ(f);
    results.push(r);
  }

  const outPath = path.join(__dirname, "_obj_analysis.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Done. Results written to ${outPath}`);
})();
