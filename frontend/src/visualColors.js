export const CATEGORY_COLORS = {
  'central topic': '#70d7e2',
  concept: '#70d7e2',
  theory: '#b59cfb',
  method: '#69b8ff',
  finding: '#76d7ac',
  application: '#f0bc71',
  limitation: '#f07e99',
  dataset: '#c19cff',
  start: '#69d6ae',
  end: '#ae9af5',
  process: '#70c8e7',
  decision: '#f1bb70',
  input: '#74d5d0',
  output: '#8fd38d',
  data: '#95a9c5',
  activity: '#70c8e7',
  transformation: '#b59cfb',
  iteration: '#f0bc71',
}

export function colorFor(category) {
  return CATEGORY_COLORS[String(category || '').toLowerCase()] || '#a899ef'
}
