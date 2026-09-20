/*
 * 星屿 3D 空间杆系有限元 Phase 0
 * 单位：kN、m、kPa；每节点 6 自由度 [ux, uy, uz, rx, ry, rz]。
 * 目标：先建立可验证的 3D frame 基础，不冒充完整桥梁设计求解器。
 */

"use strict";

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vectorDot(a, b) {
  if (a.length !== b.length) throw new Error('Vector dimensions do not match');
  var sum = 0;
  for (var i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm(a) {
  return Math.sqrt(dot(a, a));
}

function normalize(a) {
  const n = norm(a);
  if (!(n > 1e-14)) throw new Error("Cannot normalize a zero vector");
  return a.map((x) => x / n);
}

function zeros(n, m = n) {
  return Array.from({ length: n }, () => Array(m).fill(0));
}

function transpose(A) {
  return A[0].map((_, j) => A.map((row) => row[j]));
}

function matMul(A, B) {
  const out = zeros(A.length, B[0].length);
  for (let i = 0; i < A.length; i++) {
    for (let k = 0; k < B.length; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < B[0].length; j++) out[i][j] += aik * B[k][j];
    }
  }
  return out;
}

function rotationFromAxis(xyzI, xyzJ, reference = [0, 0, 1]) {
  const ex = normalize(xyzJ.map((v, i) => v - xyzI[i]));
  let ey = cross(reference, ex);
  if (norm(ey) < 1e-10) ey = cross([0, 1, 0], ex);
  ey = normalize(ey);
  const ez = normalize(cross(ex, ey));
  // Rows map global vectors to local coordinates.
  return [
    [ex[0], ex[1], ex[2]],
    [ey[0], ey[1], ey[2]],
    [ez[0], ez[1], ez[2]],
  ];
}

function dofTransform(R) {
  const T = zeros(12);
  for (const base of [0, 3, 6, 9]) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) T[base + i][base + j] = R[i][j];
    }
  }
  return T;
}

function localFrameStiffness({ E, nu, A, Iy, Iz, J, L }) {
  if (![E, nu, A, Iy, Iz, J, L].every(Number.isFinite) || L <= 0) {
    throw new Error("Invalid 3D frame properties");
  }
  const G = E / (2 * (1 + nu));
  const k = zeros(12);
  const a = E * A / L;
  const t = G * J / L;
  const by = E * Iy;
  const bz = E * Iz;

  k[0][0] = k[6][6] = a;
  k[0][6] = k[6][0] = -a;
  k[3][3] = k[9][9] = t;
  k[3][9] = k[9][3] = -t;

  const z = [
    [1, 5, 7, 11],
    [2, 4, 8, 10],
  ];
  const kz = [
    [12 * bz / L ** 3, 6 * bz / L ** 2, -12 * bz / L ** 3, 6 * bz / L ** 2],
    [6 * bz / L ** 2, 4 * bz / L, -6 * bz / L ** 2, 2 * bz / L],
    [-12 * bz / L ** 3, -6 * bz / L ** 2, 12 * bz / L ** 3, -6 * bz / L ** 2],
    [6 * bz / L ** 2, 2 * bz / L, -6 * bz / L ** 2, 4 * bz / L],
  ];
  const ky = [
    [12 * by / L ** 3, -6 * by / L ** 2, -12 * by / L ** 3, -6 * by / L ** 2],
    [-6 * by / L ** 2, 4 * by / L, 6 * by / L ** 2, 2 * by / L],
    [-12 * by / L ** 3, 6 * by / L ** 2, 12 * by / L ** 3, 6 * by / L ** 2],
    [-6 * by / L ** 2, 2 * by / L, 6 * by / L ** 2, 4 * by / L],
  ];
  for (const [ids, block] of [[z[0], kz], [z[1], ky]]) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) k[ids[i]][ids[j]] += block[i][j];
    }
  }
  return k;
}

/*
 * 3D Euler-Bernoulli frame consistent mass matrix.
 * massDensity unit: kN·s²/m⁴, so massDensity*A*L is kN·s²/m.
 */
function localFrameMass({ massDensity, A, J, L }) {
  if (![massDensity, A, J, L].every(Number.isFinite) || massDensity < 0 || A <= 0 || J <= 0 || L <= 0) {
    throw new Error("Invalid 3D frame mass properties");
  }
  const m = zeros(12);
  const lineMass = massDensity * A;

  // Axial translation.
  const ma = lineMass * L / 6;
  m[0][0] += 2 * ma; m[0][6] += ma;
  m[6][0] += ma;     m[6][6] += 2 * ma;

  // Torsional rotary inertia, using section polar area moment J.
  const mt = massDensity * J * L / 6;
  m[3][3] += 2 * mt; m[3][9] += mt;
  m[9][3] += mt;     m[9][9] += 2 * mt;

  const c = lineMass * L / 420;
  const l2 = L * L;
  const bendZ = [
    [156, 22 * L, 54, -13 * L],
    [22 * L, 4 * l2, 13 * L, -3 * l2],
    [54, 13 * L, 156, -22 * L],
    [-13 * L, -3 * l2, -22 * L, 4 * l2],
  ];
  const bendY = [
    [156, -22 * L, 54, 13 * L],
    [-22 * L, 4 * l2, -13 * L, -3 * l2],
    [54, -13 * L, 156, 22 * L],
    [13 * L, -3 * l2, 22 * L, 4 * l2],
  ];
  const idsZ = [1, 5, 7, 11]; // local y translation / local z rotation
  const idsY = [2, 4, 8, 10]; // local z translation / local y rotation
  for (const [ids, block] of [[idsZ, bendZ], [idsY, bendY]]) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) m[ids[i]][ids[j]] += c * block[i][j];
    }
  }
  return m;
}

