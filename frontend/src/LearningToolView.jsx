import { useState } from 'react'
import { BookOpen, Check, ChevronLeft, ChevronRight, RotateCcw, Sparkles } from 'lucide-react'

function SourcePages({ pages }) {
  if (!Array.isArray(pages) || pages.length === 0) return null
  return <small className="learning-source-pages">Source pages: {pages.join(', ')}</small>
}

function LearningMaterial({ tool, material }) {
  const [cardIndex, setCardIndex] = useState(0)
  const [cardRevealed, setCardRevealed] = useState(false)
  const [answers, setAnswers] = useState({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const sections = material.sections || []
  const cards = material.cards || []
  const questions = material.questions || []
  const concepts = material.concepts || []
  const definitions = material.definitions || []
  const quizScore = questions.reduce(
    (score, question, index) => score + (answers[index] === question.answer_index ? 1 : 0),
    0,
  )

  if (tool === 'Structured Notes') {
    return (
      <div className="learning-material">
        <p className="learning-overview">{material.overview}</p>
        {material.learning_objectives?.length > 0 && <section className="learning-objectives">
          <h2>Learning objectives</h2>
          <ul>{material.learning_objectives.map((objective, index) => <li key={`${index}-${objective}`}>{objective}</li>)}</ul>
        </section>}
        <div className="learning-sections">
          {sections.map((section, index) => <article className="learning-card" key={`${index}-${section.heading}`}>
            <h2>{section.heading}</h2>
            <p>{section.content}</p>
            {section.key_points?.length > 0 && <ul>{section.key_points.map((point, pointIndex) => <li key={`${pointIndex}-${point}`}>{point}</li>)}</ul>}
            <SourcePages pages={section.source_pages} />
          </article>)}
        </div>
        {material.review_questions?.length > 0 && <section className="learning-card">
          <h2>Review questions</h2>
          <ol>{material.review_questions.map((question, index) => <li key={`${index}-${question}`}>{question}</li>)}</ol>
        </section>}
      </div>
    )
  }

  if (tool === 'Flashcards') {
    const card = cards[cardIndex]
    if (!card) return null
    return (
      <div className="learning-material learning-flashcards">
        <div className="learning-card-count">Card {cardIndex + 1} of {cards.length}</div>
        <button type="button" className={`learning-flashcard${cardRevealed ? ' is-revealed' : ''}`} onClick={() => setCardRevealed((revealed) => !revealed)}>
          <span>{cardRevealed ? 'ANSWER' : 'QUESTION'}</span>
          <b>{cardRevealed ? card.back : card.front}</b>
          <small>{cardRevealed ? 'Click to show question' : 'Click to reveal answer'}</small>
        </button>
        <SourcePages pages={card.source_pages} />
        <div className="learning-card-controls">
          <button type="button" className="learning-secondary-button" disabled={cardIndex === 0} onClick={() => { setCardIndex((index) => index - 1); setCardRevealed(false) }}><ChevronLeft size={15} />Previous</button>
          <button type="button" className="learning-secondary-button" onClick={() => { setCardIndex((index) => (index + 1) % cards.length); setCardRevealed(false) }}>Next<ChevronRight size={15} /></button>
        </div>
      </div>
    )
  }

  if (tool === 'Quiz Generator') {
    return (
      <div className="learning-material">
        {quizSubmitted && <div className="learning-quiz-score" role="status">Score: {quizScore} / {questions.length}</div>}
        {questions.map((question, questionIndex) => <article className="learning-card learning-question" key={`${questionIndex}-${question.question}`}>
          <h2><span>{String(questionIndex + 1).padStart(2, '0')}</span>{question.question}</h2>
          <div className="learning-options">
            {question.options.map((option, optionIndex) => {
              const selected = answers[questionIndex] === optionIndex
              const correct = quizSubmitted && question.answer_index === optionIndex
              const incorrect = quizSubmitted && selected && !correct
              return <button
                type="button"
                key={`${optionIndex}-${option}`}
                className={`learning-option${selected ? ' is-selected' : ''}${correct ? ' is-correct' : ''}${incorrect ? ' is-incorrect' : ''}`}
                disabled={quizSubmitted}
                onClick={() => setAnswers((previous) => ({ ...previous, [questionIndex]: optionIndex }))}
              ><span>{String.fromCharCode(65 + optionIndex)}</span>{option}{correct && <Check size={15} />}</button>
            })}
          </div>
          {quizSubmitted && <div className="learning-answer-explanation"><b>{answers[questionIndex] === question.answer_index ? 'Correct' : `Correct answer: ${question.options[question.answer_index]}`}</b><p>{question.explanation}</p><SourcePages pages={question.source_pages} /></div>}
        </article>)}
        <button
          type="button"
          className="learning-primary-button"
          disabled={!quizSubmitted && Object.keys(answers).length !== questions.length}
          onClick={() => {
            if (quizSubmitted) {
              setAnswers({})
              setQuizSubmitted(false)
            } else {
              setQuizSubmitted(true)
            }
          }}
        >{quizSubmitted ? <><RotateCcw size={14} />Try again</> : 'Check answers'}</button>
      </div>
    )
  }

  if (tool === 'Beginner Explanation') {
    return (
      <div className="learning-material">
        <p className="learning-overview">{material.overview}</p>
        <div className="learning-sections">
          {concepts.map((concept, index) => <article className="learning-card learning-concept" key={`${index}-${concept.concept}`}>
            <span className="learning-concept-number">{String(index + 1).padStart(2, '0')}</span>
            <div><h2>{concept.concept}</h2><p>{concept.simple_explanation}</p>
              {concept.analogy && <div className="learning-analogy"><b>Analogy</b><p>{concept.analogy}</p></div>}
              {concept.technical_note && <div className="learning-technical-note"><b>Technical note</b><p>{concept.technical_note}</p></div>}
              <SourcePages pages={concept.source_pages} />
            </div>
          </article>)}
        </div>
        {material.key_takeaways?.length > 0 && <section className="learning-card">
          <h2>Key takeaways</h2>
          <ul>{material.key_takeaways.map((takeaway, index) => <li key={`${index}-${takeaway}`}>{takeaway}</li>)}</ul>
        </section>}
      </div>
    )
  }

  if (tool === 'Important Definitions') {
    return (
      <div className="learning-material learning-definitions">
        {definitions.map((definition, index) => <article className="learning-card" key={`${index}-${definition.term}`}>
          <h2>{definition.term}</h2>
          <p>{definition.definition}</p>
          <div className="learning-definition-context"><b>In this paper</b><p>{definition.context}</p></div>
          <SourcePages pages={definition.source_pages} />
        </article>)}
      </div>
    )
  }

  return null
}

export default function LearningToolView({
  result,
  tool,
  loading,
  error,
  hasDocument,
  onRetry,
  onRegenerate,
}) {
  const material = result?.learning_material
  const generated = result?.tool === tool && material

  return (
    <section className="learning-tool-view" aria-label={`${tool} learning material`}>
      <header className="learning-view-header">
        <div>
          <span className="workspace-overline">LEARNING · {tool.toUpperCase()}</span>
          <h1>{generated ? material.title : tool}</h1>
          <p>{generated ? `${result.filename} · Based on your research paper` : 'Turn your research paper into an active learning experience.'}</p>
        </div>
        {generated && <button type="button" className="learning-secondary-button" disabled={loading} onClick={onRegenerate}><Sparkles size={14} />Regenerate</button>}
      </header>

      {error && !generated && <div className="learning-state learning-error" role="alert"><span>{error}</span><button type="button" onClick={onRetry}>Retry</button></div>}
      {loading && !generated && <div className="learning-state" role="status"><span className="extraction-spinner" />Generating paper-based learning material…</div>}
      {loading && generated && <div className="learning-inline-loading" role="status"><span className="extraction-spinner" />Regenerating while keeping the current result available…</div>}
      {!loading && !error && !generated && <div className="learning-state"><BookOpen size={18} />{hasDocument ? 'Select this learning tool to generate material from the processed paper.' : 'Upload and process a research PDF to create learning material from its content.'}</div>}
      {generated && <LearningMaterial key={`${tool}:${result.clientGeneratedAt}`} tool={tool} material={material} />}
      {generated && error && <div className="learning-inline-error" role="alert">{error}</div>}
    </section>
  )
}
