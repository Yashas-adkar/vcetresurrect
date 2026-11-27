import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { colorFor } from './visualColors.js'
import './VisualIntelligence.css'

export default function ThreeCanvas({
  nodes,
  edges,
  tool,
  selectedId,
  searchText,
  onSelect,
  onRendererError,
  onReady,
}) {
  const hostRef = useRef(null)
  const instanceRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    let renderer
    let controls
    let resizeObserver
    let animationFrame
    let handlePointer
    let instance
    try {
      if (!window.WebGLRenderingContext) throw new Error('WebGL is not available in this browser.')
      const scene = new THREE.Scene()
      scene.background = new THREE.Color('#0d131d')
      scene.fog = new THREE.Fog('#0d131d', 28, 90)
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160)
      camera.position.set(0, 0, 30)
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true })
      onRendererError('')
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.domElement.className = 'visual-three-canvas'
      renderer.domElement.setAttribute('aria-label', 'Interactive 3D visualization. Drag to rotate; scroll to zoom.')
      host.appendChild(renderer.domElement)

      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.07
      controls.minDistance = 9
      controls.maxDistance = 70
      scene.add(new THREE.AmbientLight(0xc5e4ff, 1.55))
      const keyLight = new THREE.PointLight(0x67d9e7, 45, 80)
      keyLight.position.set(-7, 10, 14)
      scene.add(keyLight)
      const fillLight = new THREE.PointLight(0xa58cff, 24, 70)
      fillLight.position.set(10, -5, 6)
      scene.add(fillLight)

      const positions = getThreePositions(nodes, tool)
      const materialFor = (color) => new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.16,
        roughness: 0.42,
        metalness: 0.24,
      })
      const clickable = []
      const edgeObjects = []
      for (const edge of edges) {
        const start = positions.get(edge.source)
        const end = positions.get(edge.target)
        if (!start || !end) continue
        const midpoint = start.clone().add(end).multiplyScalar(0.5)
        midpoint.z += 0.8
        const curve = new THREE.QuadraticBezierCurve3(start, midpoint, end)
        const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20))
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#66849a', transparent: true, opacity: 0.62 }))
        line.userData = { source: edge.source, target: edge.target }
        edgeObjects.push(line)
        scene.add(line)
        const direction = end.clone().sub(midpoint).normalize()
        const arrow = new THREE.Mesh(
          new THREE.ConeGeometry(0.13, 0.48, 8),
          new THREE.MeshStandardMaterial({ color: '#75d9e3', emissive: '#75d9e3', emissiveIntensity: 0.3 }),
        )
        arrow.position.copy(end).addScaledVector(direction, -0.38)
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
        scene.add(arrow)
      }

      const makeLabel = (label, color) => {
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 128
        const context = canvas.getContext('2d')
        if (!context) return null
        context.fillStyle = 'rgba(11, 16, 24, .82)'
        context.strokeStyle = color
        context.lineWidth = 4
        context.beginPath()
        context.roundRect(6, 6, 500, 116, 22)
        context.fill()
        context.stroke()
        context.fillStyle = '#eef5fb'
        context.font = '600 34px Segoe UI, sans-serif'
        context.textAlign = 'center'
        const maxLength = 25
        const text = label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label
        context.fillText(text, 256, 74)
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
        sprite.scale.set(3.9, 0.98, 1)
        sprite.position.set(0, -1.05, 0.5)
        return sprite
      }

      nodes.forEach((node) => {
        const category = String(node.category).toLowerCase()
        const isDecision = category.includes('decision')
        const geometry = isDecision
          ? new THREE.OctahedronGeometry(0.78, 0)
          : tool === 'Architecture Diagram' || tool === 'Flowchart' || tool === 'Process Visualization'
            ? new THREE.BoxGeometry(1.7, 1.15, 0.9, 1, 1, 1)
            : new THREE.SphereGeometry(0.72, 24, 18)
        const group = new THREE.Group()
        group.position.copy(positions.get(node.id))
        group.userData.nodeId = node.id
        const mesh = new THREE.Mesh(geometry, materialFor(colorFor(node.category)))
        mesh.userData.nodeId = node.id
        group.add(mesh)
        const label = makeLabel(node.label, colorFor(node.category))
        if (label) group.add(label)
        scene.add(group)
        clickable.push({ object: mesh, group, node })
      })

      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()
      handlePointer = (event) => {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(pointer, camera)
        const hit = raycaster.intersectObjects(clickable.map((item) => item.object), false)[0]
        const item = hit && clickable.find(({ object }) => object === hit.object)
        if (item) onSelect(item.node)
      }
      renderer.domElement.addEventListener('pointerup', handlePointer)
      const resize = () => {
        const width = Math.max(host.clientWidth, 1)
        const height = Math.max(host.clientHeight, 1)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
      }
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(host)
      resize()
      const render = () => {
        animationFrame = requestAnimationFrame(render)
        controls.update()
        renderer.render(scene, camera)
      }
      render()
      instance = { scene, camera, controls, renderer, clickable, edgeObjects }
      instanceRef.current = instance
      onReady(instance)
      host.dataset.ready = 'true'
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'The 3D renderer could not be initialized.'
      host.dataset.error = message
      onRendererError(message)
    }

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      if (renderer && handlePointer) renderer.domElement.removeEventListener('pointerup', handlePointer)
      controls?.dispose()
      if (instance) {
        instance.scene.traverse((object) => {
          object.geometry?.dispose?.()
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
          else object.material?.dispose?.()
        })
      }
      renderer?.dispose()
      renderer?.domElement.remove()
      instanceRef.current = null
      onReady(null)
    }
  }, [nodes, edges, tool, onSelect, onRendererError, onReady])

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance) return
    updateThreeHighlights(instance, selectedId, searchText)
  }, [selectedId, searchText])

  return <div ref={hostRef} className="visual-three-host" />
}