function matrixVector(A, x) {
  return A.map((row) => row.reduce((sum, value, i) => sum + value * x[i], 0));
}

function vectorSub(a, b) {
  return a.map((value, i) => value - b[i]);
}

function maxAbs(values) {
  return values.reduce((m, value) => Math.max(m, Math.abs(value)), 0);
}

function identity(n) {
  const I = zeros(n);
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

function cholesky(A) {
  const n = A.length;
  const L = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(sum > 1e-16)) throw new Error(`Mass matrix is not positive definite at DOF ${i}`);
        L[i][j] = Math.sqrt(sum);
      } else {
        L[i][j] = sum / L[j][j];
      }
    }
  }
  return L;
}

function solveLower(L, b) {
  const x = Array(b.length).fill(0);
  for (let i = 0; i < b.length; i++) {
    let sum = b[i];
    for (let j = 0; j < i; j++) sum -= L[i][j] * x[j];
    x[i] = sum / L[i][i];
  }
  return x;
}

function solveUpper(U, b) {
  const x = Array(b.length).fill(0);
  for (let i = b.length - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < b.length; j++) sum -= U[i][j] * x[j];
    x[i] = sum / U[i][i];
  }
  return x;
}

function jacobiEigenSymmetric(input, options = {}) {
  const n = input.length;
  const A = input.map((row) => row.slice());
  const V = identity(n);
  const tolerance = options.tolerance || 1e-11;
  const maxIterations = options.maxIterations || Math.max(80, n * n * 30);
  let iteration = 0;
  for (; iteration < maxIterations; iteration++) {
    let p = 0, q = 1, largest = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const value = Math.abs(A[i][j]);
        if (value > largest) { largest = value; p = i; q = j; }
      }
    }
    if (largest <= tolerance) break;
    const app = A[p][p], aqq = A[q][q], apq = A[p][q];
    const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(phi), s = Math.sin(phi);
    for (let k = 0; k < n; k++) {
      if (k === p || k === q) continue;
      const akp = A[k][p], akq = A[k][q];
      A[k][p] = A[p][k] = c * akp - s * akq;
      A[k][q] = A[q][k] = s * akp + c * akq;
    }
    A[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    A[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    A[p][q] = A[q][p] = 0;
    for (let k = 0; k < n; k++) {
      const vkp = V[k][p], vkq = V[k][q];
      V[k][p] = c * vkp - s * vkq;
      V[k][q] = s * vkp + c * vkq;
    }
  }
  const pairs = A.map((row, i) => ({
    value: row[i],
    vector: V.map((vRow) => vRow[i]),
  })).sort((a, b) => a.value - b.value);
  return { pairs, iterations: iteration, converged: iteration < maxIterations };
}

function validateModel(model) {
  if (!model || model.schemaVersion !== "0.1.0") {
    throw new Error("Unsupported or missing 3D project schemaVersion");
  }
  if (model.units?.force !== "kN" || model.units?.length !== "m" || model.units?.stress !== "kPa") {
    throw new Error("3D solver expects kN-m-kPa units");
  }
  const ids = new Set();
  for (const node of model.nodes || []) {
    if (ids.has(node.id)) throw new Error(`Duplicate node id ${node.id}`);
    ids.add(node.id);
    if (!Array.isArray(node.xyz) || node.xyz.length !== 3 || node.xyz.some((x) => !Number.isFinite(x))) {
      throw new Error(`Node ${node.id}: invalid xyz`);
    }
  }
  const nodeIds = new Set((model.nodes || []).map((node) => node.id));
  const materialIds = new Set((model.materials || []).map((material) => material.id));
  const sectionIds = new Set((model.sections || []).map((section) => section.id));
  for (const element of model.elements || []) {
    if (ids.has(element.id)) throw new Error(`Duplicate element id ${element.id}`);
    ids.add(element.id);
    if (!nodeIds.has(element.i) || !nodeIds.has(element.j)) {
      throw new Error(`Element ${element.id}: missing node reference`);
    }
    if (!materialIds.has(element.materialId)) throw new Error(`Element ${element.id}: missing material`);
    if (!sectionIds.has(element.sectionId)) throw new Error(`Element ${element.id}: missing section`);
    if (element.i === element.j) throw new Error(`Element ${element.id}: zero-length node pair`);
  }
  for (const restraint of model.restraints || []) {
    if (!nodeIds.has(restraint.nodeId)) throw new Error(`Restraint: missing node ${restraint.nodeId}`);
    if (!Array.isArray(restraint.fixed) || restraint.fixed.length !== 6) {
      throw new Error(`Restraint ${restraint.nodeId}: fixed must have 6 booleans`);
    }
  }
  return true;
}

function activeElementSet(model, stageId) {
  const stages = model.stages || [];
  if (!stageId || !stages.length) return new Set((model.elements || []).map((element) => element.id));
  const stage = stages.find((item) => item.id === stageId);
  if (!stage) throw new Error(`Unknown construction stage ${stageId}`);
  const explicit = new Set(stage.activateElements || []);
  const groups = new Set(stage.activeGroups || []);
  const hasExplicitGate = explicit.size > 0 || groups.size > 0;
  if (!hasExplicitGate) return new Set((model.elements || []).map((element) => element.id));
  return new Set((model.elements || [])
    .filter((element) => explicit.has(element.id) || groups.has(element.group))
    .map((element) => element.id));
}

