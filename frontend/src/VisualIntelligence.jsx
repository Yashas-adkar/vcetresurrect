import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Handle, Position, useReactFlow } from '@xyflow/react'
import { Box, Download, Expand, Maximize2, Minus, Plus, RotateCcw, Search, X } from 'lucide-react'
import { colorFor } from './visualColors.js'
import '@xyflow/react/dist/style.css'
import './VisualIntelligence.css'

const ThreeCanvas = lazy(() => import('./ThreeCanvas.jsx'))

function displayDetails(item) {
  return [
    item.description && ['Description', item.description],
    item.importance && ['Importance', item.importance],
    item.responsibility && ['Responsibility', item.responsibility],
    item.evidence && ['Source evidence', item.evidence],
    item.inputs?.length && ['Inputs', item.inputs.join(', ')],
    item.outputs?.length && ['Outputs', item.outputs.join(', ')],
    item.dependencies?.length && ['Dependencies', item.dependencies.join(', ')],
    item.page_references?.length && ['Pages', item.page_references.join(', ')],
    item.group && ['Group', item.group],
  ].filter(Boolean)
}

function getLayout(nodes, tool) {
  const width = 1120
  const nodeWidth = 188
  const nodeHeight = 76
  const positions = new Map()
  const toolLower = tool.toLowerCase()

  if (toolLower === 'flowchart' || toolLower === 'process visualization') {
    const ordered = [...nodes].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(ordered.length))))
    ordered.forEach((node, index) => {
      positions.set(node.id, {
        x: 70 + (index % columns) * 260,
        y: 70 + Math.floor(index / columns) * 160,
      })
    })
  } else if (toolLower === 'concept map') {
    const levels = new Map()
    nodes.forEach((node) => {
      const level = Math.min(4, Math.max(0, node.hierarchy_level ?? (node.category.toLowerCase().includes('central') ? 0 : 1)))
      levels.set(level, [...(levels.get(level) || []), node])
    })
    for (const [level, group] of levels) {
      group.forEach((node, index) => {
        positions.set(node.id, {
          x: 70 + index * 250 + (level % 2) * 30,
          y: 55 + level * 155,
        })
      })
    }
  } else if (toolLower === 'architecture diagram') {
    const groups = new Map()
    nodes.forEach((node) => {
      const group = node.group || 'Research components'
      groups.set(group, [...(groups.get(group) || []), node])
    })
    let row = 0
    for (const group of groups.values()) {
      group.forEach((node, index) => {
        positions.set(node.id, {
          x: 70 + (index % 4) * 255,
          y: 65 + row * 165 + Math.floor(index / 4) * 125,
        })
      })
      row += Math.max(1, Math.ceil(group.length / 4))
    }
  } else {
    const centerIndex = Math.max(0, nodes.findIndex((node) => /central|core topic/i.test(node.category)))
    const ordered = [...nodes]
    const [center] = ordered.splice(centerIndex, 1)
    if (center) positions.set(center.id, { x: width / 2 - nodeWidth / 2, y: 60 })
    const radius = Math.max(200, Math.min(430, ordered.length * 22))
    ordered.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / Math.max(1, ordered.length) - Math.PI / 2
      positions.set(node.id, {
        x: width / 2 + Math.cos(angle) * radius - nodeWidth / 2,
        y: 350 + Math.sin(angle) * Math.min(radius * 0.62, 280),
      })
    })
  }

  const maxY = Math.max(700, ...[...positions.values()].map(({ y }) => y + nodeHeight + 60))
  const maxX = Math.max(width, ...[...positions.values()].map(({ x }) => x + nodeWidth + 70))
  return { positions, width: maxX, height: maxY, nodeWidth, nodeHeight }
}

