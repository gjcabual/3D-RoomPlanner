// obj-parser-worker.js
// Web Worker that parses OBJ file text off the main thread.
// Receives: { id, url, text? }
// Returns:  { id, url, meshes: [{ positions, normals, uvs }] }
//
// This prevents the heavy OBJ string-parsing from blocking the UI.

/* eslint-disable no-restricted-globals */
"use strict";

/**
 * Minimal OBJ parser – extracts indexed geometry and expands it into
 * non-indexed Float32Arrays that THREE.BufferGeometry can consume directly.
 *
 * Supports: v, vn, vt, f (triangles & quads), g/o groups.
 * Does NOT support: materials (mtllib/usemtl), curves, free-form surfaces.
 * This is intentional – the app applies its own materials via textured-model.
 */
function parseOBJ(text) {
  const positions = []; // vec3[]
  const normals = []; // vec3[]
  const uvs = []; // vec2[]

  // Per-group expanded buffers
  let groupPositions = [];
  let groupNormals = [];
  let groupUvs = [];

  const meshes = [];

  function flushGroup() {
    if (groupPositions.length === 0) return;
    meshes.push({
      positions: new Float32Array(groupPositions),
      normals: groupNormals.length > 0 ? new Float32Array(groupNormals) : null,
      uvs: groupUvs.length > 0 ? new Float32Array(groupUvs) : null,
    });
    groupPositions = [];
    groupNormals = [];
    groupUvs = [];
  }

  function addVertex(vertexStr) {
    // Face vertex format: v_idx/vt_idx/vn_idx  or  v_idx//vn_idx  or  v_idx/vt_idx  or  v_idx
    const parts = vertexStr.split("/");
    const vi = parseInt(parts[0], 10);

    // OBJ indices are 1-based; negative indices count from end
    const pi = vi > 0 ? vi - 1 : positions.length / 3 + vi;
    groupPositions.push(
      positions[pi * 3],
      positions[pi * 3 + 1],
      positions[pi * 3 + 2],
    );

    if (parts.length > 1 && parts[1] !== "") {
      const ti = parseInt(parts[1], 10);
      const ui = ti > 0 ? ti - 1 : uvs.length / 2 + ti;
      groupUvs.push(uvs[ui * 2], uvs[ui * 2 + 1]);
    }

    if (parts.length > 2 && parts[2] !== "") {
      const ni = parseInt(parts[2], 10);
      const nIdx = ni > 0 ? ni - 1 : normals.length / 3 + ni;
      groupNormals.push(
        normals[nIdx * 3],
        normals[nIdx * 3 + 1],
        normals[nIdx * 3 + 2],
      );
    }
  }

  const lines = text.split("\n");
  for (let i = 0, len = lines.length; i < len; i++) {
    const line = lines[i].trim();
    if (line === "" || line.charAt(0) === "#") continue;

    const spaceIdx = line.indexOf(" ");
    if (spaceIdx === -1) continue;

    const keyword = line.substring(0, spaceIdx);
    const data = line.substring(spaceIdx + 1).trim();

    switch (keyword) {
      case "v": {
        const p = data.split(/\s+/);
        positions.push(parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2]));
        break;
      }
      case "vn": {
        const n = data.split(/\s+/);
        normals.push(parseFloat(n[0]), parseFloat(n[1]), parseFloat(n[2]));
        break;
      }
      case "vt": {
        const t = data.split(/\s+/);
        uvs.push(parseFloat(t[0]), parseFloat(t[1]));
        break;
      }
      case "f": {
        const verts = data.split(/\s+/);
        // Triangulate: fan from first vertex
        for (let j = 1; j < verts.length - 1; j++) {
          addVertex(verts[0]);
          addVertex(verts[j]);
          addVertex(verts[j + 1]);
        }
        break;
      }
      case "g":
      case "o": {
        flushGroup();
        break;
      }
      // Ignore mtllib, usemtl, s, etc.
    }
  }

  flushGroup();

  // If no groups were created (no g/o keywords), everything is in one mesh
  if (meshes.length === 0 && groupPositions.length === 0) {
    // Entirely empty OBJ
    meshes.push({
      positions: new Float32Array(0),
      normals: null,
      uvs: null,
    });
  }

  return meshes;
}

/**
 * Fetch the OBJ file text (or use the text passed in the message).
 */
async function fetchObjText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

/**
 * Message handler
 */
self.onmessage = async function (e) {
  const { id, url, cacheKey, text } = e.data;

  try {
    const objText = text || (await fetchObjText(url));

    // Sanity check: OBJ files start with comments (#) or vertex data (v/vn/vt)
    // If the response looks like HTML, it's a server fallback – reject it.
    const head = objText.substring(0, 200).trim();
    if (head.startsWith("<") || head.startsWith("<!DOCTYPE")) {
      throw new Error("Response is HTML, not OBJ (likely 404 fallback)");
    }

    const meshes = parseOBJ(objText);

    // Collect transferable buffers to avoid serialization cost
    const transferables = [];
    for (const mesh of meshes) {
      if (mesh.positions) transferables.push(mesh.positions.buffer);
      if (mesh.normals) transferables.push(mesh.normals.buffer);
      if (mesh.uvs) transferables.push(mesh.uvs.buffer);
    }

    self.postMessage({ id, url, cacheKey, meshes, error: null }, transferables);
  } catch (err) {
    self.postMessage({ id, url, cacheKey, meshes: null, error: err.message });
  }
};
