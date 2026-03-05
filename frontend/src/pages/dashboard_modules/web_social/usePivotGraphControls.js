import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampNumber,
  GRAPH_CENTER_X,
  GRAPH_CENTER_Y,
  GRAPH_DEFAULT_PAN,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM,
  GRAPH_ZOOM_STEP,
  resolveRootNodeId,
} from "./graphLayout";

export const usePivotGraphControls = ({ pivotNodes, pivotNodeById }) => {
  const [graphZoom, setGraphZoom] = useState(1);
  const [graphPan, setGraphPan] = useState(GRAPH_DEFAULT_PAN);
  const [isGraphPanning, setIsGraphPanning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState("");

  const graphCanvasRef = useRef(null);
  const graphZoomRef = useRef(1);
  const graphPanRef = useRef(GRAPH_DEFAULT_PAN);
  const panPointerRef = useRef(null);
  const activePointersRef = useRef(new Map());
  const pinchStateRef = useRef({ distance: 0 });

  const resetGraphViewport = useCallback(() => {
    setGraphZoom(1);
    setGraphPan(GRAPH_DEFAULT_PAN);
  }, []);

  const applyZoomAtViewportPoint = useCallback((requestedZoom, viewportX, viewportY) => {
    const currentZoom = graphZoomRef.current;
    const currentPan = graphPanRef.current;
    const nextZoom = clampNumber(requestedZoom, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
    if (nextZoom === currentZoom) return;

    const worldX = (viewportX - currentPan.x) / currentZoom;
    const worldY = (viewportY - currentPan.y) / currentZoom;
    const nextPan = {
      x: viewportX - worldX * nextZoom,
      y: viewportY - worldY * nextZoom,
    };

    graphZoomRef.current = nextZoom;
    graphPanRef.current = nextPan;
    setGraphZoom(nextZoom);
    setGraphPan(nextPan);
  }, []);

  const zoomGraphIn = useCallback(() => {
    applyZoomAtViewportPoint(graphZoomRef.current + GRAPH_ZOOM_STEP, GRAPH_CENTER_X, GRAPH_CENTER_Y);
  }, [applyZoomAtViewportPoint]);

  const zoomGraphOut = useCallback(() => {
    applyZoomAtViewportPoint(graphZoomRef.current - GRAPH_ZOOM_STEP, GRAPH_CENTER_X, GRAPH_CENTER_Y);
  }, [applyZoomAtViewportPoint]);

  const centerGraphOnNode = useCallback(
    (nodeId) => {
      const node = pivotNodeById.get(nodeId);
      if (!node) return;
      setGraphPan({
        x: GRAPH_CENTER_X - node.x * graphZoomRef.current,
        y: GRAPH_CENTER_Y - node.y * graphZoomRef.current,
      });
    },
    [pivotNodeById]
  );

  const handleGraphWheel = useCallback(
    (event) => {
      event.preventDefault();
      if (!graphCanvasRef.current) return;

      const rect = graphCanvasRef.current.getBoundingClientRect();
      const viewportX = event.clientX - rect.left;
      const viewportY = event.clientY - rect.top;
      const zoomDelta = event.deltaY < 0 ? GRAPH_ZOOM_STEP : -GRAPH_ZOOM_STEP;
      applyZoomAtViewportPoint(graphZoomRef.current + zoomDelta, viewportX, viewportY);
    },
    [applyZoomAtViewportPoint]
  );

  const handleGraphPointerDown = useCallback((event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointersRef.current.size >= 2) {
      const [p1, p2] = Array.from(activePointersRef.current.values());
      pinchStateRef.current.distance = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      panPointerRef.current = null;
      setIsGraphPanning(false);
    } else {
      panPointerRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      setIsGraphPanning(true);
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handleGraphPointerMove = useCallback(
    (event) => {
      if (activePointersRef.current.has(event.pointerId)) {
        activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      if (activePointersRef.current.size >= 2) {
        if (!graphCanvasRef.current) return;
        const [p1, p2] = Array.from(activePointersRef.current.values());
        const nextDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const previousDistance = pinchStateRef.current.distance || nextDistance;
        const midpointClientX = (p1.x + p2.x) / 2;
        const midpointClientY = (p1.y + p2.y) / 2;
        const rect = graphCanvasRef.current.getBoundingClientRect();
        const viewportX = midpointClientX - rect.left;
        const viewportY = midpointClientY - rect.top;

        if (previousDistance > 0 && nextDistance > 0) {
          applyZoomAtViewportPoint(graphZoomRef.current * (nextDistance / previousDistance), viewportX, viewportY);
        }

        pinchStateRef.current.distance = nextDistance || previousDistance;
        setIsGraphPanning(false);
        return;
      }

      if (!isGraphPanning || !panPointerRef.current) return;
      const dx = event.clientX - panPointerRef.current.x;
      const dy = event.clientY - panPointerRef.current.y;
      if (dx === 0 && dy === 0) return;

      setGraphPan((current) => ({ x: current.x + dx, y: current.y + dy }));
      graphPanRef.current = {
        x: graphPanRef.current.x + dx,
        y: graphPanRef.current.y + dy,
      };
      panPointerRef.current = { ...panPointerRef.current, x: event.clientX, y: event.clientY };
    },
    [applyZoomAtViewportPoint, isGraphPanning]
  );

  const handleGraphPointerUp = useCallback((event) => {
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStateRef.current.distance = 0;
    }

    if (activePointersRef.current.size === 1) {
      const [remainingPointerId, remainingPoint] = Array.from(activePointersRef.current.entries())[0];
      panPointerRef.current = { x: remainingPoint.x, y: remainingPoint.y, pointerId: remainingPointerId };
      setIsGraphPanning(true);
    }

    if (panPointerRef.current?.pointerId === event.pointerId) {
      panPointerRef.current = null;
    }
    if (activePointersRef.current.size === 0) {
      setIsGraphPanning(false);
    }

    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // noop: capture may already be released
    }
  }, []);

  useEffect(() => {
    graphZoomRef.current = graphZoom;
  }, [graphZoom]);

  useEffect(() => {
    graphPanRef.current = graphPan;
  }, [graphPan]);

  useEffect(() => {
    if (pivotNodes.length === 0) {
      setSelectedNodeId("");
      return;
    }
    const rootId = resolveRootNodeId(pivotNodes);
    setSelectedNodeId(rootId || pivotNodes[0].id);
    resetGraphViewport();
  }, [pivotNodes, resetGraphViewport]);

  useEffect(
    () => () => {
      activePointersRef.current.clear();
      panPointerRef.current = null;
      pinchStateRef.current.distance = 0;
    },
    []
  );

  return {
    graphZoom,
    graphPan,
    isGraphPanning,
    selectedNodeId,
    setSelectedNodeId,
    graphCanvasRef,
    resetGraphViewport,
    zoomGraphIn,
    zoomGraphOut,
    centerGraphOnNode,
    handleGraphWheel,
    handleGraphPointerDown,
    handleGraphPointerMove,
    handleGraphPointerUp,
  };
};
