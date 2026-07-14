// Deterministic large-document generator for performance benchmarks (issue #16).
// Pure JS, no app imports — it produces a CareFlow project JSON matching the current schema so the
// same document can be loaded in the editor (Open JSON) for manual interaction testing and measured
// headlessly for serialization/traversal regressions. Same seed => byte-identical output.

const KIND_COLOR = {
  emr: "#2859d9", interface: "#7c4dff", application: "#00a78e",
  database: "#e67e22", device: "#d14d72", cloud: "#5a7184",
};
const KINDS = Object.keys(KIND_COLOR);

const CAPS = {
  HL7: { color: "#2f6df6", subtypes: ["ADT", "SIU", "ORM", "ORU"] },
  FHIR: { color: "#7c4dff", subtypes: ["REST", "Subscription", "Bundle", "Messaging"] },
  DICOM: { color: "#00a78e", subtypes: ["MWL", "C-STORE SCU", "C-STORE SCP", "MPPS"] },
  TCP: { color: "#e67e22", subtypes: ["Client", "Server", "MLLP"] },
  "General Data": { color: "#64748b", subtypes: ["File", "API", "Message", "Manual"] },
};
const CAP_NAMES = Object.keys(CAPS);

// Small deterministic PRNG (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

export function generateBenchmarkProject({ nodeCount = 500, connectionCount = 300, containerCount = 25, seed = 1 } = {}) {
  const rand = rng(seed);
  const cols = Math.ceil(Math.sqrt(nodeCount)) + 2;
  const CW = 300, CH = 260; // cell size
  const nodesPerContainer = Math.ceil(nodeCount / containerCount);

  const containers = [];
  for (let c = 0; c < containerCount; c++) {
    const cxCols = 5;
    const gx = (c % cxCols) * (CW * 4 + 80);
    const gy = Math.floor(c / cxCols) * (CH * Math.ceil(nodesPerContainer / 4) + 160);
    containers.push({
      id: `container-${c}`, name: `Site ${c + 1}`, description: `Benchmark location ${c + 1}`,
      kind: c % 2 ? "physical" : "logical", x: gx, y: gy + 60,
      width: CW * 4 + 40, height: CH * Math.ceil(nodesPerContainer / 4) + 60,
      color: pick(rand, ["#2f6df6", "#00a78e", "#e67e22", "#7c4dff"]), opacity: 0.08,
    });
  }

  const nodes = [];
  const outbound = {}; const inbound = {}; // capability -> [{nodeId, portId}]
  CAP_NAMES.forEach((cap) => { outbound[cap] = []; inbound[cap] = []; });

  for (let i = 0; i < nodeCount; i++) {
    const containerIndex = Math.floor(i / nodesPerContainer);
    const container = containers[containerIndex];
    const withinIndex = i % nodesPerContainer;
    const col = withinIndex % 4;
    const row = Math.floor(withinIndex / 4);
    const kind = KINDS[i % KINDS.length];
    const cap = CAP_NAMES[i % CAP_NAMES.length];
    const cap2 = CAP_NAMES[(i + 2) % CAP_NAMES.length];
    const id = `node-${i}`;
    const inPort = `${id}-in`;
    const outPort = `${id}-out`;
    nodes.push({
      id, name: `${kind.toUpperCase()} System ${i}`, kind,
      description: `Benchmark node ${i} in ${container.name}. 10.${i % 256}.${(i * 7) % 256}.${(i * 13) % 256}`,
      x: container.x + 20 + col * CW, y: container.y + 30 + row * CH,
      width: 232, height: 176, color: KIND_COLOR[kind], containerId: container.id,
      capabilities: [cap, cap2],
      ports: [
        { id: inPort, name: `${CAPS[cap].subtypes[0]} In`, direction: "inbound", capability: cap, subtype: CAPS[cap].subtypes[0], side: "left" },
        { id: outPort, name: `${CAPS[cap].subtypes[1] ?? CAPS[cap].subtypes[0]} Out`, direction: "outbound", capability: cap, subtype: CAPS[cap].subtypes[1] ?? CAPS[cap].subtypes[0], side: "right" },
      ],
    });
    inbound[cap].push({ nodeId: id, portId: inPort });
    outbound[cap].push({ nodeId: id, portId: outPort });
  }

  const connections = [];
  for (let k = 0; k < connectionCount; k++) {
    const cap = CAP_NAMES[k % CAP_NAMES.length];
    const outs = outbound[cap]; const ins = inbound[cap];
    if (!outs.length || !ins.length) continue;
    const src = pick(rand, outs);
    let dst = pick(rand, ins);
    if (dst.nodeId === src.nodeId) dst = ins[(ins.indexOf(dst) + 1) % ins.length];
    const sub = pick(rand, CAPS[cap].subtypes);
    const conn = {
      id: `conn-${k}`, sourceNodeId: src.nodeId, sourcePortId: src.portId,
      targetNodeId: dst.nodeId, targetPortId: dst.portId, capability: cap, subtype: sub,
      dataType: `${cap} ${sub} payload`, description: `Benchmark connection ${k}`,
    };
    // Label roughly every third connection to exercise segment-label rendering + text volume.
    if (k % 3 === 0) {
      conn.labels = [{ id: `conn-${k}-l0`, text: `${cap} ${sub}`, anchor: "route", position: 0.5, offsetX: 0, offsetY: -14, background: true, rotation: 0 }];
    }
    connections.push(conn);
  }

  return {
    version: 1, id: "benchmark-500", name: `Performance Benchmark (${nodeCount} nodes)`,
    description: `Deterministic benchmark document: ${nodeCount} nodes, ${connections.length} connections, ${containerCount} containers.`,
    presentation: "detailed", updatedAt: "2024-01-01T00:00:00.000Z",
    canvas: { mode: "infinite", width: 4000, height: 3000 },
    containers, nodes, connections,
    processes: [{ id: "proc-bench", name: "Benchmark flow", description: "Sample flow across the first nodes.", checkpoints: nodes.slice(0, 5).map((n) => n.id), color: "#2f6df6" }],
    customLibrary: [], nodeTemplates: [],
  };
}

// Count rendered text-bearing items (node names + subtitles + ports + capability chips + connection labels).
export function countTextItems(project) {
  let text = 0;
  for (const node of project.nodes) {
    text += 2; // name + subtitle
    text += node.ports.length;
    text += node.capabilities.length;
  }
  for (const conn of project.connections) text += (conn.labels?.length ?? 0);
  for (const container of project.containers) text += 2; // kind badge + name
  return text;
}
