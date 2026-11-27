import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import axios from 'axios'
import {
  Activity, AlignLeft, ArrowDownToLine, ArrowLeft, ArrowRight, Atom, BarChart3,
  BookOpen, Bookmark, Brain, BrainCircuit, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Clock3, Copy, FileChartColumn, FileText,
  Files, GitCompareArrows, GitFork, GraduationCap, Lightbulb,
  Download, Menu, MessageCircle, MessageSquare, Moon, MoreHorizontal, Network, Plus,
  Search, Send, Settings, ShieldCheck, Sparkles, Sun, Table2, Tag, Trash2,
  X,
} from 'lucide-react'
import './Workspace.css'

const maxPdfSize = 20 * 1024 * 1024
const documentExtractUrl = 'http://127.0.0.1:8000/api/documents/extract'
const documentSummarizeUrl = 'http://127.0.0.1:8000/api/documents/summarize'

function getSummaryMode(tool) {
  if (tool === 'Brief Summary') return 'brief'
  if (tool === 'Detailed Summary') return 'detailed'
  return null
}

function getExtractionError(error) {
  if (!axios.isAxiosError(error)) {
    return 'An unexpected error occurred while extracting this PDF. Please try again.'
  }
  if (!error.response) {
    return 'The extraction service is unavailable. Make sure the backend is running and try again.'
  }

  const { status, data } = error.response
  const detail = typeof data?.detail === 'string' ? data.detail.toLowerCase() : ''
  if (status === 413) return 'This PDF is larger than 20 MB. Choose a smaller file.'
  if (status === 415) return 'Invalid PDF. Please choose a valid PDF document.'
  if (status === 422 && detail.includes('no extractable text')) {
    return 'No extractable text was found in this PDF.'
  }
  if (status === 422 && detail.includes('no pages')) {
    return 'This PDF has no pages to extract.'
  }
  if (status === 400) {
    return detail.includes('empty')
      ? 'The selected PDF is empty.'
      : 'This PDF is invalid or corrupted. Choose another file.'
  }
  return 'We could not extract text from this PDF. Please try again.'
}

function getSummaryError(error) {
  if (!axios.isAxiosError(error)) {
    return 'An unexpected error occurred while generating the summary. Please try again.'
  }
  if (!error.response) {
    return 'The summary service is unavailable. Make sure the backend is running and try again.'
  }
  if (error.response.status === 503) {
    return 'Research summarization is not configured on the backend.'
  }
  if (error.response.status === 422) {
    return error.response.data?.detail || 'The extracted document text could not be summarized.'
  }
  return 'We could not generate this summary. Please try again.'
}

const toolGroups = [
  {
    name: 'SUMMARIZATION',
    tools: [
      ['Brief Summary', 'A concise overview of the main ideas.', AlignLeft],
      ['Detailed Summary', 'A structured, in-depth breakdown.', FileText],
      ['Topic Skimming', 'Scan the material by topic.', Search],
      ['Key Takeaways', 'Surface the most useful ideas.', Lightbulb],
      ['Executive Summary', 'A high-level decision brief.', FileChartColumn],
    ],
  },
  {
    name: 'VISUAL INTELLIGENCE',
    tools: [
      ['Knowledge Graph', 'See how concepts connect.', Network],
      ['Flowchart', 'Map a process from start to finish.', GitFork],
      ['Architecture Diagram', 'Organize components and systems.', Atom],
      ['Concept Map', 'Arrange ideas into a visual map.', Brain],
      ['Process Visualization', 'Follow the steps and dependencies.', Activity],
    ],
  },
  {
    name: 'LEARNING',
    tools: [
      ['Structured Notes', 'Turn ideas into clear study notes.', BookOpen],
      ['Flashcards', 'Review key terms and concepts.', Bookmark],
      ['Quiz Generator', 'Check your understanding.', CircleHelp],
      ['Beginner Explanation', 'Start with the fundamentals.', GraduationCap],
      ['Important Definitions', 'Keep essential terms close.', Tag],
    ],
  },
  {
    name: 'RESEARCH INTELLIGENCE',
    tools: [
      ['Research Comparison', 'Compare claims and approaches.', GitCompareArrows],
      ['Research Gap Finder', 'Spot questions for further study.', Search],
      ['Key Findings', 'Focus on reported outcomes.', BarChart3],
      ['Contradiction Detection', 'Review differing claims.', ShieldCheck],
      ['Evidence Analysis', 'Inspect the evidence behind ideas.', FileChartColumn],
    ],
  },
]

const navItems = [
  { id: 'welcome', label: 'New exploration', icon: Plus },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'history', label: 'Chat history', icon: Clock3 },
  { id: 'saved', label: 'Saved knowledge', icon: Bookmark },
  { id: 'documents', label: 'My documents', icon: Files },
  { id: 'skills', label: 'Skill analysis', icon: Activity },
]

const modes = [
  { id: 'BEGINNER', detail: 'Simple language and foundational examples' },
  { id: 'INTERMEDIATE', detail: 'Structured concepts and moderate technical depth' },
  { id: 'DEEP', detail: 'Detailed, technical and research-level understanding' },
]

const sampleHistory = [
  { title: 'How neural networks learn', date: 'Today · 10:42 AM', prompt: 'How do neural networks learn from data?' },
  { title: 'Climate adaptation strategies', date: 'Yesterday', prompt: 'Summarize the main approaches to climate adaptation.' },
  { title: 'CRISPR and gene editing', date: 'Nov 24', prompt: 'Explain CRISPR gene editing and its key limitations.' },
  { title: 'Urban mobility research', date: 'Nov 21', prompt: 'What makes a city’s public transit system effective?' },
]

const demoParagraph = 'This is a sample workspace preview. Insight Forge organizes research into clear ideas, useful evidence, and relationships you can explore. Results shown here are illustrative demo content—not AI-generated analysis.'

function getTool(name) {
  return toolGroups.flatMap((group) => group.tools).find(([toolName]) => toolName === name) || toolGroups[0].tools[0]
}

function AppLogo({ compact = false }) {
  return (
    <div className={`workspace-logo${compact ? ' compact-logo' : ''}`}>
      <span><BrainCircuit size={19} /></span>
      {!compact && <div>INSIGHT <b>FORGE</b><small>RESEARCH WORKSPACE</small></div>}
    </div>
  )
}