function frameElement(element, nodes, material, section) {
  const ni = nodes[element.i];
  const nj = nodes[element.j];
  if (!ni || !nj) throw new Error(`Element ${element.id}: missing node`);
  const L = norm(nj.xyz.map((v, i) => v - ni.xyz[i]));
  const R = rotationFromAxis(ni.xyz, nj.xyz, element.orientation || [0, 0, 1]);
  const T = dofTransform(R);
  const kl = localFrameStiffness({ ...material, ...section, L });
  const ml = localFrameMass({
    massDensity: material.massDensity ?? material.density ?? 0,
    A: section.A,
    J: section.J,
    L,
  });
  const kg = matMul(transpose(T), matMul(kl, T));
  const mg = matMul(transpose(T), matMul(ml, T));
  return { L, R, T, kl, kg, ml, mg };
}

function trussElement(element, nodes, material, section) {
  const ni = nodes[element.i];
  const nj = nodes[element.j];
  if (!ni || !nj) throw new Error(`Element ${element.id}: missing node`);
  const delta = nj.xyz.map((v, i) => v - ni.xyz[i]);
  const L = norm(delta);
  const direction = normalize(delta);
  const EA = material.E * section.A;
  const kg = zeros(12);
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      const value = EA / L * direction[a] * direction[b];
      kg[a][b] += value;
      kg[a][6 + b] -= value;
      kg[6 + a][b] -= value;
      kg[6 + a][6 + b] += value;
      if (element.type === "cable3d" && element.T0 > 0) {
        // 拉索初张力几何刚度：T/L · (I - n nᵀ)，提供横向恢复力。
        const projector = (a === b ? 1 : 0) - direction[a] * direction[b];
        const geometric = element.T0 / L * projector;
        kg[a][b] += geometric;
        kg[a][6 + b] -= geometric;
        kg[6 + a][b] -= geometric;
        kg[6 + a][6 + b] += geometric;
      }
    }
  }
  const mg = zeros(12);
  const massDensity = material.massDensity ?? material.density ?? 0;
  const halfMass = massDensity * section.A * L / 2;
  for (let d = 0; d < 3; d++) {
    mg[d][d] += halfMass;
    mg[6 + d][6 + d] += halfMass;
  }
  return { kind: element.type, L, direction, EA, T0: element.T0 || 0, kg, mg };
}

function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => row.slice().concat(b[i]));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    if (Math.abs(M[pivot][col]) < 1e-14) throw new Error(`Singular matrix at DOF ${col}`);
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let rhs = M[i][n];
    for (let j = i + 1; j < n; j++) rhs -= M[i][j] * x[j];
    x[i] = rhs / M[i][i];
  }
  return x;
}

function assembleModel(model, options = {}) {
  validateModel(model);
  const nodeIds = model.nodes.map((n) => n.id);
  const nodeIndex = new Map(nodeIds.map((id, i) => [id, i]));
  const ndof = nodeIds.length * 6;
  const K = zeros(ndof);
  const M = zeros(ndof);
  const elementCache = new Map();
  const active = activeElementSet(model, options.stageId);

  for (const element of model.elements) {
    if (!active.has(element.id)) continue;
    const ni = model.nodes[nodeIndex.get(element.i)];
    const nj = model.nodes[nodeIndex.get(element.j)];
    const material = model.materials.find((x) => x.id === element.materialId);
    const section = model.sections.find((x) => x.id === element.sectionId);
    let c;
    if (element.type === "frame3d") {
      c = frameElement(element, { [element.i]: ni, [element.j]: nj }, material, section);
      c.kind = "frame3d";
    } else if (element.type === "truss3d" || element.type === "cable3d") {
      c = trussElement(element, { [element.i]: ni, [element.j]: nj }, material, section);
    } else {
      continue;
    }
    elementCache.set(element.id, c);
    const i0 = nodeIndex.get(element.i) * 6;
    const j0 = nodeIndex.get(element.j) * 6;
    const dofs = [...Array(6).keys()].map((i) => i0 + i).concat([...Array(6).keys()].map((i) => j0 + i));
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        K[dofs[i]][dofs[j]] += c.kg[i][j];
        M[dofs[i]][dofs[j]] += c.mg[i][j];
      }
    }
  }

  for (const node of model.nodes) {
    if (!node.mass) continue;
    const base = nodeIndex.get(node.id) * 6;
    for (let i = 0; i < 6; i++) M[base + i][base + i] += node.mass[i] || 0;
  }
  const fixed = new Set();
  for (const restraint of model.restraints) {
    const base = nodeIndex.get(restraint.nodeId) * 6;
    restraint.fixed.forEach((isFixed, i) => { if (isFixed) fixed.add(base + i); });
  }
  // 只连接桁架/索单元的节点没有转动自由度物理意义；自动锁定 rx/ry/rz，
  // 否则会生成零刚度、零质量的伪自由度并使模态质量矩阵非正定。
  const frameConnected = new Set();
  for (const element of model.elements) {
    if (element.type === "frame3d" && active.has(element.id)) {
      frameConnected.add(element.i);
      frameConnected.add(element.j);
    }
  }
  for (const node of model.nodes) {
    if (frameConnected.has(node.id)) continue;
    const base = nodeIndex.get(node.id) * 6;
    fixed.add(base + 3); fixed.add(base + 4); fixed.add(base + 5);
  }
  const free = [...Array(ndof).keys()].filter((i) => !fixed.has(i));
  if (!free.length) throw new Error("No free degrees of freedom");
  return { K, M, fixed, free, nodeIndex, elementCache, active, ndof };
}

