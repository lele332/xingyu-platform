"use strict";

const assert = require("node:assert/strict");
const spatial = require("./spatial-frame3d");
const {
  solveModel, solveModal, solveResponseSpectrum, frameElement,
  interpolateSpectrum, cqcCorrelation, combineModalResponses
} = spatial;
global.window = global;
global.XINGYU_SPATIAL3D = spatial;
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.addEventListener = () => {};
global.matchMedia = () => ({ matches: true });
require("./spatial-bridge");

function baseModel({ load = [0, 0, 0, 0, 0, 0], section = {} } = {}) {
  return {
    schemaVersion: "0.1.0",
    units: { force: "kN", length: "m", stress: "kPa" },
    nodes: [
      { id: "N1", xyz: [0, 0, 0], mass: [1, 1, 1, 1, 1, 1] },
      { id: "N2", xyz: [10, 0, 0], mass: [1000, 1000, 1000, 1000, 1000, 1000] },
    ],
    elements: [{
      id: "E1", type: "frame3d", i: "N1", j: "N2",
      materialId: "M1", sectionId: "S1", orientation: [0, 0, 1],
    }],
    materials: [{ id: "M1", name: "test", E: 200000000, nu: 0.3, density: 0 }],
    sections: [{ id: "S1", name: "test", A: 0.01, Iy: 0.1, Iz: 0.1, J: 0.1, ...section }],
    restraints: [{ nodeId: "N1", fixed: [true, true, true, true, true, true] }],
    loadCases: [{ id: "LC1", name: "test", nodalLoads: [{ nodeId: "N2", load }] }],
    stages: [{ id: "ST1", name: "all", activeGroups: [] }],
    analysisCases: [{ id: "A1", type: "linear-static", loadCaseIds: ["LC1"] }],
  };
}

{
  const model = baseModel({ load: [1000, 0, 0, 0, 0, 0] });
  const result = solveModel(model, "LC1");
  const expected = 1000 * 10 / (200000000 * 0.01);
  assert.ok(Math.abs(result.U[6] - expected) < 1e-10, `axial displacement ${result.U[6]} vs ${expected}`);
}

{
  const model = baseModel({ load: [0, 0, -100, 0, 0, 0] });
  const result = solveModel(model, "LC1");
  const expected = -100 * 10 ** 3 / (3 * 200000000 * 0.1);
  assert.ok(Math.abs(result.U[8] - expected) < 1e-9, `3D cantilever displacement ${result.U[8]} vs ${expected}`);
}

{
  const model = baseModel({ load: [0, 100, 0, 0, 0, 0] });
  const result = solveModel(model, "LC1");
  assert.ok(result.U[7] > 0, "transverse displacement has expected sign");
}

{
  const model = baseModel({ load: [1000, 0, 0, 0, 0, 0] });
  const result = solveModel(model, "LC1");
  assert.ok(result.equilibriumResidualMax < 1e-8, "global equilibrium residual is near zero");
  assert.equal(result.elements.length, 1, "one active element has recovered forces");
  assert.ok(Math.abs(result.elements[0].axialForceI - 1000) < 1e-8, "fixed-end axial force balances load");
}

{
  const model = baseModel({ load: [0, 0, -100, 0, 0, 0] });
  model.stages = [
    { id: "ST1", name: "deck only", activeGroups: ["deck"] },
    { id: "ST2", name: "empty", activeGroups: ["pier"] },
  ];
  model.elements[0].group = "deck";
  assert.equal(solveModel(model, "LC1", { stageId: "ST1" }).activeElementIds.length, 1, "stage activates deck");
  assert.throws(() => solveModel(model, "LC1", { stageId: "ST2" }), /Singular matrix/, "inactive stage exposes mechanism");
}

{
  const nodes = { a: { id: "a", xyz: [0, 0, 0] }, b: { id: "b", xyz: [0, 3, 4] } };
  const material = { E: 200000000, nu: 0.3 };
  const section = { A: 0.01, Iy: 0.1, Iz: 0.1, J: 0.1 };
  const element = frameElement({ id: "E", i: "a", j: "b", orientation: [1, 0, 0] }, nodes, material, section);
  assert.ok(Math.abs(element.L - 5) < 1e-12, "skew member length is correct");
  const ex = element.R[0];
  assert.ok(Math.abs(ex[0]) < 1e-12 && Math.abs(ex[1] - 0.6) < 1e-12 && Math.abs(ex[2] - 0.8) < 1e-12, "skew local axis is correct");
}

