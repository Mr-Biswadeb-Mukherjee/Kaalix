import {
  getNodeColor,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM,
  GRAPH_VIEW_HEIGHT,
  GRAPH_VIEW_WIDTH,
  truncateLabel,
} from "./graphLayout";

const WebSocialPivotGraphPanel = ({
  graphCanvasRef,
  graphZoom,
  graphPan,
  isGraphPanning,
  pivotEdges,
  pivotNodes,
  selectedNodeId,
  setSelectedNodeId,
  zoomGraphIn,
  zoomGraphOut,
  resetGraphViewport,
  handleGraphWheel,
  handleGraphPointerDown,
  handleGraphPointerMove,
  handleGraphPointerUp,
}) => (
  <article className="osint-graph-panel osint-pivot-canvas-panel">
    <div className="osint-pivot-canvas-head">
      <h5>Pivot Graph</h5>
      <div className="osint-pivot-canvas-tools">
        <div className="osint-graph-zoom-controls">
          <button
            type="button"
            onClick={zoomGraphOut}
            disabled={graphZoom <= GRAPH_MIN_ZOOM}
            aria-label="Zoom out graph"
          >
            -
          </button>
          <span>{graphZoom.toFixed(2)}x</span>
          <button
            type="button"
            onClick={zoomGraphIn}
            disabled={graphZoom >= GRAPH_MAX_ZOOM}
            aria-label="Zoom in graph"
          >
            +
          </button>
          <button type="button" className="secondary" onClick={resetGraphViewport}>
            Reset
          </button>
        </div>
      </div>
    </div>

    <p>
      Drag to move the graph in any direction. Use scroll or +/- to zoom. Click a node to inspect linked pivots.
    </p>

    <div className={`osint-pivot-canvas-wrap ${isGraphPanning ? "dragging" : ""}`} ref={graphCanvasRef}>
      <svg
        className="osint-pivot-svg"
        viewBox={`0 0 ${GRAPH_VIEW_WIDTH} ${GRAPH_VIEW_HEIGHT}`}
        role="img"
        aria-label="Pivot graph visualization"
        onWheel={handleGraphWheel}
        onPointerMove={handleGraphPointerMove}
        onPointerUp={handleGraphPointerUp}
        onPointerLeave={handleGraphPointerUp}
        onPointerCancel={handleGraphPointerUp}
      >
        <rect
          className="osint-pivot-canvas-hitbox"
          x="0"
          y="0"
          width={GRAPH_VIEW_WIDTH}
          height={GRAPH_VIEW_HEIGHT}
          onPointerDown={handleGraphPointerDown}
        />

        <g transform={`translate(${graphPan.x} ${graphPan.y}) scale(${graphZoom})`}>
          {pivotEdges.map((edge) => {
            const isActive = selectedNodeId && (edge.fromNode.id === selectedNodeId || edge.toNode.id === selectedNodeId);
            return (
              <line
                key={edge.id}
                className={`osint-pivot-edge ${isActive ? "active" : ""}`}
                x1={edge.fromNode.x}
                y1={edge.fromNode.y}
                x2={edge.toNode.x}
                y2={edge.toNode.y}
              />
            );
          })}

          {pivotNodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            return (
              <g
                key={node.id}
                className={`osint-pivot-node ${isSelected ? "selected" : ""}`}
                transform={`translate(${node.x} ${node.y})`}
                onClick={() => setSelectedNodeId(node.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setSelectedNodeId(node.id);
                }}
              >
                <circle
                  r={node.radius || 20}
                  fill={getNodeColor(node.type)}
                  stroke={isSelected ? "#f8fafc" : "rgba(248, 250, 252, 0.5)"}
                  strokeWidth={isSelected ? 2.6 : 1.4}
                />
                <text x="0" y={Number(node.radius || 20) + 16} textAnchor="middle">
                  {truncateLabel(node.label || node.id, 24)}
                </text>
              </g>
            );
          })}
        </g>

      </svg>
    </div>
  </article>
);

export default WebSocialPivotGraphPanel;