function solveModel(model, loadCaseId, options = {}) {
  const assembled = assembleModel(model, options);
  const { K, M, free, nodeIndex, elementCache, active, ndof } = assembled;
  const F = Array(ndof).fill(0);
  const lc = model.loadCases.find((x) => x.id === loadCaseId) || model.loadCases[0];
  for (const load of lc?.nodalLoads || []) {
    const base = nodeIndex.get(load.nodeId) * 6;
    for (let i = 0; i < 6; i++) F[base + i] += load.load[i] || 0;
  }
  const Kff = free.map((i) => free.map((j) => K[i][j]));
  const Ff = free.map((i) => F[i]);
  const uf = solveLinear(Kff, Ff);
  const U = Array(ndof).fill(0);
  free.forEach((dof, i) => { U[dof] = uf[i]; });

  const reactions = vectorSub(matrixVector(K, U), F);
  const elements = [];
  for (const element of model.elements) {
    const cache = elementCache.get(element.id);
    if (!cache) continue;
    const i0 = nodeIndex.get(element.i) * 6;
    const j0 = nodeIndex.get(element.j) * 6;
    const dofs = [...Array(6).keys()].map((i) => i0 + i)
      .concat([...Array(6).keys()].map((i) => j0 + i));
    const ug = dofs.map((dof) => U[dof]);
    if (cache.kind === "frame3d") {
      const ul = matrixVector(cache.T, ug);
      const fl = matrixVector(cache.kl, ul);
      elements.push({
        id: element.id, type: element.type, i: element.i, j: element.j, length: cache.L,
        localDisplacement: ul, localEndForce: fl,
        axialForceI: -fl[0], axialForceJ: fl[6],
      });
    } else {
      const dui = cache.direction[0] * ug[0] + cache.direction[1] * ug[1] + cache.direction[2] * ug[2];
      const duj = cache.direction[0] * ug[6] + cache.direction[1] * ug[7] + cache.direction[2] * ug[8];
      const axial = cache.EA / cache.L * (duj - dui) + (cache.T0 || 0);
      elements.push({
        id: element.id, type: element.type, i: element.i, j: element.j, length: cache.L,
        axialForceI: axial, axialForceJ: axial
      });
    }
  }
  // Constrained DOFs carry support reactions, so their K·U-F residual is
  // intentionally non-zero. Report the equilibrium residual on free DOFs.
  const equilibriumResidual = free.map((dof) => matrixVector(K, U)[dof] - F[dof]);
  return {
    U,
    K,
    M,
    F,
    reactions,
    equilibriumResidual,
    equilibriumResidualMax: maxAbs(equilibriumResidual),
    elementCache,
    elements,
    nodeIndex,
    activeElementIds: [...active],
    stageId: options.stageId || null,
  };
}

function solveModal(model, options = {}) {
  const assembled = assembleModel(model, options);
  const { K, M, free, nodeIndex, active } = assembled;
  const Kff = free.map((i) => free.map((j) => K[i][j]));
  const Mff = free.map((i) => free.map((j) => M[i][j]));
  const L = cholesky(Mff);
  const n = free.length;
  const temp = zeros(n);
  for (let j = 0; j < n; j++) {
    const column = Kff.map((row) => row[j]);
    const solved = solveLower(L, column);
    for (let i = 0; i < n; i++) temp[i][j] = solved[i];
  }
  const B = temp.map((row) => solveLower(L, row));
  const Lt = transpose(L);
  // Numerical round-off can slightly break symmetry.
  for (let i = 0; i < B.length; i++) {
    for (let j = i + 1; j < B.length; j++) {
      const avg = 0.5 * (B[i][j] + B[j][i]);
      B[i][j] = B[j][i] = avg;
    }
  }
  const eigen = jacobiEigenSymmetric(B, options.eigen || {});
  const modeCount = Math.min(options.modeCount || 6, free.length);
  const modes = [];
  const directions = { x: 0, y: 1, z: 2 };
  const influence = {};
  const totalMass = {};
  Object.keys(directions).forEach(function (key) {
    var dir = directions[key];
    var r = free.map(function (dof) { return dof % 6 === dir ? 1 : 0; });
    influence[key] = matrixVector(Mff, r);
    totalMass[key] = vectorDot(r, influence[key]);
  });
  for (const pair of eigen.pairs) {
    if (!(pair.value > 1e-10)) continue;
    const freeShape = solveUpper(Lt, pair.vector);
    const generalizedMass = vectorDot(freeShape, matrixVector(Mff, freeShape));
    const scale = generalizedMass > 0 ? 1 / Math.sqrt(generalizedMass) : 1;
    const normalized = freeShape.map((value) => value * scale);
    const shape = Array(model.nodes.length * 6).fill(0);
    free.forEach((dof, i) => { shape[dof] = normalized[i]; });
    const omega = Math.sqrt(pair.value);
    var participation = {};
    Object.keys(directions).forEach(function (key) {
      var gamma = vectorDot(normalized, influence[key]);
      var effectiveMass = gamma * gamma;
      participation[key] = {
        gamma: gamma,
        effectiveMass: effectiveMass,
        ratio: totalMass[key] > 0 ? effectiveMass / totalMass[key] : 0
      };
    });
    modes.push({
      index: modes.length + 1,
      eigenvalue: pair.value,
      omega,
      frequencyHz: omega / (2 * Math.PI),
      periodSec: 2 * Math.PI / omega,
      generalizedMass: vectorDot(normalized, matrixVector(Mff, normalized)),
      participation: participation,
      shape,
    });
    if (modes.length >= modeCount) break;
  }
  var cumulative = { x: 0, y: 0, z: 0 };
  modes.forEach(function (mode) {
    Object.keys(cumulative).forEach(function (key) {
      cumulative[key] += mode.participation[key].ratio;
      mode.participation[key].cumulativeRatio = cumulative[key];
    });
  });
  var stiffnessDiag = free.map(function (dof) { return Math.abs(K[dof][dof]); });
  var massDiag = free.map(function (dof) { return Math.abs(M[dof][dof]); });
  var positiveK = stiffnessDiag.filter(function (v) { return v > 1e-14; });
  var positiveM = massDiag.filter(function (v) { return v > 1e-14; });
  var minK = positiveK.length ? Math.min.apply(null, positiveK) : 0;
  var maxK = positiveK.length ? Math.max.apply(null, positiveK) : 0;
  var minM = positiveM.length ? Math.min.apply(null, positiveM) : 0;
  var maxM = positiveM.length ? Math.max.apply(null, positiveM) : 0;
  var elementLengths = [];
  assembled.elementCache.forEach(function (cache) { elementLengths.push(cache.L); });
  var warnings = [];
  var masslessDofs = massDiag.filter(function (v) { return v <= 1e-14; }).length;
  if (masslessDofs) warnings.push(masslessDofs + ' 个自由度缺少质量');
  var stiffnessRatio = minK > 0 ? maxK / minK : Infinity;
  if (stiffnessRatio > 1e12) warnings.push('刚度对角量级差超过 1e12，模型可能病态');
  Object.keys(cumulative).forEach(function (key) {
    if (cumulative[key] < 0.9) warnings.push(key.toUpperCase() + ' 向前 ' + modes.length + ' 阶有效质量不足 90%');
  });
  return {
    modes,
    K,
    M,
    freeDofs: free,
    nodeIndex,
    activeElementIds: [...active],
    stageId: options.stageId || null,
    eigensolver: {
      iterations: eigen.iterations,
      converged: eigen.converged,
    },
    participation: {
      totalMass: totalMass,
      cumulativeRatio: cumulative
    },
    diagnostics: {
      freeDofCount: free.length,
      masslessDofCount: masslessDofs,
      stiffnessDiagonal: { min: minK, max: maxK, ratio: stiffnessRatio },
      massDiagonal: { min: minM, max: maxM, ratio: minM > 0 ? maxM / minM : Infinity },
      elementLength: {
        min: elementLengths.length ? Math.min.apply(null, elementLengths) : 0,
        max: elementLengths.length ? Math.max.apply(null, elementLengths) : 0
      },
      warnings: warnings
    }
  };
}