function DiagramNode({ data, selected }) {
  return (
    <div
      className={`visual-diagram-node${selected ? ' is-selected' : ''} visual-node-${String(data.category).toLowerCase().replace(/[^a-z0-9]+/g, '-')} visual-node-type-${String(data.category).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
      style={{ '--node-accent': colorFor(data.category) }}
      title={data.label}
    >
      <Handle type="target" position={Position.Top} />
      <small>{data.category}</small>
      <b>{data.label}</b>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

const nodeTypes = { visualNode: DiagramNode }

function FlowCanvas({ nodes, edges, tool, onSelect, searchText, onRegisterReset }) {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const layout = useMemo(() => getLayout(nodes, tool), [nodes, tool])
  const flowNodes = useMemo(() => nodes.map((node) => ({
    id: node.id,
    type: 'visualNode',
    position: layout.positions.get(node.id) || { x: 50, y: 50 },
    data: { ...node },
    style: { width: layout.nodeWidth },
  })), [nodes, layout])
  const [diagramNodes, setDiagramNodes] = useState(flowNodes)
  const visibleNodes = useMemo(() => diagramNodes.map((node) => ({
    ...node,
    className: searchText && node.data.label.toLowerCase().includes(searchText.toLowerCase()) ? 'visual-node-match' : '',
  })), [diagramNodes, searchText])
  const flowEdges = useMemo(() => edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label || undefined,
    animated: tool === 'Process Visualization',
    type: 'smoothstep',
    markerEnd: { type: 'arrowclosed', color: '#78d5df', width: 15, height: 15 },
    style: { stroke: '#648194', strokeWidth: 1.6 },
    labelStyle: { fill: '#dce5ed', fontSize: 10 },
    labelBgStyle: { fill: '#101620', fillOpacity: 0.92 },
    data: edge,
  })), [edges, tool])

  useEffect(() => {
    onRegisterReset(() => {
      setDiagramNodes(flowNodes)
      window.setTimeout(() => void fitView({ padding: 0.18, duration: 250 }), 40)
    })
    return () => onRegisterReset(null)
  }, [onRegisterReset, fitView, flowNodes])

  return (
    <div className="visual-flow-canvas" style={{ minHeight: 540 }}>
      <div className="visual-canvas-controls" aria-label="Diagram controls">
        <button type="button" aria-label="Zoom in" onClick={() => void zoomIn()}><Plus size={14} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => void zoomOut()}><Minus size={14} /></button>
        <button type="button" aria-label="Fit diagram" onClick={() => void fitView({ padding: 0.18, duration: 250 })}><Expand size={14} /></button>
      </div>
      <ReactFlow
        nodes={visibleNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => setDiagramNodes((current) => changes.applyTo(current))}
        onNodeClick={(_, node) => onSelect(nodes.find((item) => item.id === node.id) || null)}
        onEdgeClick={(_, edge) => onSelect(edges.find((item) => item.id === edge.id) || null)}
        onPaneClick={() => onSelect(null)}
        nodesDraggable
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.15}
        maxZoom={2}
      >
        <Background color="#253244" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => colorFor(node.data?.category)}
          maskColor="rgba(8, 12, 18, .72)"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  )
}

function downloadFile(filename, content, type) {
  const blobUrl = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
}

function escapeXml(text) {
  return String(text).replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[character])
}

function exportSvg(title, nodes, edges, layout) {
  const edgeMarkup = edges.map((edge) => {
    const source = layout.positions.get(edge.source)
    const target = layout.positions.get(edge.target)
    if (!source || !target) return ''
    const x1 = source.x + layout.nodeWidth / 2
    const y1 = source.y + layout.nodeHeight
    const x2 = target.x + layout.nodeWidth / 2
    const y2 = target.y
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    return `<g><path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="#718a9f" stroke-width="2" marker-end="url(#arrow)"/><text x="${mx}" y="${my - 6}" fill="#b9c9d8" text-anchor="middle" font-size="12">${escapeXml(edge.label || '')}</text></g>`
  }).join('')
  const nodeMarkup = nodes.map((node) => {
    const position = layout.positions.get(node.id)
    if (!position) return ''
    const color = colorFor(node.category)
    return `<g><rect x="${position.x}" y="${position.y}" width="${layout.nodeWidth}" height="${layout.nodeHeight}" rx="10" fill="#121b28" stroke="${color}" stroke-width="2"/><text x="${position.x + 12}" y="${position.y + 28}" fill="${color}" font-size="11">${escapeXml(node.category)}</text><text x="${position.x + 12}" y="${position.y + 52}" fill="#edf3f9" font-size="14">${escapeXml(node.label)}</text></g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#75d9e3"/></marker></defs><rect width="100%" height="100%" fill="#0d131d"/><text x="32" y="34" fill="#edf3f9" font-size="20" font-family="sans-serif">${escapeXml(title)}</text><g transform="translate(0 28)">${edgeMarkup}${nodeMarkup}</g></svg>`
}

export default function VisualIntelligenceView({
  result,
  tool,
  mode,
  onModeChange,
  loading,
  error,
  onRetry,
}) {
  const [selected, setSelected] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [rendererError, setRendererError] = useState('')
  const [threeApi, setThreeApi] = useState(null)
  const visualContainer = useRef(null)
  const resetFlowRef = useRef(null)
  const layout = useMemo(
    () => getLayout(result?.visualization?.nodes || [], tool),
    [result, tool],
  )
  const nodes = result?.visualization?.nodes || []
  const edges = result?.visualization?.edges || []

  const reset = useCallback(() => {
    setSelected(null)
    setSearchText('')
    resetFlowRef.current?.()
    const controls = threeApi?.controls
    const camera = threeApi?.camera
    if (controls && camera) {
      camera.position.set(0, 0, 30)
      controls.target.set(0, 0, 0)
      controls.update()
    }
  }, [threeApi])
  const registerFlowReset = useCallback((resetView) => {
    resetFlowRef.current = resetView
  }, [])

  const exportData = () => {
    if (!result?.visualization?.source_data) return
    downloadFile(
      `${tool.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`,
      JSON.stringify(result.visualization.source_data, null, 2),
      'application/json',
    )
  }

  const exportView = () => {
    if (mode === '3d') {
      const canvas = threeApi?.renderer?.domElement
      if (!canvas) return
      try {
        const link = document.createElement('a')
        link.download = `${tool.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      } catch {
        setRendererError('The 3D image could not be exported. Try downloading the visualization data instead.')
      }
      return
    }
    downloadFile(
      `${tool.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`,
      exportSvg(result.visualization.title, nodes, edges, layout),
      'image/svg+xml;charset=utf-8',
    )
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await visualContainer.current?.requestFullscreen()
    } catch {
      setRendererError('Fullscreen is unavailable in this browser.')
    }
  }

  const matchingNode = searchText
    ? nodes.find((node) => node.label.toLowerCase().includes(searchText.toLowerCase()))
    : null
  const details = selected ? displayDetails(selected) : []

  return (
    <section className="visual-intelligence-view" aria-label={`${tool} visualization`}>
      <header className="visual-view-header">
        <div>
          <span className="workspace-overline">VISUAL INTELLIGENCE · {tool.toUpperCase()}</span>
          <h1>{result?.visualization?.title || tool}</h1>
          <p>{result?.filename || 'Uploaded research document'} · {nodes.length} elements · {edges.length} relationships</p>
        </div>
        {result && <div className="visual-export-actions">
          <button type="button" onClick={exportView}><Download size={14} />{mode === '3d' ? 'Export PNG' : 'Export SVG'}</button>
          <button type="button" onClick={exportData}><Box size={14} />Export JSON</button>
        </div>}
      </header>

      <div className="visual-toolbar">
        <div className="visual-mode-switch" role="group" aria-label="Visualization mode">
          <button type="button" className={mode === '2d' ? 'is-active' : ''} aria-pressed={mode === '2d'} onClick={() => onModeChange('2d')}>2D View</button>
          <button type="button" className={mode === '3d' ? 'is-active' : ''} aria-pressed={mode === '3d'} onClick={() => { setRendererError(''); onModeChange('3d') }}>3D View</button>
        </div>
        <label className="visual-search">
          <Search size={14} />
          <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Find an element..." aria-label="Search visualization" />
        </label>
        <div className="visual-view-controls">
          <button type="button" onClick={reset} title={mode === '3d' ? 'Reset camera' : 'Reset layout'} aria-label={mode === '3d' ? 'Reset camera' : 'Reset layout'}><RotateCcw size={14} /></button>
          <button type="button" onClick={toggleFullscreen} title="Toggle fullscreen" aria-label="Toggle fullscreen"><Maximize2 size={14} /></button>
        </div>
      </div>

      {error && !result && <div className="visual-state visual-error" role="alert"><span>{error}</span><button type="button" onClick={onRetry}>Retry</button></div>}
      {loading && !result && <div className="visual-state" role="status"><span className="extraction-spinner" />Generating document-based visualization…</div>}
      {!loading && !error && !result && <div className="visual-state">Upload and process a research PDF to generate this visualization from its content.</div>}

      {result && <div className="visual-diagram-shell" ref={visualContainer}>
        {mode === '2d'
          ? <ReactFlowProvider>
            <FlowCanvas
              key={`${tool}:${nodes.map((node) => node.id).join('|')}`}
              nodes={nodes}
              edges={edges}
              tool={tool}
              onSelect={setSelected}
              searchText={searchText}
              onRegisterReset={registerFlowReset}
            />
          </ReactFlowProvider>
          : <div className="visual-three-wrap">
            <Suspense fallback={<div className="visual-state">Initializing the 3D renderer…</div>}>
              <ThreeCanvas
                nodes={nodes}
                edges={edges}
                tool={tool}
                selectedId={selected?.id}
                searchText={searchText}
                onSelect={setSelected}
                onRendererError={setRendererError}
                onReady={setThreeApi}
              />
            </Suspense>
            {rendererError && <div className="visual-renderer-error" role="alert">
              <span>{rendererError}</span>
              <button type="button" onClick={() => onModeChange('2d')}>Switch to 2D</button>
            </div>}
            <span className="visual-three-hint"><Expand size={12} /> Drag to rotate · scroll to zoom · click a node for details</span>
          </div>}
        <aside className="visual-details-panel" aria-live="polite">
          <div className="visual-details-heading">
            <span>{selected ? selected.category || selected.relationship_type || 'Relationship' : 'INTERACTIVE EXPLORATION'}</span>
            <button type="button" aria-label="Close element details" onClick={() => setSelected(null)}><X size={14} /></button>
          </div>
          {selected
            ? <>
              <h2>{selected.label || selected.name || `${selected.source} → ${selected.target}`}</h2>
              {details.length
                ? details.map(([label, value]) => <div className="visual-detail-item" key={label}><b>{label}</b><p>{value}</p></div>)
                : <p>{selected.explanation || selected.description || selected.relationship_type || 'No additional details were provided by the source.'}</p>}
            </>
            : <p>{matchingNode ? `Found “${matchingNode.label}”. Select it in the diagram to inspect its evidence and details.` : 'Select a node or relationship to inspect its description, source evidence, and page references.'}</p>}
        </aside>
      </div>}
      {result && !edges.length && <p className="visual-no-edges">The paper did not provide enough evidence to establish explicit relationships.</p>}
    </section>
  )
}
