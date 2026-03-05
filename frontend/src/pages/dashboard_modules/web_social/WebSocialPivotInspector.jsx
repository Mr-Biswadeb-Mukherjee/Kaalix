import { truncateLabel } from "./graphLayout";

const WebSocialPivotInspector = ({
  selectedNode,
  selectedNodeRelations,
  selectedNodeEvidence,
  pivotNodeById,
  centerGraphOnNode,
}) => {
  if (!selectedNode) {
    return (
      <aside className="osint-graph-panel osint-pivot-inspector">
        <p>Select a node in the graph to inspect pivot details.</p>
      </aside>
    );
  }

  return (
    <aside className="osint-graph-panel osint-pivot-inspector">
      <div className="osint-pivot-selected">
        <strong title={selectedNode.label || selectedNode.id}>{selectedNode.label || selectedNode.id || "Selected node"}</strong>
        <small>{selectedNode.type || "unknown"} | {selectedNode.source || "unknown source"}</small>
      </div>
      <p className="osint-pivot-description">Node ID: {selectedNode.id}</p>
      <p className="osint-pivot-meta">
        Confidence: {Number.isFinite(selectedNode.confidence) ? `${Math.round(Number(selectedNode.confidence) * 100)}%` : "n/a"}
      </p>
      <div className="osint-pivot-actions">
        {selectedNode.url ? (
          <a href={selectedNode.url} target="_blank" rel="noreferrer">
            Open Source
          </a>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => centerGraphOnNode(selectedNode.id)}>
          Center Node
        </button>
      </div>

      <section>
        <h5>Relations ({selectedNodeRelations.length})</h5>
        {selectedNodeRelations.length === 0 ? (
          <p className="web-social-search-empty">No relations for this node.</p>
        ) : (
          <ul className="osint-graph-list osint-pivot-relation-list">
            {selectedNodeRelations.slice(0, 24).map((edge) => {
              const counterpartId = edge.fromNode.id === selectedNode.id ? edge.toNode.id : edge.fromNode.id;
              const counterpart = pivotNodeById.get(counterpartId);
              return (
                <li key={`${selectedNode.id}|${edge.id}`}>
                  <div className="osint-edge-line">
                    <span>{truncateLabel(counterpart?.label || counterpartId, 20)}</span>
                    <strong>{edge?.relation || "linked_to"}</strong>
                  </div>
                  <p>Source: {edge?.source || "unknown"}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h5>Evidence ({selectedNodeEvidence.length})</h5>
        {selectedNodeEvidence.length === 0 ? (
          <p className="web-social-search-empty">No evidence attached.</p>
        ) : (
          <ul className="osint-graph-list osint-node-evidence-list">
            {selectedNodeEvidence.slice(0, 24).map((entry, index) => (
              <li key={`${selectedNode.id}-evidence-${index}`}>
                <div>
                  <span>{entry?.label || "Collector evidence"}</span>
                  <small>{entry?.source || "unknown"}</small>
                </div>
                {entry?.url ? (
                  <a href={entry.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
};

export default WebSocialPivotInspector;