function interpolateSpectrum(points, period) {
  if (!Array.isArray(points) || points.length < 2) throw new Error("Response spectrum requires at least two points");
  const sorted = points.map((point) => ({
    period: Number(point.period),
    acceleration: Number(point.acceleration)
  })).sort((a, b) => a.period - b.period);
  if (sorted.some((point) => !Number.isFinite(point.period) || !Number.isFinite(point.acceleration) || point.period < 0 || point.acceleration < 0)) {
    throw new Error("Invalid response spectrum point");
  }
  if (period <= sorted[0].period) return sorted[0].acceleration;
  if (period >= sorted[sorted.length - 1].period) return sorted[sorted.length - 1].acceleration;
  for (let i = 1; i < sorted.length; i++) {
    if (period <= sorted[i].period) {
      const a = sorted[i - 1], b = sorted[i];
      const ratio = (period - a.period) / Math.max(b.period - a.period, 1e-14);
      return a.acceleration + (b.acceleration - a.acceleration) * ratio;
    }
  }
  return sorted[sorted.length - 1].acceleration;
}

function cqcCorrelation(omegaI, omegaJ, dampingRatio) {
  if (!(omegaI > 0) || !(omegaJ > 0)) return 0;
  const zeta = Math.max(0, Number(dampingRatio) || 0);
  if (omegaI === omegaJ) return 1;
  if (zeta === 0) return 0;
  const r = omegaJ / omegaI;
  const numerator = 8 * zeta * zeta * (1 + r) * Math.pow(r, 1.5);
  const denominator = Math.pow(1 - r * r, 2) + 4 * zeta * zeta * r * Math.pow(1 + r, 2);
  return denominator > 0 ? numerator / denominator : 0;
}

function combineModalResponses(vectors, omegas, method, dampingRatio) {
  if (!vectors.length) return [];
  const length = vectors[0].length;
  const result = Array(length).fill(0);
  const useCqc = String(method || "SRSS").toUpperCase() === "CQC";
  for (let dof = 0; dof < length; dof++) {
    let sum = 0;
    for (let i = 0; i < vectors.length; i++) {
      if (!useCqc) {
        sum += vectors[i][dof] * vectors[i][dof];
        continue;
      }
      for (let j = 0; j < vectors.length; j++) {
        sum += cqcCorrelation(omegas[i], omegas[j], dampingRatio) * vectors[i][dof] * vectors[j][dof];
      }
    }
    result[dof] = Math.sqrt(Math.max(0, sum));
  }
  return result;
}

