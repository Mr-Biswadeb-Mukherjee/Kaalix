import {
  formatDateTime,
  getStatusClass,
  getStatusLabel,
} from "./graphLayout";
import WebSocialPivotGraphPanel from "./WebSocialPivotGraphPanel";
import WebSocialPivotInspector from "./WebSocialPivotInspector";

const WebSocialSearchResults = ({
  query,
  searchResult,
  graphNodes,
  graphEdges,
  sourceStatuses,
  timeline,
  summary,
  pivotNodes,
  pivotEdges,
  pivotNodeById,
  selectedNode,
  selectedNodeRelations,
  selectedNodeEvidence,
  graphControls,
}) => (
  <section className="osint-graph-result web-social-search-results" aria-live="polite">
    <header className="osint-graph-head">
      <div>
        <h4>Results for "{searchResult?.query || query.trim()}"</h4>
        <p>
          Type: {searchResult?.queryType || "query"} | Generated: {formatDateTime(searchResult?.generatedAt)}
        </p>
      </div>
      <div className="osint-graph-metrics">
        <span>{Number(summary?.nodes) || graphNodes.length} Nodes</span>
        <span>{Number(summary?.edges) || graphEdges.length} Edges</span>
        <span>{summary?.sourceHealth || `${sourceStatuses.length}/${sourceStatuses.length}`}</span>
      </div>
    </header>

    {sourceStatuses.length > 0 ? (
      <div className="osint-source-status-grid">
        {sourceStatuses.map((source, sourceIndex) => {
          const statusClass = getStatusClass(source?.status);
          return (
            <article
              key={source?.id || source?.label || `source-${sourceIndex}`}
              className={`osint-source-chip ${statusClass}`}
            >
              <h5>{source?.label || "Collector"}</h5>
              <p>
                Status: {getStatusLabel(source?.status)} | Records: {Number(source?.records) || 0}
              </p>
              {source?.error ? <small>{source.error}</small> : null}
            </article>
          );
        })}
      </div>
    ) : null}

    {timeline.length > 0 ? (
      <section className="osint-build-timeline">
        <h5>Build Timeline</h5>
        <ul className="osint-build-timeline-list">
          {timeline.map((entry) => {
            const statusClass = getStatusClass(entry?.status);
            return (
              <li
                key={entry?.id || `${entry?.label || "step"}-${entry?.completedAt || ""}`}
                className={statusClass}
              >
                <div>
                  <strong>{entry?.label || "Collector step"}</strong>
                  <span>{getStatusLabel(entry?.status)}</span>
                </div>
                <p>{entry?.message || entry?.detail || "Completed."}</p>
                <small>{formatDateTime(entry?.completedAt)}</small>
              </li>
            );
          })}
        </ul>
      </section>
    ) : null}

    <div className="osint-pivot-layout">
      <WebSocialPivotGraphPanel
        graphCanvasRef={graphControls.graphCanvasRef}
        graphZoom={graphControls.graphZoom}
        graphPan={graphControls.graphPan}
        isGraphPanning={graphControls.isGraphPanning}
        pivotEdges={pivotEdges}
        pivotNodes={pivotNodes}
        selectedNodeId={graphControls.selectedNodeId}
        setSelectedNodeId={graphControls.setSelectedNodeId}
        zoomGraphIn={graphControls.zoomGraphIn}
        zoomGraphOut={graphControls.zoomGraphOut}
        resetGraphViewport={graphControls.resetGraphViewport}
        handleGraphWheel={graphControls.handleGraphWheel}
        handleGraphPointerDown={graphControls.handleGraphPointerDown}
        handleGraphPointerMove={graphControls.handleGraphPointerMove}
        handleGraphPointerUp={graphControls.handleGraphPointerUp}
      />

      <WebSocialPivotInspector
        selectedNode={selectedNode}
        selectedNodeRelations={selectedNodeRelations}
        selectedNodeEvidence={selectedNodeEvidence}
        pivotNodeById={pivotNodeById}
        centerGraphOnNode={graphControls.centerGraphOnNode}
      />
    </div>
  </section>
);

export default WebSocialSearchResults;
