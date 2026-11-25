// Read-only analysis of the bounded, already-authorised API response.
// Groups are undirected connected components of scored incident similarities
// at/above the threshold. Cross-group links are NOT necessarily graph bridges.
export function caseConnectingLinks(network, threshold = 0.75) {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw Error('Invalid grouping threshold.');
  const nodes = (network?.nodes || []).filter(node => node.type === 'incident');
  const ids = new Set(nodes.map(node => node.id));
  const parent = new Map(nodes.map(node => [node.id, node.id]));
  const root = id => { while (parent.get(id) !== id) id = parent.get(id); return id; };
  let omittedEdges = 0, unscoredEdges = 0;
  const edges = (network?.edges || []).flatMap((edge, index) => {
    if (edge.type !== 'semantic similarity') return [];
    if (!ids.has(edge.source) || !ids.has(edge.target)) { omittedEdges++; return []; }
    const scored = Number.isFinite(edge.score) && edge.score >= 0 && edge.score <= 1;
    if (!scored) unscoredEdges++;
    return [{...edge, connectionId: `comparison-${index}`, scored}];
  });
  for (const edge of edges) if (edge.scored && edge.score >= threshold) parent.set(root(edge.source), root(edge.target));
  const groupsByRoot = new Map();
  for (const node of [...nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = root(node.id);
    if (!groupsByRoot.has(key)) groupsByRoot.set(key, []);
    groupsByRoot.get(key).push(node.id);
  }
  const groups = [...groupsByRoot.values()], groupFor = new Map();
  groups.forEach((members, index) => members.forEach(id => groupFor.set(id, index + 1)));
  const comparisons = edges.map(edge => ({...edge, connectionMode: true,
    sourceGroup: groupFor.get(edge.source), targetGroup: groupFor.get(edge.target),
    connectionHighlight: edge.scored && groupFor.get(edge.source) !== groupFor.get(edge.target),
  }));
  return {groups, omittedEdges, unscoredEdges, connections: comparisons.filter(edge => edge.connectionHighlight),
    network: {...network, connectionFocus: true, nodes: nodes.map(node => ({...node, connectionGroup: groupFor.get(node.id), detail: `Group ${groupFor.get(node.id)} · ${node.detail || ''}`})), edges: comparisons},
  };
}