function solveResponseSpectrum(model, spectrumPoints, options = {}) {
  const direction = ["x", "y", "z"].includes(options.direction) ? options.direction : "x";
  const method = String(options.method || "SRSS").toUpperCase() === "CQC" ? "CQC" : "SRSS";
  const dampingRatio = Math.max(0, Math.min(0.30, Number(options.dampingRatio) || 0.05));
  const modal = options.modal || solveModal(model, {
    stageId: options.stageId,
    modeCount: options.modeCount || 12
  });
  const modalVectors = [];
  const modalResults = [];
  for (const mode of modal.modes) {
    const acceleration = interpolateSpectrum(spectrumPoints, mode.periodSec);
    const spectralDisplacement = acceleration / (mode.omega * mode.omega);
    const gamma = mode.participation[direction].gamma;
    const response = mode.shape.map((value) => value * gamma * spectralDisplacement);
    modalVectors.push(response);
    modalResults.push({
      mode: mode.index,
      periodSec: mode.periodSec,
      frequencyHz: mode.frequencyHz,
      acceleration,
      spectralDisplacement,
      participationFactor: gamma,
      effectiveMassRatio: mode.participation[direction].ratio,
      response
    });
  }
  const combinedDisplacement = combineModalResponses(
    modalVectors,
    modal.modes.map((mode) => mode.omega),
    method,
    dampingRatio
  );
  let maxNodeResultant = 0, maxNodeId = null;
  model.nodes.forEach((node, index) => {
    const value = Math.hypot(
      combinedDisplacement[index * 6] || 0,
      combinedDisplacement[index * 6 + 1] || 0,
      combinedDisplacement[index * 6 + 2] || 0
    );
    if (value > maxNodeResultant) { maxNodeResultant = value; maxNodeId = node.id; }
  });
  return {
    direction,
    method,
    dampingRatio,
    spectrumPoints,
    modal,
    modalResults,
    combinedDisplacement,
    maxNodeResultant,
    maxNodeId,
    cumulativeMassRatio: modal.participation.cumulativeRatio[direction]
  };
}

/* ---------- 线性时程分析：Newmark-β 直接积分 ---------- */

/*
 * 平铺矩阵 LU 分解（部分主元），时程逐步回代只分解一次。
 * A 为行主序 Float64Array(n*n)，原地分解。
 */
function luFactor(A, n) {
  const piv = new Int32Array(n);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    let best = Math.abs(A[col * n + col]);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(A[row * n + col]);
      if (v > best) { best = v; pivot = row; }
    }
    if (!(best > 1e-30)) throw new Error(`时程有效刚度矩阵奇异（DOF ${col}）`);
    piv[col] = pivot;
    if (pivot !== col) {
      for (let j = 0; j < n; j++) {
        const tmp = A[col * n + j];
        A[col * n + j] = A[pivot * n + j];
        A[pivot * n + j] = tmp;
      }
    }
    const inv = 1 / A[col * n + col];
    for (let row = col + 1; row < n; row++) {
      const factor = A[row * n + col] * inv;
      A[row * n + col] = factor;
      if (factor === 0) continue;
      for (let j = col + 1; j < n; j++) A[row * n + j] -= factor * A[col * n + j];
    }
  }
  return { lu: A, piv: piv, n: n };
}

function luSolve(fac, b, out) {
  const n = fac.n, lu = fac.lu, piv = fac.piv;
  const x = out || new Float64Array(n);
  x.set(b);
  for (let col = 0; col < n; col++) {
    if (piv[col] !== col) {
      const tmp = x[col];
      x[col] = x[piv[col]];
      x[piv[col]] = tmp;
    }
  }
  for (let i = 0; i < n; i++) {
    let sum = x[i];
    for (let j = 0; j < i; j++) sum -= lu[i * n + j] * x[j];
    x[i] = sum;
  }
  for (let i = n - 1; i >= 0; i--) {
    let sum = x[i];
    for (let j = i + 1; j < n; j++) sum -= lu[i * n + j] * x[j];
    x[i] = sum / lu[i * n + i];
  }
  return x;
}

function flatMatVec(A, x, n, out) {
  for (let i = 0; i < n; i++) {
    const row = i * n;
    let sum = 0;
    for (let j = 0; j < n; j++) sum += A[row + j] * x[j];
    out[i] = sum;
  }
  return out;
}

function flatQuadratic(A, x, n) {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const row = i * n;
    let ai = 0;
    for (let j = 0; j < n; j++) ai += A[row + j] * x[j];
    sum += x[i] * ai;
  }
  return sum;
}

/*
 * 线性时程分析（基础激励，相对坐标）。
 *   M ü + C u̇ + K u = -M·ι·ag(t)，ι 为地震方向单位刚体向量。
 * 阻尼取 Rayleigh：C = αM + βK，α/β 由前两阶频率在目标阻尼比下确定。
 * Newmark-β 平均加速度法（γ=0.5, β=0.25），无条件稳定。
 * options: { ag: Float64Array|Array(m/s²), dt, direction: 'x'|'y'|'z',
 *            dampingRatio, modal(可选，复用模态), stageId, maxSteps }
 */