function getThreePositions(nodes, tool) {
  const positions = new Map()
  if (tool === 'Knowledge Graph' || tool === 'Concept Map') {
    const centralIndex = nodes.findIndex((node) => /central|core topic/i.test(node.category))
    const center = nodes[centralIndex >= 0 ? centralIndex : 0]
    if (center) positions.set(center.id, new THREE.Vector3(0, 0, 0))
    const surrounding = nodes.filter((node) => node.id !== center?.id)
    surrounding.forEach((node, index) => {
      const fraction = (index + 0.5) / Math.max(1, surrounding.length)
      const y = 1 - 2 * fraction
      const radius = Math.sqrt(Math.max(0, 1 - y * y))
      const angle = index * Math.PI * (3 - Math.sqrt(5))
      const hierarchyOffset = tool === 'Concept Map' ? (node.hierarchy_level || 0) * 0.5 : 0
      positions.set(node.id, new THREE.Vector3(
        7.5 * radius * Math.cos(angle),
        7.5 * y + hierarchyOffset,
        7.5 * radius * Math.sin(angle),
      ))
    })
    return positions
  }

  if (tool === 'Architecture Diagram') {
    const groups = new Map()
    nodes.forEach((node) => {
      const group = node.group || 'Research components'
      groups.set(group, [...(groups.get(group) || []), node])
    })
    let groupIndex = 0
    for (const group of groups.values()) {
      group.forEach((node, index) => positions.set(node.id, new THREE.Vector3(
        (index % 3 - 1) * 4.5,
        (1 - Math.floor(index / 3)) * 3.8,
        groupIndex * 3.2 - (groups.size - 1) * 1.6,
      )))
      groupIndex += 1
    }
    return positions
  }

  const ordered = [...nodes].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
  const columns = Math.ceil(Math.sqrt(ordered.length))
  ordered.forEach((node, index) => {
    positions.set(node.id, new THREE.Vector3(
      (index - (ordered.length - 1) / 2) * 3.2,
      Math.sin(index * 0.7) * 1.6,
      (index % columns - (columns - 1) / 2) * 3.6,
    ))
  })
  return positions
}

function updateThreeHighlights(instance, selectedId, searchText) {
  for (const { object, node } of instance.clickable) {
    const isSearchMatch = searchText && node.label.toLowerCase().includes(searchText.toLowerCase())
    const isSelected = selectedId === node.id
    object.material.emissiveIntensity = isSelected ? 0.85 : isSearchMatch ? 0.62 : 0.16
    object.scale.setScalar(isSelected || isSearchMatch ? 1.17 : 1)
  }
  for (const edge of instance.edgeObjects) {
    const isConnected = selectedId && (edge.userData.source === selectedId || edge.userData.target === selectedId)
    edge.material.color.set(isConnected ? '#75d9e3' : '#66849a')
    edge.material.opacity = selectedId && !isConnected ? 0.2 : 0.72
  }
}
