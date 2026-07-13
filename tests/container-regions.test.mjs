import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("persists containers and explicit node relationships", async () => {
  const [types, project, containers] = await Promise.all([
    readFile(new URL("app/model/types.ts", root), "utf8"),
    readFile(new URL("app/model/project.ts", root), "utf8"),
    readFile(new URL("app/model/containers.ts", root), "utf8"),
  ]);

  assert.match(types, /export type DiagramContainer/);
  assert.match(types, /containerId\?: string/);
  assert.match(types, /containers: DiagramContainer\[\]/);
  assert.match(project, /Array\.isArray\(project\.containers\)/);
  assert.match(project, /containerIds\.has\(node\.containerId/);
  assert.match(containers, /function containerForNode/);
  assert.match(containers, /function reconcileNodeContainers/);
});

test("supports protected container creation, editing, and deletion", async () => {
  const [app, toolbar, commands, layer, interactions] = await Promise.all([
    readFile(new URL("app/DiagramApp.tsx", root), "utf8"),
    readFile(new URL("app/components/CanvasToolbar.tsx", root), "utf8"),
    readFile(new URL("app/model/commands.ts", root), "utf8"),
    readFile(new URL("app/components/canvas/ContainerLayer.tsx", root), "utf8"),
    readFile(new URL("app/hooks/useContainerInteractions.ts", root), "utf8"),
  ]);

  assert.match(app, /containerEditing/);
  assert.match(toolbar, /aria-label="Edit containers"/);
  assert.match(toolbar, /aria-label="Add container"/);
  assert.match(commands, /type: "container\.add"/);
  assert.match(commands, /type: "container\.update"/);
  assert.match(commands, /command\.selection\.type === "container"/);
  assert.match(layer, /if \(!editing\) return/);
  assert.match(layer, /container-resize/);
  assert.match(interactions, /beginContainerDrag/);
  assert.match(interactions, /beginContainerResize/);
});

test("renders containers behind connections in local SVG exports", async () => {
  const source = await readFile(new URL("app/model/exportSvg.ts", root), "utf8");
  const containerLayer = source.indexOf("for (const container of project.containers) layers.push(renderContainer(container))");
  const connectionLayer = source.indexOf("for (const connection of project.connections) layers.push(renderConnection(project, connection.id))");

  assert.match(source, /function renderContainer/);
  assert.ok(containerLayer >= 0 && containerLayer < connectionLayer, "containers should export behind connections");
  assert.match(source, /fill-opacity="\$\{container\.opacity\}"/);
});