function ToolPanel({ selectedTool, onSelect, collapsed, onCollapse, mobileOpen, onClose }) {
  return (
    <aside className={`tools-panel${collapsed ? ' tools-collapsed' : ''}${mobileOpen ? ' tools-mobile-open' : ''}`} aria-label="AI workspace tools">
      <div className="tools-panel-heading">
        {!collapsed && <div><span className="workspace-overline">YOUR TOOLKIT</span><h2>AI workspace</h2><p>Choose how to explore your information.</p></div>}
        <button className="icon-button panel-collapse" onClick={onCollapse} aria-label={collapsed ? 'Expand AI tools' : 'Collapse AI tools'}>
          <ChevronRight size={17} />
        </button>
        <button className="icon-button mobile-panel-close" onClick={onClose} aria-label="Close AI tools"><X size={17} /></button>
      </div>
      {collapsed ? (
        <div className="collapsed-tools">{toolGroups.map((group) => {
          const Icon = group.tools[0][2]
          return <button key={group.name} className="collapsed-tool-button" title={group.name} onClick={onCollapse}><Icon size={17} /></button>
        })}</div>
      ) : (
        <div className="tool-groups">
          {toolGroups.map((group) => (
            <section className="tool-group" key={group.name}>
              <h3>{group.name}</h3>
              {group.tools.map(([name, description, Icon]) => (
                <button
                  type="button"
                  key={name}
                  title={description}
                  className={`tool-choice${selectedTool === name ? ' tool-choice-active' : ''}`}
                  onClick={() => onSelect(name)}
                >
                  <span className="tool-choice-icon"><Icon size={15} /></span>
                  <span className="tool-choice-copy"><b>{name}</b><small>{description}</small></span>
                  {selectedTool === name && <span className="tool-selected-dot" />}
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
      {!collapsed && <div className="tool-panel-foot"><Sparkles size={13} /><span>Choose a tool, then explore at your pace.</span></div>}
    </aside>
  )
}

function KnowledgePreview() {
  return (
    <div className="workspace-graph">
      <svg viewBox="0 0 640 260" role="img" aria-label="Sample connected concepts">
        <defs><linearGradient id="workspaceGraphLine"><stop stopColor="#5ad6e4" stopOpacity=".35" /><stop offset="1" stopColor="#a48bfa" stopOpacity=".72" /></linearGradient></defs>
        <g fill="none" stroke="url(#workspaceGraphLine)" strokeWidth="1.5">
          <path d="M118 131 237 72 337 119 453 62 536 133M118 131 232 203 337 119 431 207 536 133M237 72 232 203M337 119 453 62M337 119 431 207" strokeDasharray="5 6" />
        </g>
        {[[118, 131, 7], [237, 72, 6], [337, 119, 9], [453, 62, 6], [536, 133, 7], [232, 203, 6], [431, 207, 7]].map(([x, y, r]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r={r * 2.5} fill="#62dbe8" opacity=".1" /><circle cx={x} cy={y} r={r} fill={x === 337 ? '#74e4e9' : '#aa92ff'} /></g>)}
      </svg>
      <span className="graph-label graph-label-one">Artificial intelligence</span>
      <span className="graph-label graph-label-two">Machine learning</span>
      <span className="graph-label graph-label-three">Research findings</span>
      <span className="graph-label graph-label-four">Applications</span>
      <span className="graph-label graph-label-five">Deep learning</span>
    </div>
  )
}

function SampleOutput({ tool }) {
  if (tool === 'Knowledge Graph' || tool === 'Concept Map') {
    return <><h3>Connected concepts</h3><p>{demoParagraph}</p><KnowledgePreview /></>
  }
  if (tool === 'Flowchart' || tool === 'Process Visualization' || tool === 'Architecture Diagram') {
    return (
      <>
        <h3>A process, made visible</h3><p>{demoParagraph}</p>
        <div className="flow-preview">{['Research question', 'Evidence gathering', 'Analysis', 'Finding'].map((step, index) => <div className="flow-step" key={step}><span>0{index + 1}</span><b>{step}</b>{index < 3 && <ArrowRight size={15} />}</div>)}</div>
      </>
    )
  }
  if (tool === 'Research Comparison' || tool === 'Contradiction Detection' || tool === 'Evidence Analysis') {
    return (
      <>
        <h3>Comparing perspectives</h3><p>{demoParagraph}</p>
        <div className="comparison-preview"><div><span>APPROACH A</span><b>Controlled evaluation</b><p>Emphasizes measurable outcomes and consistent study conditions.</p></div><div><span>APPROACH B</span><b>Contextual evaluation</b><p>Emphasizes practical application and real-world variation.</p></div></div>
      </>
    )
  }
  if (tool === 'Topic Skimming' || tool === 'Key Findings' || tool === 'Research Gap Finder') {
    return (
      <>
        <h3>Topics to explore</h3><p>{demoParagraph}</p>
        <div className="topic-list">{['Core question and motivation', 'Methods and study design', 'Reported outcomes', 'Limitations and open questions'].map((item, index) => <div key={item}><span>0{index + 1}</span>{item}<ChevronRight size={14} /></div>)}</div>
      </>
    )
  }
  if (tool === 'Structured Notes' || tool === 'Flashcards' || tool === 'Quiz Generator' || tool === 'Important Definitions') {
    return (
      <>
        <h3>Structured learning notes</h3><p>{demoParagraph}</p>
        <div className="notes-preview">{['The central idea', 'Key terms and definitions', 'How the concepts relate'].map((item) => <div key={item}><Check size={14} /><span>{item}</span></div>)}</div>
      </>
    )
  }
  return (
    <>
      <h3>A concise research overview</h3>
      <p>{demoParagraph}</p>
      <div className="result-highlights">
        <div><span>01</span><b>Central question</b><p>What problem is the research trying to understand?</p></div>
        <div><span>02</span><b>Approach</b><p>Which methods and evidence shape the investigation?</p></div>
        <div><span>03</span><b>What to explore</b><p>Where do the findings connect to broader ideas?</p></div>
      </div>
    </>
  )
}

function getSummarySections(summary, mode) {
  const sections = [
    { id: 'overview', title: 'Research Overview', type: 'text', content: summary.research_overview, featured: true },
    { id: 'problem', title: 'Problem Statement', type: 'text', content: summary.problem_statement },
  ]

  if (mode === 'detailed') {
    sections.push({ id: 'objectives', title: 'Research Objectives', type: 'numbered', content: summary.research_objectives })
  }

  sections.push({ id: 'methodology', title: 'Methodology', type: 'text', content: summary.methodology })

  if (mode === 'detailed') {
    sections.push({ id: 'concepts', title: 'Important Concepts', type: 'concepts', content: summary.important_concepts })
  }

  sections.push({ id: 'findings', title: 'Key Findings', type: 'findings', content: summary.key_findings })

  if (mode === 'detailed') {
    sections.push({
      id: 'results-implications',
      title: 'Results and Implications',
      type: 'results',
      content: [
        ['Results', summary.results],
        ['Implications', summary.implications],
      ],
    })
    sections.push({ id: 'limitations', title: 'Limitations', type: 'list', content: summary.limitations })
  }

  sections.push({ id: 'conclusion', title: 'Conclusion', type: 'text', content: summary.conclusion })
  return sections
}

function getSummaryMarkdown(summary, mode, documentData) {
  const sections = getSummarySections(summary, mode)
  const lines = [
    `# ${summary.paper_title || documentData.uploadedFilename || documentData.filename}`,
    '',
    `**Source:** ${documentData.uploadedFilename || documentData.filename}`,
    `**Pages:** ${documentData.page_count}`,
    `**Summary mode:** ${mode === 'brief' ? 'Brief Summary' : 'Detailed Summary'}`,
    '',
  ]

  sections.forEach((section) => {
    lines.push(`## ${section.title}`, '')
    if (section.type === 'numbered' || section.type === 'list') {
      section.content.forEach((item, index) => lines.push(`${section.type === 'numbered' ? `${index + 1}.` : '-'} ${item}`))
    } else if (section.type === 'concepts') {
      section.content.forEach((concept) => lines.push(`- **${concept.name}:** ${concept.explanation}`))
    } else if (section.type === 'findings') {
      section.content.forEach((finding) => lines.push(`- ${finding.finding}\n  - Evidence: ${finding.evidence}`))
    } else if (section.type === 'results') {
      section.content.forEach(([title, content]) => lines.push(`**${title}**\n\n${content}`))
    } else {
      lines.push(section.content)
    }
    lines.push('')
  })

  return lines.join('\n')
}

function SummarySectionContent({ section }) {
  if (section.type === 'numbered') {
    return (
      <ol className="summary-objectives">
        {section.content.map((objective, index) => <li key={`objective-${index}`}>{objective}</li>)}
      </ol>
    )
  }
  if (section.type === 'list') {
    return (
      <ul className="summary-simple-list">
        {section.content.map((item, index) => <li key={`limitation-${index}`}>{item}</li>)}
      </ul>
    )
  }
  if (section.type === 'concepts') {
    return (
      <div className="summary-concepts">
        {section.content.map((concept, index) => (
          <article className="summary-concept-card" key={`concept-${index}`}>
            <b>{concept.name}</b>
            <p>{concept.explanation}</p>
          </article>
        ))}
      </div>
    )
  }
  if (section.type === 'findings') {
    return (
      <div className="summary-findings">
        {section.content.map((finding, index) => (
          <article className="summary-finding-card" key={`finding-${index}`}>
            <span className="summary-finding-index">{String(index + 1).padStart(2, '0')}</span>
            <div><p>{finding.finding}</p><small><b>Evidence</b>{finding.evidence}</small></div>
          </article>
        ))}
      </div>
    )
  }
  if (section.type === 'results') {
    return (
      <div className="summary-results">
        {section.content.map(([title, content]) => (
          <div key={title}><b>{title}</b><p>{content}</p></div>
        ))}
      </div>
    )
  }
  return <p className={section.featured ? 'summary-overview-copy' : ''}>{section.content}</p>
}

function SummaryReadingView({ result, documentData, mode, loading, error, onRetry, onCopy, onDownload, onSave, isSaved, copied, exportMessage }) {
  const summary = result?.summary
  const sections = summary ? getSummarySections(summary, mode) : []
  const title = summary?.paper_title || 'Paper title unavailable in this summary'
  const filename = documentData?.uploadedFilename || result?.filename || 'Research paper'
  const pageCount = documentData?.page_count

  return (
    <div className="summary-reading-view">
      <header className="summary-document-header">
        <div className="summary-document-title">
          <span className="workspace-overline">RESEARCH PAPER · {mode === 'brief' ? 'BRIEF SUMMARY' : 'DETAILED SUMMARY'}</span>
          <h1>{title}</h1>
          <div className="summary-document-meta">
            <span><FileText size={13} />{filename}</span>
            <i />
            <span>{pageCount ?? '—'} {pageCount === 1 ? 'page' : 'pages'}</span>
            <i />
            <span>{mode === 'brief' ? 'Brief Summary' : 'Detailed Summary'}</span>
          </div>
        </div>
        {result && <div className="summary-export-actions">
          <button type="button" onClick={onCopy}><Copy size={14} />{copied ? 'Copied' : 'Copy Summary'}</button>
          <button type="button" onClick={onDownload}><Download size={14} />Download Summary</button>
          <button type="button" className={isSaved ? 'saved-action' : ''} onClick={onSave}>{isSaved ? <Check size={14} /> : <Bookmark size={14} />}{isSaved ? 'Saved' : 'Save'}</button>
        </div>}
      </header>
      {exportMessage && <p className="summary-export-message" role="status">{exportMessage}</p>}
      {sections.length > 0
        ? <>
          <nav className="summary-section-nav" aria-label="Navigate summary sections">
            <span>ON THIS PAGE</span>
            <div>{sections.map((section) => <a key={section.id} href={`#summary-${section.id}`}>{section.title}</a>)}</div>
          </nav>
          <div className="summary-reading-content">
            {sections.map((section, index) => (
              <section
                className={`summary-reading-section${section.featured ? ' summary-section-featured' : ''}${section.type === 'findings' ? ' summary-section-findings' : ''}`}
                id={`summary-${section.id}`}
                key={section.id}
              >
                <div className="summary-section-heading">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h2>{section.title}</h2>
                </div>
                <div className="summary-section-body"><SummarySectionContent section={section} /></div>
              </section>
            ))}
          </div>
        </>
        : <div className={`summary-generation-state${error ? ' has-error' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite">
          {loading && <span className="extraction-spinner" />}
          <span>{error || `Generating your ${mode} research summary...`}</span>
          {error && <button type="button" onClick={onRetry}>Retry</button>}
        </div>}
    </div>
  )
}

function Workspace() {
  const [activePage, setActivePage] = useState('welcome')
  const [selectedTool, setSelectedTool] = useState('Brief Summary')
  const [depth, setDepth] = useState('INTERMEDIATE')
  const [prompt, setPrompt] = useState('')
  const [submittedPrompt, setSubmittedPrompt] = useState('')
  const [attachments, setAttachments] = useState([])
  const [extractedDocument, setExtractedDocument] = useState(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [summaryResults, setSummaryResults] = useState({})
  const [summaryLoadingModes, setSummaryLoadingModes] = useState([])
  const [summaryError, setSummaryError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [saved, setSaved] = useState([])
  const [history, setHistory] = useState(sampleHistory)
  const [historySearch, setHistorySearch] = useState('')
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [copied, setCopied] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [followup, setFollowup] = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! Bring a question, a document, or a topic you are curious about. We can work through it together.' },
  ])
  const [dropActive, setDropActive] = useState(false)
  const [attachedMessage, setAttachedMessage] = useState(null)
  const [settings, setSettings] = useState({ citations: true, suggestions: true })
  const textareaRef = useRef(null)
  const documentInput = useRef(null)
  const chatFileInput = useRef(null)
  const extractionInProgress = useRef(false)
  const selectedToolRef = useRef(selectedTool)
  const currentDocumentRef = useRef(null)
  const summaryCache = useRef(new WeakMap())
  const summaryRequests = useRef(new WeakMap())

  useEffect(() => {
    document.title = 'Insight Forge — Research Workspace'
  }, [])

  const currentTool = getTool(selectedTool)
  const filteredHistory = useMemo(() => history.filter((item) => item.title.toLowerCase().includes(historySearch.toLowerCase())), [history, historySearch])
  const activeTitle = {
    welcome: 'New exploration', result: 'Research overview', chat: 'Research chat',
    history: 'Chat history', saved: 'Saved knowledge', documents: 'My documents',
    skills: 'Skill analysis', settings: 'Settings',
  }[activePage]

  function addFiles(fileList) {
    if (extractionInProgress.current) return
    const files = Array.from(fileList)
    if (files.length === 0) return
    if (files.length > 1) {
      setUploadError('Please add one PDF at a time.')
      return
    }

    const [file] = files
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) {
      setUploadError('Unsupported file type. Please choose a PDF.')
      return
    }
    if (file.size > maxPdfSize) {
      setUploadError('This PDF is larger than 20 MB. Choose a smaller file.')
      return
    }

    setAttachments([file])
    setExtractedDocument(null)
    setSummaryResults({})
    setSummaryError('')
    currentDocumentRef.current = null
    setUploadError('')
  }

  function formatFileSize(size) {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  function handleComposerDrop(event) {
    event.preventDefault()
    setDropActive(false)
    addFiles(event.dataTransfer.files)
  }

  async function requestSummary(documentData, toolName) {
    const summaryMode = getSummaryMode(toolName)
    if (!documentData || !summaryMode) return null

    let documentCache = summaryCache.current.get(documentData)
    if (!documentCache) {
      documentCache = new Map()
      summaryCache.current.set(documentData, documentCache)
    }
    if (documentCache.has(summaryMode)) {
      const cached = documentCache.get(summaryMode)
      if (currentDocumentRef.current === documentData) {
        setSummaryResults((results) => ({ ...results, [summaryMode]: cached }))
      }
      setSummaryError('')
      return cached
    }

    let documentRequests = summaryRequests.current.get(documentData)
    if (!documentRequests) {
      documentRequests = new Map()
      summaryRequests.current.set(documentData, documentRequests)
    }
    if (documentRequests.has(summaryMode)) {
      return documentRequests.get(summaryMode)
    }

    setSummaryError('')
    setSummaryLoadingModes((requests) => [...requests, { documentData, summaryMode }])
    const request = axios.post(documentSummarizeUrl, {
      filename: documentData.filename,
      extracted_text: documentData.extracted_text,
      summary_mode: summaryMode,
    }).then(({ data }) => {
      documentCache.set(summaryMode, data)
      if (currentDocumentRef.current === documentData) {
        setSummaryResults((results) => ({ ...results, [summaryMode]: data }))
      }
      return data
    }).catch((error) => {
      if (currentDocumentRef.current === documentData && getSummaryMode(selectedToolRef.current) === summaryMode) {
        setSummaryError(getSummaryError(error))
      }
      return null
    }).finally(() => {
      documentRequests.delete(summaryMode)
      setSummaryLoadingModes((requests) => requests.filter(
        (pending) => pending.documentData !== documentData || pending.summaryMode !== summaryMode,
      ))
    })

    documentRequests.set(summaryMode, request)
    return request
  }

  function handleToolSelect(toolName) {
    selectedToolRef.current = toolName
    setSelectedTool(toolName)
    setSummaryError('')
    setExportMessage('')
    setCopied(false)
    if (activePage === 'result' && extractedDocument && getSummaryMode(toolName)) {
      void requestSummary(extractedDocument, toolName)
    }
  }

  async function submitPrompt(value = prompt) {
    if (extractionInProgress.current) return
    const cleanPrompt = value.trim()
    if (!cleanPrompt && attachments.length === 0) {
      textareaRef.current?.focus()
      return
    }

    let documentData = extractedDocument
    if (attachments.length > 0 && !documentData) {
      extractionInProgress.current = true
      setIsExtracting(true)
      setUploadError('')
      const formData = new FormData()
      formData.append('file', attachments[0])

      try {
        const { data } = await axios.post(documentExtractUrl, formData)
        documentData = {
          ...data,
          uploadedFilename: attachments[0].name,
          fileSize: attachments[0].size,
        }
        currentDocumentRef.current = documentData
        setExtractedDocument(documentData)
      } catch (error) {
        setUploadError(getExtractionError(error))
        return
      } finally {
        extractionInProgress.current = false
        setIsExtracting(false)
      }
    }

    const nextPrompt = cleanPrompt || `Explore ${attachments[0].name}`
    setSubmittedPrompt(nextPrompt)
    setPrompt(nextPrompt)
    setHistory((items) => [{ title: nextPrompt.length > 38 ? `${nextPrompt.slice(0, 38)}…` : nextPrompt, date: 'Just now', prompt: nextPrompt }, ...items])
    setActivePage('result')
    if (documentData && getSummaryMode(selectedToolRef.current)) {
      await requestSummary(documentData, selectedToolRef.current)
    }
  }

  function startNewChat() {
    setActivePage('welcome')
    setPrompt('')
    setSubmittedPrompt('')
    setAttachments([])
    setExtractedDocument(null)
    setIsExtracting(false)
    setSummaryResults({})
    setSummaryLoadingModes([])
    setSummaryError('')
    setExportMessage('')
    setCopied(false)
    currentDocumentRef.current = null
    summaryCache.current = new WeakMap()
    summaryRequests.current = new WeakMap()
    selectedToolRef.current = 'Brief Summary'
    setUploadError('')
    setSelectedTool('Brief Summary')
    setDepth('INTERMEDIATE')
    setMessages([{ role: 'assistant', text: 'Hi! Bring a question, a document, or a topic you are curious about. We can work through it together.' }])
    setMobileNavOpen(false)
  }

  function openHistory(item) {
    setSubmittedPrompt(item.prompt)
    setPrompt(item.prompt)
    setActivePage('result')
  }

  function toggleSave() {
    const entry = { prompt: submittedPrompt || prompt || 'Research notes', tool: selectedTool, date: new Date().toLocaleDateString() }
    setSaved((items) => items.some((item) => item.prompt === entry.prompt && item.tool === entry.tool)
      ? items.filter((item) => item.prompt !== entry.prompt || item.tool !== entry.tool)
      : [entry, ...items])
  }

  async function copyResult() {
    const summaryMode = getSummaryMode(selectedTool)
    const summaryResult = summaryMode ? summaryResults[summaryMode] : null
    const text = summaryResult && extractedDocument
      ? getSummaryMarkdown(summaryResult.summary, summaryMode, extractedDocument)
      : `${selectedTool}\n${submittedPrompt}\n\n${demoParagraph}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setExportMessage('')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
      setExportMessage('Could not access the clipboard. Check your browser permissions and try again.')
    }
  }

  function downloadSummary() {
    const summaryMode = getSummaryMode(selectedTool)
    const summary = summaryMode ? summaryResults[summaryMode]?.summary : null
    if (!summary || !extractedDocument) return

    try {
      const markdown = getSummaryMarkdown(summary, summaryMode, extractedDocument)
      const blobUrl = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
      const link = document.createElement('a')
      const baseName = (extractedDocument.uploadedFilename || extractedDocument.filename || 'research-summary')
        .replace(/\.pdf$/i, '')
        .replace(/[<>:"/\\|?*]/g, '-')
        .trim() || 'research-summary'
      link.href = blobUrl
      link.download = `${baseName}-${summaryMode}-summary.md`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
      setExportMessage('')
    } catch {
      setExportMessage('The summary could not be downloaded. Please try again.')
    }
  }

  function sendFollowup(event) {
    event.preventDefault()
    const text = followup.trim()
    if (!text) return
    setMessages((items) => [...items, { role: 'user', text }, { role: 'assistant', text: 'This is a frontend demo response. The workspace is ready to organize a follow-up around your question, selected tool, and learning depth.' }])
    setFollowup('')
    setActivePage('chat')
  }

  function handlePromptKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitPrompt()
    }
  }

  function renderWelcome() {
    return (
      <motion.div className="welcome-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
        <div className="welcome-mark"><BrainCircuit size={26} /></div>
        <div className="workspace-overline">YOUR RESEARCH STARTS HERE</div>
        <h1>What do you want to<br /><span>understand?</span></h1>
        <p className="welcome-subtitle">Upload information. Explore knowledge. Discover insights.</p>
        <div
          className={`prompt-composer${dropActive ? ' composer-drop-active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            if (Array.from(event.dataTransfer.types).includes('Files')) setDropActive(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDropActive(false)
          }}
          onDrop={handleComposerDrop}
        >
          {attachments.length > 0 && <div className="attachment-list"><div className="attachment-chip"><span className="attachment-type"><FileText size={16} /></span><span className="attachment-name"><b title={attachments[0].name}>{attachments[0].name}</b><small>PDF · {formatFileSize(attachments[0].size)}</small></span><button type="button" aria-label={`Remove ${attachments[0].name}`} disabled={isExtracting} onClick={() => { setAttachments([]); setExtractedDocument(null); setUploadError('') }}><X size={14} /></button></div></div>}
          {uploadError && <p className="attachment-error" role="alert">{uploadError}</p>}
          {isExtracting && <div className="extraction-status" role="status" aria-live="polite"><span className="extraction-spinner" />Extracting research content...</div>}
          {extractedDocument && <div className="extraction-success" role="status" aria-live="polite"><Check size={15} /><span><b>Research document successfully processed.</b><small>{extractedDocument.uploadedFilename} · {extractedDocument.page_count} {extractedDocument.page_count === 1 ? 'page' : 'pages'} · Extraction complete</small></span></div>}
          <div className="composer-input-row">
            <div className="attach-wrap">
              <button type="button" className="composer-plus" aria-label="Upload a PDF" title="Upload a PDF" disabled={isExtracting} onClick={() => documentInput.current?.click()}><Plus size={19} /></button>
              <input ref={documentInput} type="file" accept=".pdf,application/pdf" hidden onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} />
            </div>
            <textarea ref={textareaRef} value={prompt} onChange={(event) => { setPrompt(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px` }} onKeyDown={handlePromptKeyDown} placeholder="Ask anything, enter a research topic, or tell Insight Forge what you want to understand..." rows={2} aria-label="Your research question" />
          </div>
          <div className="composer-bottom">
            <div className="selected-tool-label"><Sparkles size={13} /><span>{selectedTool}</span><button type="button" onClick={() => setMobileToolsOpen(true)}>Change</button></div>
            <div className="composer-controls">
              <div className="mode-wrap">
                <button type="button" className="mode-selector" aria-expanded={modeMenuOpen} onClick={() => setModeMenuOpen((open) => !open)}><span className="mode-glyph"><Brain size={13} /></span>{depth}<ChevronDown size={13} /></button>
                <AnimatePresence>{modeMenuOpen && <motion.div className="mode-popover" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>{modes.map((mode) => <button key={mode.id} type="button" className={depth === mode.id ? 'mode-active' : ''} onClick={() => { setDepth(mode.id); setModeMenuOpen(false) }}><span><b>{mode.id}</b><small>{mode.detail}</small></span>{depth === mode.id && <Check size={15} />}</button>)}</motion.div>}</AnimatePresence>
              </div>
              <button type="button" className="submit-prompt" aria-label={isExtracting ? 'Extracting research content' : 'Explore this prompt'} disabled={isExtracting} onClick={() => submitPrompt()}>{isExtracting ? <span className="extraction-spinner submit-spinner" /> : <ArrowRight size={18} />}</button>
            </div>
          </div>
        </div>
        <div className="composer-hint"><span><span className="hint-dot" />PRIVATE BY DESIGN</span><i /> PDFs are sent to the local API for text extraction.</div>
        <div className="suggestion-label">A FEW PLACES TO BEGIN</div>
        <div className="suggestion-grid">
          {[['How does machine learning work?', Sparkles], ['Compare two research approaches', GitCompareArrows], ['Map the ideas in my paper', Network]].map(([text, Icon]) => <button type="button" key={text} onClick={() => { setPrompt(text); textareaRef.current?.focus() }}><Icon size={14} /><span>{text}</span><ArrowRight size={13} /></button>)}
        </div>
      </motion.div>
    )
  }

  function renderResult() {
    const isSaved = saved.some((item) => item.prompt === submittedPrompt && item.tool === selectedTool)
    const summaryMode = getSummaryMode(selectedTool)
    const summaryResult = summaryMode ? summaryResults[summaryMode] : null
    const summaryLoading = summaryMode && summaryLoadingModes.some(
      (pending) => pending.documentData === extractedDocument && pending.summaryMode === summaryMode,
    )
    const showSummaryReader = Boolean(summaryMode && extractedDocument)
    return (
      <motion.div className="result-view" initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }}>
        <div className="result-crumb"><button onClick={startNewChat}><ArrowLeft size={14} /> New exploration</button><span>/</span><span>{selectedTool}</span></div>
        {showSummaryReader
          ? <>
            <SummaryReadingView
              result={summaryResult}
              documentData={extractedDocument}
              mode={summaryMode}
              loading={summaryLoading}
              error={summaryError}
              onRetry={() => void requestSummary(extractedDocument, selectedTool)}
              onCopy={copyResult}
              onDownload={downloadSummary}
              onSave={toggleSave}
              isSaved={isSaved}
              copied={copied}
              exportMessage={exportMessage}
            />
            <form className="followup-composer" onSubmit={sendFollowup}><MessageCircle size={16} /><input value={followup} onChange={(event) => setFollowup(event.target.value)} placeholder="Ask a follow-up or explore another angle..." aria-label="Ask a follow-up" /><button type="submit" disabled={!followup.trim()} aria-label="Send follow-up"><Send size={16} /></button></form>
            <p className="followup-note">Follow-up responses are demo-only and do not represent generated research.</p>
          </>
          : <>
            <div className="submitted-query"><span className="query-avatar"><MessageCircle size={15} /></span><div><span className="workspace-overline">YOUR QUESTION</span><p>{submittedPrompt}</p>{attachments.length > 0 && <div className="query-files">{attachments.map((file) => <span key={file.name}><FileText size={12} />{file.name}</span>)}</div>}{extractedDocument && <div className="result-document-status"><Check size={13} /><span><b>Research document successfully processed.</b><small>{extractedDocument.uploadedFilename} · {extractedDocument.page_count} {extractedDocument.page_count === 1 ? 'page' : 'pages'} · Extraction complete</small></span></div>}</div></div>
            <div className="result-heading"><div><span className="workspace-overline">{summaryResult ? 'INSIGHT FORGE · RESEARCH SUMMARY' : 'INSIGHT FORGE · DEMO PREVIEW'}</span><h1>{selectedTool}</h1><p>{summaryResult ? `${summaryResult.summary_word_count.toLocaleString()} summary words · ${summaryResult.original_word_count.toLocaleString()} source words` : `Organized for ${depth.toLowerCase()}-level understanding`}</p></div><div className="result-actions"><button type="button" onClick={copyResult}><Copy size={14} />{copied ? 'Copied' : 'Copy'}</button><button type="button" className={isSaved ? 'saved-action' : ''} onClick={toggleSave}>{isSaved ? <Check size={14} /> : <Bookmark size={14} />}{isSaved ? 'Saved' : 'Save'}</button><button type="button" className="icon-button result-more" title="More options"><MoreHorizontal size={17} /></button></div></div>
            {summaryResult
              ? <div className="demo-notice summary-notice"><Check size={14} /><span><b>{summaryResult.filename}</b> · {summaryMode === 'brief' ? 'Brief' : 'Detailed'} research summary generated from the extracted paper.</span></div>
              : <div className="demo-notice"><Sparkles size={14} /><span><b>Illustrative preview</b> — sample content only; no AI processing has taken place.</span></div>}
            <article className="result-content"><div className="result-content-top"><span className="result-type-icon">{(() => { const Icon = currentTool[2]; return <Icon size={16} /> })()}</span><div><b>{selectedTool}</b><small>{summaryResult ? `${summaryMode === 'brief' ? 'Concise' : 'Structured'} AI-generated research summary` : summaryLoading ? 'Generating research summary…' : `Example output · ${depth.toLowerCase()} depth`}</small></div><span className="sample-pill">{summaryResult ? 'PROCESSED' : summaryLoading ? 'WORKING' : 'SAMPLE'}</span></div><div className="result-content-body">{summaryResult ? <SampleOutput tool={selectedTool} /> : summaryLoading ? <div className="summary-loading" role="status" aria-live="polite"><span className="extraction-spinner" />Generating your {summaryMode} research summary...</div> : summaryError && summaryMode && extractedDocument ? null : <SampleOutput tool={selectedTool} />}</div></article>
            <div className="references-card"><div className="reference-title"><Files size={15} /><b>References & materials</b><span>DEMO PLACEHOLDERS</span></div><div className="reference-row"><FileText size={15} /><span><b>{attachments[0]?.name || 'Research paper reference'}</b><small>Source material · citation placeholder</small></span><ArrowDownToLine size={14} /></div></div>
            <form className="followup-composer" onSubmit={sendFollowup}><MessageCircle size={16} /><input value={followup} onChange={(event) => setFollowup(event.target.value)} placeholder="Ask a follow-up or explore another angle..." aria-label="Ask a follow-up" /><button type="submit" disabled={!followup.trim()} aria-label="Send follow-up"><Send size={16} /></button></form>
            <p className="followup-note">Demo responses are illustrative and do not represent generated research.</p>
          </>}
      </motion.div>
    )
  }

  function renderChat() {
    return <div className="chat-view"><div className="page-title-block"><span className="workspace-overline">THINK IT THROUGH</span><h1>Research chat</h1><p>A sample conversation space for asking follow-up questions.</p></div><div className="chat-thread">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><span className="chat-avatar">{message.role === 'assistant' ? <BrainCircuit size={15} /> : 'Y'}</span><div><small>{message.role === 'assistant' ? 'INSIGHT FORGE · DEMO' : 'YOU'}</small><p>{message.text}</p></div></div>)}</div><form className="chat-input-form" onSubmit={sendFollowup}><button type="button" className="chat-attach" aria-label="Attach a file" onClick={() => chatFileInput.current?.click()}><Plus size={17} /></button><input ref={chatFileInput} type="file" accept=".pdf,.docx,.txt,image/*" hidden onChange={(event) => setAttachedMessage(event.target.files[0] || null)} /><input value={followup} onChange={(event) => setFollowup(event.target.value)} placeholder="Message Insight Forge..." aria-label="Chat message" /><button type="submit" className="chat-send" disabled={!followup.trim()} aria-label="Send message"><Send size={16} /></button></form>{attachedMessage && <div className="chat-attachment-note"><FileText size={13} />{attachedMessage.name}<button onClick={() => setAttachedMessage(null)} aria-label="Remove attachment"><X size={13} /></button></div>}<div className="chat-demo-note"><Sparkles size={13} /> Sample conversation only. No AI service is connected.</div></div>
  }

  function renderHistory() {
    return <div className="library-view"><div className="page-title-block"><span className="workspace-overline">PICK UP WHERE YOU LEFT OFF</span><h1>Chat history</h1><p>Your recent explorations in this prototype.</p></div><label className="library-search"><Search size={16} /><input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search conversations..." /><kbd>⌘ K</kbd></label><div className="library-list">{filteredHistory.length ? filteredHistory.map((item, index) => <div className="library-row" key={`${item.title}-${index}`}><button className="library-row-main" onClick={() => openHistory(item)}><span className="library-row-icon"><MessageSquare size={16} /></span><span><b>{item.title}</b><small>{item.date}</small></span><ChevronRight size={15} /></button><button className="row-delete" aria-label={`Delete ${item.title}`} onClick={() => setDeleteCandidate(item)}><Trash2 size={14} /></button></div>) : <div className="empty-state"><Search size={21} /><b>No conversations found</b><span>Try a different search.</span></div>}</div></div>
  }

  function renderSaved() {
    return <div className="library-view"><div className="page-title-block"><span className="workspace-overline">KEEP WHAT MATTERS</span><h1>Saved knowledge</h1><p>Ideas you’ve chosen to keep close.</p></div>{saved.length ? <div className="library-list">{saved.map((item, index) => <div className="library-row" key={`${item.prompt}-${index}`}><button className="library-row-main" onClick={() => { setSubmittedPrompt(item.prompt); setSelectedTool(item.tool); setActivePage('result') }}><span className="library-row-icon saved-row-icon"><Bookmark size={16} /></span><span><b>{item.prompt}</b><small>{item.tool} · Saved {item.date}</small></span><ChevronRight size={15} /></button><button className="row-delete" aria-label="Remove saved knowledge" onClick={() => setSaved((items) => items.filter((savedItem) => savedItem !== item))}><Trash2 size={14} /></button></div>)}</div> : <div className="empty-state"><Bookmark size={22} /><b>Your saved space is ready</b><span>Save a sample result to keep it here.</span><button className="subtle-button" onClick={() => setActivePage('welcome')}>Start exploring <ArrowRight size={14} /></button></div>}</div>
  }

  function renderDocuments() {
    const documents = [...attachments.map((file) => ({ name: file.name, size: `${(file.size / 1024).toFixed(0)} KB`, kind: file.type.startsWith('image/') ? 'Image' : file.name.split('.').pop().toUpperCase() })), { name: 'Sample research paper.pdf', size: '2.4 MB', kind: 'PDF' }, { name: 'Learning systems review.docx', size: '842 KB', kind: 'DOCX' }]
    return <div className="library-view"><div className="page-title-block"><span className="workspace-overline">YOUR RESEARCH MATERIALS</span><h1>My documents</h1><p>Files are shown locally as a prototype preview.</p></div><div className="documents-notice"><ShieldCheck size={15} />Files selected in this demo are not uploaded or processed.</div><div className="library-list">{documents.map((file, index) => <div className="document-row" key={`${file.name}-${index}`}><span className="document-type-icon"><FileText size={17} /></span><span><b>{file.name}</b><small>{file.kind} · {file.size}</small></span><button className="icon-button" title="Document options"><MoreHorizontal size={17} /></button></div>)}</div></div>
  }

  function renderSkills() {
    return <div className="library-view skills-view"><div className="page-title-block"><span className="workspace-overline">YOUR LEARNING JOURNEY</span><h1>Skill analysis</h1><p>A sample snapshot of your topic understanding.</p></div><div className="skill-overview"><div><span className="workspace-overline">OVERALL UNDERSTANDING</span><strong>68<span>%</span></strong><p>Sample progress indicator</p></div><div className="skill-ring"><span>68<small>%</small></span></div></div><div className="skill-columns"><section className="skill-card"><h2><BarChart3 size={16} />Topic understanding</h2>{[['Research methods', 82], ['Machine learning', 68], ['Data interpretation', 54], ['Academic writing', 76]].map(([label, percent]) => <div className="skill-bar-row" key={label}><div><span>{label}</span><b>{percent}%</b></div><i><em style={{ width: `${percent}%` }} /></i></div>)}</section><section className="skill-card"><h2><Lightbulb size={16} />Suggested next</h2>{['Study evaluation methods', 'Explore model interpretability', 'Review evidence quality'].map((item, index) => <div className="skill-suggestion" key={item}><span>0{index + 1}</span>{item}<ArrowRight size={14} /></div>)}</section></div><div className="sample-data-note"><Sparkles size={14} />Skill data is illustrative and not based on personal learning history.</div></div>
  }

  function renderSettings() {
    return <div className="library-view settings-view"><div className="page-title-block"><span className="workspace-overline">MAKE IT YOURS</span><h1>Settings</h1><p>Adjust your workspace preferences.</p></div><section className="settings-section"><h2>Appearance</h2><div className="setting-row"><span><b>Theme</b><small>Choose a comfortable workspace appearance.</small></span><button className="theme-switch" onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}><span>{theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}{theme === 'dark' ? 'Dark' : 'Light'}</span><ChevronDown size={14} /></button></div></section><section className="settings-section"><h2>Research preferences</h2>{[['citations', 'Show reference placeholders', 'Include source placeholders in demo results.'], ['suggestions', 'Show topic suggestions', 'Display starter questions on the welcome screen.']].map(([key, title, detail]) => <div className="setting-row" key={key}><span><b>{title}</b><small>{detail}</small></span><button className={`toggle-switch${settings[key] ? ' toggle-on' : ''}`} role="switch" aria-checked={settings[key]} aria-label={title} onClick={() => setSettings((current) => ({ ...current, [key]: !current[key] }))}><i /></button></div>)}</section><p className="settings-demo-note">Preferences apply to this open demo session only.</p></div>
  }

  function renderPage() {
    switch (activePage) {
      case 'welcome': return renderWelcome()
      case 'result': return renderResult()
      case 'chat': return renderChat()
      case 'history': return renderHistory()
      case 'saved': return renderSaved()
      case 'documents': return renderDocuments()
      case 'skills': return renderSkills()
      case 'settings': return renderSettings()
      default: return renderWelcome()
    }
  }

  return (
    <div className={`workspace-shell${theme === 'light' ? ' workspace-light' : ''}${leftCollapsed ? ' sidebar-is-collapsed' : ''}${rightCollapsed ? ' tools-are-collapsed' : ''}`}>
      {(mobileNavOpen || mobileToolsOpen) && <button className="workspace-scrim" aria-label="Close navigation panel" onClick={() => { setMobileNavOpen(false); setMobileToolsOpen(false) }} />}
      <aside className={`sidebar${leftCollapsed ? ' sidebar-collapsed' : ''}${mobileNavOpen ? ' sidebar-mobile-open' : ''}`}>
        <div className="sidebar-brand-row"><a href="/" aria-label="Back to Insight Forge homepage"><AppLogo compact={leftCollapsed} /></a><button type="button" className="icon-button sidebar-collapse" onClick={() => setLeftCollapsed((value) => !value)} aria-label={leftCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}><ChevronLeft size={16} /></button></div>
        <button type="button" className="new-chat-button" onClick={startNewChat}><Plus size={16} /><span>New exploration</span><kbd>⌘ N</kbd></button>
        <div className="sidebar-section-label">{!leftCollapsed && 'WORKSPACE'}</div>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {navItems.map(({ id, label, icon: Icon }) => <button type="button" key={id} title={leftCollapsed ? label : undefined} className={`sidebar-link${activePage === id || (id === 'welcome' && activePage === 'result') ? ' sidebar-link-active' : ''}`} onClick={() => { setActivePage(id); setMobileNavOpen(false) }}><Icon size={17} /><span>{label}</span>{id === 'saved' && saved.length > 0 && <small>{saved.length}</small>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <button type="button" className={`sidebar-link${activePage === 'settings' ? ' sidebar-link-active' : ''}`} title={leftCollapsed ? 'Settings' : undefined} onClick={() => { setActivePage('settings'); setMobileNavOpen(false) }}><Settings size={17} /><span>Settings</span></button>
          <div className="profile-card"><span className="profile-avatar">IF</span><span className="profile-copy"><b>Researcher</b><small>Personal workspace</small></span><MoreHorizontal size={16} /></div>
        </div>
      </aside>
      <section className="workspace-center">
        <header className="workspace-topbar">
          <div className="topbar-leading"><button type="button" className="icon-button mobile-sidebar-toggle" aria-label="Open workspace navigation" onClick={() => setMobileNavOpen(true)}><Menu size={18} /></button><span>{activeTitle}</span></div>
          <div className="topbar-actions"><span className="demo-indicator"><i /> FRONTEND DEMO</span><button type="button" className="icon-button topbar-theme" title="Toggle theme" onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button><button type="button" className="icon-button mobile-tools-toggle" aria-label="Open AI workspace tools" onClick={() => setMobileToolsOpen(true)}><Sparkles size={16} /></button><button type="button" className="icon-button desktop-tools-toggle" title={rightCollapsed ? 'Expand AI tools' : 'Collapse AI tools'} onClick={() => setRightCollapsed((value) => !value)}><PanelIcon collapsed={rightCollapsed} /></button></div>
        </header>
        <main className={`workspace-main workspace-page-${activePage}`}>{renderPage()}</main>
      </section>
      <ToolPanel selectedTool={selectedTool} onSelect={handleToolSelect} collapsed={rightCollapsed} onCollapse={() => setRightCollapsed((value) => !value)} mobileOpen={mobileToolsOpen} onClose={() => setMobileToolsOpen(false)} />
      {deleteCandidate && <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setDeleteCandidate(null) }}><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><span className="modal-icon"><Trash2 size={19} /></span><h2 id="delete-title">Delete this conversation?</h2><p>“{deleteCandidate.title}” will be removed from this demo history.</p><div><button className="subtle-button" onClick={() => setDeleteCandidate(null)}>Cancel</button><button className="delete-confirm" onClick={() => { setHistory((items) => items.filter((item) => item !== deleteCandidate)); setDeleteCandidate(null) }}>Delete conversation</button></div></div></div>}
    </div>
  )
}

function PanelIcon({ collapsed }) {
  return collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />
}

export default Workspace
