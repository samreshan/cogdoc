const DEMO_TITLE = 'Cogdoc Research IDE — Demonstration'
const DEMO_MARKER = '[COGDOC_RESEARCH_DEMO_V1]'

const sources = [
  {
    key: 'unesco',
    title: 'Guidance for generative AI in education and research',
    filename: 'UNESCO-2023-generative-AI-guidance-demo.pdf',
    authors: ['UNESCO'],
    year: '2023',
    doi: null,
    url: 'https://unesdoc.unesco.org/ark:/48223/pf0000386693',
    venue: 'UNESCO',
    qualityScore: 0.92,
    qualityExplanation: 'Primary guidance from an international public institution; full text and publication provenance are available.',
    chunks: [
      { page: 1, sourcePage: 13, text: 'Demo paraphrase: Institutions should protect human agency when adopting generative AI. People remain responsible for educational and research decisions, and automated output should not replace human judgement.' },
      { page: 2, sourcePage: 18, text: 'Demo paraphrase: Users need critical AI literacy, including the ability to inspect limitations, question generated claims, and understand how training data and system design shape an answer.' },
      { page: 3, sourcePage: 26, text: 'Demo paraphrase: Governance should address privacy, transparency, accountability, inclusion, and age-appropriate use rather than treating technical availability as sufficient justification for adoption.' },
    ],
  },
  {
    key: 'kasneci',
    title: 'ChatGPT for good? On opportunities and challenges of large language models for education',
    filename: 'Kasneci-et-al-2023-LLM-education-demo.pdf',
    authors: ['Enkelejda Kasneci', 'Kathrin Sessler', 'Stefan Küchemann', 'Maria Bannert'],
    year: '2023',
    doi: '10.1016/j.lindif.2023.102274',
    url: 'https://doi.org/10.1016/j.lindif.2023.102274',
    venue: 'Learning and Individual Differences',
    qualityScore: 0.9,
    qualityExplanation: 'Peer-reviewed synthesis with a DOI and clear discussion of both opportunities and limitations.',
    chunks: [
      { page: 1, sourcePage: 2, text: 'Demo paraphrase: Large language models can support explanation, feedback, and exploratory learning, but their benefits depend on deliberate instructional design and informed use.' },
      { page: 2, sourcePage: 5, text: 'Demo paraphrase: Fluent responses can contain factual errors and fabricated references. Learners and researchers therefore need verification practices rather than treating confidence or readability as evidence.' },
      { page: 3, sourcePage: 8, text: 'Demo paraphrase: Productive use should develop critical thinking and subject knowledge. Assistance becomes risky when it encourages dependency or bypasses the learner’s own reasoning process.' },
    ],
  },
  {
    key: 'bender',
    title: 'On the dangers of stochastic parrots: Can language models be too big?',
    filename: 'Bender-et-al-2021-stochastic-parrots-demo.pdf',
    authors: ['Emily M. Bender', 'Timnit Gebru', 'Angelina McMillan-Major', 'Shmargaret Shmitchell'],
    year: '2021',
    doi: '10.1145/3442188.3445922',
    url: 'https://doi.org/10.1145/3442188.3445922',
    venue: 'FAccT 2021',
    qualityScore: 0.91,
    qualityExplanation: 'Peer-reviewed conference paper with stable DOI metadata and a widely documented analytical framework.',
    chunks: [
      { page: 1, sourcePage: 614, text: 'Demo paraphrase: A language model produces sequences from patterns in training data without grounding those sequences in communicative intent or an accountable understanding of the world.' },
      { page: 2, sourcePage: 615, text: 'Demo paraphrase: Scale can obscure the values and exclusions embedded in training data. Documentation and careful analysis are needed to make those limitations visible.' },
      { page: 3, sourcePage: 618, text: 'Demo paraphrase: Apparent coherence should not be mistaken for evidence or understanding. Readers can attribute meaning and authority to text that the system did not produce through a truth-seeking process.' },
    ],
  },
]