{
  const model = baseModel({ load: [0, 0, 0, 0, 0, 0] });
  const modal = solveModal(model, { modeCount: 6 });
  assert.ok(modal.modes.length >= 3, "modal analysis returns positive modes");
  assert.ok(modal.modes[0].frequencyHz > 0, "first natural frequency is positive");
  assert.ok(modal.modes.every((mode, i, modes) => i === 0 || mode.frequencyHz >= modes[i - 1].frequencyHz), "modes are sorted");
  assert.equal(modal.eigensolver.converged, true, "Jacobi eigensolver converges");
}

{
  const model = baseModel({ load: [0, 0, 0, 0, 0, 0] });
  const modal = solveModal(model, { modeCount: 6 });
  for (const key of ["x", "y", "z"]) {
    assert.ok(Number.isFinite(modal.participation.totalMass[key]), key + " total mass is finite");
    assert.ok(modal.participation.cumulativeRatio[key] >= 0, key + " cumulative ratio is non-negative");
    assert.ok(modal.participation.cumulativeRatio[key] <= 1.000001, key + " cumulative ratio does not exceed one");
  }
  assert.equal(modal.diagnostics.masslessDofCount, 0, "all free DOFs have mass");
  assert.ok(modal.diagnostics.stiffnessDiagonal.ratio > 0, "stiffness diagnostic is available");
}

{
  const model = baseModel({ load: [1000, 0, 0, 0, 0, 0] });
  model.elements[0].type = "truss3d";
  model.restraints.push({ nodeId: "N2", fixed: [false, true, true, false, false, false] });
  const result = solveModel(model, "LC1");
  const expected = 1000 * 10 / (200000000 * 0.01);
  assert.ok(Math.abs(result.U[6] - expected) < 1e-10, "3D truss axial displacement matches PL/EA");
}

{
  for (const type of ["girder", "arch", "cable", "suspension"]) {
    const result = global.SPATIAL_BRIDGE.analyze({
      bridgeType: type, spans: [30], width: 10, segmentsPerSpan: 3,
      archL: 60, archF: 12,
      cableL: 400, cableSide: 140, cableH: 80,
      suspL: 1000, suspF: 100, suspH: 120,
      modeCount: 4
    });
    assert.equal(result.model.bridgeType, type, type + " model type is preserved");
    assert.ok(result.model.nodes.length > 0 && result.model.elements.length > 0, type + " model has geometry");
    assert.ok(result.modal.modes.length >= 1 && result.modal.modes[0].frequencyHz > 0, type + " modal analysis succeeds");
    if (type === "cable") {
      const midpoint = result.model.metadata.sideSpan + result.model.metadata.mainSpan / 2;
      const byId = new Map(result.model.nodes.map(node => [node.id, node]));
      for (const element of result.model.elements.filter(element => element.type === "cable3d")) {
        const a = byId.get(element.i), deck = byId.get(element.j);
        assert.ok(a.xyz[0] < midpoint ? deck.xyz[0] <= midpoint : deck.xyz[0] >= midpoint,
          "3D cable-stayed stays do not cross the main-span midpoint");
      }
    }
  }
}

{
  const points = [{ period: 0, acceleration: 1 }, { period: 1, acceleration: 3 }];
  assert.equal(interpolateSpectrum(points, 0.5), 2, "response spectrum interpolation is linear");
  assert.equal(cqcCorrelation(10, 10, 0.05), 1, "CQC self-correlation is one");
  assert.ok(cqcCorrelation(10, 10.5, 0.05) > cqcCorrelation(10, 20, 0.05), "CQC correlates close modes more strongly");
}

{
  const combined = combineModalResponses([[3, 0], [4, 5]], [10, 20], "SRSS", 0.05);
  assert.ok(Math.abs(combined[0] - 5) < 1e-12 && Math.abs(combined[1] - 5) < 1e-12,
    "SRSS combines modal responses by square root of sum of squares");
}

{
  const model = global.SPATIAL_BRIDGE.buildBridgeModel({
    bridgeType: "girder", spans: [30], width: 10, segmentsPerSpan: 3
  });
  const response = solveResponseSpectrum(model, [
    { period: 0, acceleration: 1.962 },
    { period: 0.1, acceleration: 4.905 },
    { period: 0.5, acceleration: 4.905 },
    { period: 2.0, acceleration: 0.981 },
    { period: 4.0, acceleration: 0.245 }
  ], { direction: "y", method: "CQC", dampingRatio: 0.05, modeCount: 8 });
  assert.equal(response.method, "CQC", "response spectrum method is retained");
  assert.ok(response.maxNodeResultant > 0 && Number.isFinite(response.maxNodeResultant),
    "response spectrum produces a finite displacement envelope");
  assert.equal(response.combinedDisplacement.length, model.nodes.length * 6,
    "response spectrum returns all global DOFs");
}

console.log("xingyu spatial frame3d: 13/13 tests passed");
