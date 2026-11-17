const MERMAID_SOURCE =
  /^\s*(?:flowchart|graph(?:\s+(?:TD|TB|BT|RL|LR))?|sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta)\b/i

export function looksLikeMermaidSource(value: string) {
  return MERMAID_SOURCE.test(value)
}