const claims = {
  agency: 'Research IDEs should keep the researcher in control of interpretation while making evidence easier to inspect.',
  fluency: 'Generative systems can accelerate exploration, but confident output can conceal missing evidence and encourage uncritical acceptance.',
  retrieval: 'Local passage retrieval makes provenance visible, although retrieval quality still depends on source coverage and indexing choices.',
  conclusion: 'A useful research companion should ask the author to qualify this conclusion before suggesting more material.',
}

const interventions = [
  {
    engineType: 'citation', promptTemplateTag: 'Lens', promptText: claims.agency,
    responseText: 'What source backs this up?',
    verdict: 'partially_supported', evidence: [{ source: 'unesco', chunk: 0, score: 0.91 }, { source: 'kasneci', chunk: 2, score: 0.78 }],
  },
  {
    engineType: 'interceptor', promptTemplateTag: 'The Spark Gap', promptText: claims.fluency,
    responseText: 'How would you notice this happening?',
  },
  {
    engineType: 'scaffold', promptTemplateTag: 'Structural Scaffold', promptText: claims.retrieval,
    responseText: 'What should this section explain first?',
  },
  {
    engineType: 'socratic', promptTemplateTag: 'Provocation', promptText: claims.conclusion,
    responseText: 'What should happen when evidence is missing?',
  },
]

function citationNode(reference, locator = null) {
  const family = reference.authors[0].split(/\s+/).at(-1)
  return {
    type: 'structuredCitation',
    attrs: {
      referenceId: reference.id,
      title: reference.title,
      author: reference.authors.length > 2 ? `${family} et al.` : family,
      year: reference.year,
      locator,
      verified: true,
      metadataVersion: 'confirmed:1',
    },
  }
}

function paragraph(text, citations = []) {
  return { type: 'paragraph', content: [{ type: 'text', text }, ...citations.map((citation) => ({ type: 'text', text: ' ' }, citation))] }
}

function buildDocument(referencesByKey) {
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Research companions that preserve scholarly agency' }] },
      paragraph('Working thesis: research software is most useful when it reduces evidence-handling friction without taking ownership of the researcher’s argument.'),
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Agency before automation' }] },
      paragraph(claims.agency, [citationNode(referencesByKey.unesco, 'p. 13')]),
      paragraph(claims.fluency, [citationNode(referencesByKey.kasneci, 'p. 5'), citationNode(referencesByKey.bender, 'p. 618')]),
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A provenance-first interface' }] },
      paragraph(claims.retrieval),
      paragraph('The interface should expose which passage matched, how it matched, and whether the available corpus is broad enough for the question.'),
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Questions for evaluation' }] },
      paragraph(claims.conclusion),
      paragraph('The next study should compare source verification, claim revision, and citation accuracy with and without inline interventions.'),
    ],
  }
}

const actions = [
  {
    kind: 'verification_blocker', title: 'Define researcher agency operationally',
    detail: 'The central claim names agency but does not yet state how the evaluation will observe or measure it.', priority: 94, pinned: true,
    quote: claims.agency, targetKind: 'claim', factors: { pinned: 20, blocker: 30, deadline: 0, evidence: 12, requirement: 12, citation: 0, quality: 4, centrality: 15, aiAdjustment: 1 },
  },
  {
    kind: 'evidence_gap', title: 'Find evaluation evidence for provenance interfaces',
    detail: 'The uploaded sources motivate verification but do not directly evaluate a passage-linked research IDE.', priority: 79, pinned: false,
    quote: claims.retrieval, targetKind: 'claim', factors: { pinned: 0, blocker: 20, deadline: 0, evidence: 22, requirement: 10, citation: 0, quality: 5, centrality: 15, aiAdjustment: 4 },
  },
  {
    kind: 'counterevidence', title: 'Test whether interventions interrupt deep work',
    detail: 'Add evidence or a study condition that can reveal when active assistance becomes distracting.', priority: 67, pinned: false,
    quote: claims.conclusion, targetKind: 'document', factors: { pinned: 0, blocker: 10, deadline: 0, evidence: 18, requirement: 8, citation: 0, quality: 4, centrality: 15, aiAdjustment: 5 },
  },
]

module.exports = { DEMO_TITLE, DEMO_MARKER, sources, claims, interventions, actions, buildDocument }