function solveTimeHistory(model, options = {}) {
  const ag = options.ag;
  const dt = Number(options.dt);
  const direction = ["x", "y", "z"].includes(options.direction) ? options.direction : "x";
  if (!ag || ag.length < 2) throw new Error("时程分析需要至少两个加速度步");
  if (!(dt > 0)) throw new Error("时程分析 dt 无效");
  const maxSteps = options.maxSteps || 8000;
  if (ag.length > maxSteps) {
    throw new Error(`时程步数 ${ag.length} 超过上限 ${maxSteps}，请增大 dt 或截短波`);
  }
  const zetaRaw = Number(options.dampingRatio);
  const zeta = Math.max(0, Math.min(0.30, Number.isFinite(zetaRaw) ? zetaRaw : 0.05));

  const assembled = assembleModel(model, { stageId: options.stageId });
  const { K, M, free, nodeIndex } = assembled;
  const n = free.length;
  if (!n) throw new Error("没有自由自由度");

  // Rayleigh 阻尼系数：由前两阶弹性模态频率确定。
  const modal = options.modal || solveModal(model, { stageId: options.stageId, modeCount: 2 });
  const modes = modal.modes.filter((m) => m.omega > 1e-6);
  if (!modes.length) throw new Error("模态求解未得到有效频率，无法建立 Rayleigh 阻尼");
  const omega1 = modes[0].omega;
  const omega2 = modes.length > 1 ? modes[1].omega : omega1 * 3;
  const alpha = 2 * zeta * omega1 * omega2 / (omega1 + omega2);
  const betaR = 2 * zeta / (omega1 + omega2);

  // 平铺自由自由度 K / M。
  const Kf = new Float64Array(n * n);
  const Mf = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    const ki = K[free[i]], mi = M[free[i]];
    const base = i * n;
    for (let j = 0; j < n; j++) {
      Kf[base + j] = ki[free[j]];
      Mf[base + j] = mi[free[j]];
    }
  }

  // 地震方向影响向量（含约束自由度），等效荷载取 -M·ι·ag 在自由行上的部分。
  const dirIndex = { x: 0, y: 1, z: 2 }[direction];
  const ndof = model.nodes.length * 6;
  const influenceFull = new Float64Array(ndof);
  for (let d = dirIndex; d < ndof; d += 6) influenceFull[d] = 1;
  const minfluence = matrixVector(M, Array.from(influenceFull));
  const mInertia = new Float64Array(n);       // 自由行上的 M·ι
  let totalInertia = 0;                        // ιᵀMι（全结构）
  for (let i = 0; i < ndof; i++) totalInertia += influenceFull[i] * minfluence[i];
  for (let i = 0; i < n; i++) mInertia[i] = minfluence[free[i]];

  // 自由度号 → free 索引映射（-1 表示约束），逐步记录节点位移用。
  const freeIndexOf = new Int32Array(ndof).fill(-1);
  for (let i = 0; i < n; i++) freeIndexOf[free[i]] = i;

  // Newmark 常数（γ=0.5, β=0.25）。
  const gamma = 0.5, betaN = 0.25;
  const a0 = 1 / (betaN * dt * dt);
  const a1 = gamma / (betaN * dt);
  const a2 = 1 / (betaN * dt);
  const a3 = 1 / (2 * betaN) - 1;
  const a4 = gamma / betaN - 1;
  const a5 = dt * (gamma / (2 * betaN) - 1);
  const a6 = dt * (1 - gamma);
  const a7 = gamma * dt;

  // 有效刚度 Keff = K + a0·M + a1·C，C = αM + βK
  //   = (1 + a1·β)K + (a0 + a1·α)M
  const Keff = new Float64Array(n * n);
  const kMul = 1 + a1 * betaR;
  const mMul = a0 + a1 * alpha;
  for (let i = 0; i < n * n; i++) Keff[i] = kMul * Kf[i] + mMul * Mf[i];
  const fac = luFactor(Keff, n);

  const steps = ag.length;
  const times = new Float64Array(steps);
  const baseShear = new Float64Array(steps);
  const nodeHistory = model.nodes.map((node) => ({
    id: node.id,
    x: new Float64Array(steps),
    y: new Float64Array(steps),
    z: new Float64Array(steps)
  }));

  const u = new Float64Array(n);
  const v = new Float64Array(n);
  const acc = new Float64Array(n);
  const tmp = new Float64Array(n);
  const tmp2 = new Float64Array(n);
  if (options.u0) { if (options.u0.length !== n) throw new Error("u0 长度应等于自由度数 " + n); u.set(options.u0); }
  if (options.v0) { if (options.v0.length !== n) throw new Error("v0 长度应等于自由自由度 " + n); v.set(options.v0); }
  if (options.u0 || options.v0) {
    // 由初始位移/速度反算初始加速度，保证 M a = -K u - C v。
    flatMatVec(Kf, u, n, tmp);
    for (let i = 0; i < n; i++) tmp[i] = -tmp[i];
    if (options.v0) {
      flatMatVec(Mf, v, n, tmp2);
      for (let i = 0; i < n; i++) tmp[i] -= alpha * tmp2[i];
      flatMatVec(Kf, v, n, tmp2);
      for (let i = 0; i < n; i++) tmp[i] -= betaR * tmp2[i];
    }
    // 解 M a = rhs：M 对称正定，用 Cholesky。
    const Mc = cholesky(Array.from(Mf).reduce(function (rows, val, idx) {
      const r = Math.floor(idx / n); (rows[r] = rows[r] || [])[idx % n] = val; return rows;
    }, []));
    const solved = solveLower(Mc, Array.from(tmp));
    const a0v = solveUpper(transpose(Mc), solved);
    acc.set(a0v);
  }
  const pEff = new Float64Array(n);
  const wM = new Float64Array(n);
  const wC = new Float64Array(n);
  const uNew = new Float64Array(n);

  let peakResultant = 0, peakNodeId = null, peakTime = 0, peakStep = 0;
  const peakPerNode = new Float64Array(model.nodes.length);
  let energyInput = 0, energyDamped = 0;

  function recordState(k, t, agk) {
    let q = totalInertia * agk;
    for (let i = 0; i < n; i++) q += mInertia[i] * acc[i];
    baseShear[k] = q;
    for (let ni = 0; ni < model.nodes.length; ni++) {
      const base = ni * 6;
      const hx = nodeHistory[ni].x, hy = nodeHistory[ni].y, hz = nodeHistory[ni].z;
      const ix = freeIndexOf[base], iy = freeIndexOf[base + 1], iz = freeIndexOf[base + 2];
      const ux = ix >= 0 ? u[ix] : 0;
      const uy = iy >= 0 ? u[iy] : 0;
      const uz = iz >= 0 ? u[iz] : 0;
      hx[k] = ux; hy[k] = uy; hz[k] = uz;
      const resultant = Math.hypot(ux, uy, uz);
      if (resultant > peakPerNode[ni]) peakPerNode[ni] = resultant;
      if (resultant > peakResultant) {
        peakResultant = resultant;
        peakNodeId = model.nodes[ni].id;
        peakTime = t;
        peakStep = k;
      }
    }
  }

  let vMvStart = flatQuadratic(Mf, v, n);
  let vKvStart = flatQuadratic(Kf, v, n);

  // t_0 初始状态。
  recordState(0, 0, ag[0]);
  // 逐步推进：用 p(t_{k+1}) = -M·ι·ag[k+1] 解出 t_{k+1} 状态。
  for (let k = 0; k < steps - 1; k++) {
    const agk = ag[k + 1];
    // p̂ = p(t_{k+1}) + M(a0 u + a2 v + a3 a) + C(a1 u + a4 v + a5 a)，Cx = αMx + βKx
    for (let i = 0; i < n; i++) pEff[i] = -mInertia[i] * agk;
    for (let i = 0; i < n; i++) {
      wM[i] = a0 * u[i] + a2 * v[i] + a3 * acc[i];
      wC[i] = a1 * u[i] + a4 * v[i] + a5 * acc[i];
    }
    flatMatVec(Mf, wM, n, tmp);
    for (let i = 0; i < n; i++) pEff[i] += tmp[i];
    flatMatVec(Mf, wC, n, tmp);
    flatMatVec(Kf, wC, n, tmp2);
    for (let i = 0; i < n; i++) pEff[i] += alpha * tmp[i] + betaR * tmp2[i];

    // 能量记账用梯形格式（二阶）：输入功 W=∫p·du ≈ (p_k+p_{k+1})/2·Δu；
    // 阻尼耗散 Ed=∫vᵀCv dt ≈ (v_kᵀCv_k + v_{k+1}ᵀCv_{k+1})/2·Δt。
    const agMid = 0.5 * (ag[k] + agk);
    luSolve(fac, pEff, uNew);
    let inputInc = 0;
    for (let i = 0; i < n; i++) {
      const dU = uNew[i] - u[i];
      inputInc += (-mInertia[i] * agMid) * dU;
      const aNew = a0 * dU - a2 * v[i] - a3 * acc[i];
      v[i] += a6 * acc[i] + a7 * aNew;
      acc[i] = aNew;
      u[i] = uNew[i];
    }
    energyInput += inputInc;
    const vMvEnd = flatQuadratic(Mf, v, n);
    const vKvEnd = flatQuadratic(Kf, v, n);
    energyDamped += 0.5 * (alpha * (vMvStart + vMvEnd) + betaR * (vKvStart + vKvEnd)) * dt;
    vMvStart = vMvEnd;
    vKvStart = vKvEnd;

    recordState(k + 1, (k + 1) * dt, agk);
  }

  const energyKinetic = 0.5 * flatQuadratic(Mf, v, n);
  const energyStrain = 0.5 * flatQuadratic(Kf, u, n);
  // 初值位移/速度带来的初始机械能（自由振动时 E0 = Ek + Es + Ed 守恒）。
  let energyInitial = 0;
  if (options.u0 || options.v0) {
    const uIc = Float64Array.from(options.u0 || new Float64Array(n));
    const vIc = Float64Array.from(options.v0 || new Float64Array(n));
    energyInitial = 0.5 * flatQuadratic(Kf, uIc, n) + 0.5 * flatQuadratic(Mf, vIc, n);
  }
  const energyResidual = energyInput + energyInitial - energyKinetic - energyStrain - energyDamped;

  let peakBaseShear = 0, peakBaseShearTime = 0;
  for (let k = 0; k < steps; k++) {
    if (Math.abs(baseShear[k]) > Math.abs(peakBaseShear)) {
      peakBaseShear = baseShear[k];
      peakBaseShearTime = times[k];
    }
  }

  return {
    kind: "timehistory",
    direction,
    dt,
    steps,
    durationSec: (steps - 1) * dt,
    ag: Float64Array.from(ag),
    times,
    nodeHistory,
    baseShear,
    peakPerNode,
    peak: { nodeId: peakNodeId, value: peakResultant, time: peakTime, step: peakStep },
    peakBaseShear,
    peakBaseShearTime,
    energy: {
      initial: energyInitial,
      input: energyInput,
      kinetic: energyKinetic,
      strain: energyStrain,
      damped: energyDamped,
      residual: energyResidual
    },
    rayleigh: {
      alpha,
      beta: betaR,
      zeta,
      omega1,
      omega2,
      freq1Hz: omega1 / (2 * Math.PI),
      freq2Hz: omega2 / (2 * Math.PI)
    },
    freeDofCount: n
  };
}

const api = {
  dot, vectorDot, cross, norm, normalize, rotationFromAxis, localFrameStiffness,
  localFrameMass, matrixVector, validateModel, activeElementSet, frameElement, trussElement,
  solveLinear, assembleModel, jacobiEigenSymmetric, solveModel, solveModal,
  interpolateSpectrum, cqcCorrelation, combineModalResponses, solveResponseSpectrum,
  luFactor, luSolve, flatMatVec, flatQuadratic, solveTimeHistory,
};

if (typeof module !== "undefined") module.exports = api;
if (typeof window !== "undefined") window.XINGYU_SPATIAL3D = api;
