export interface ArticleEvidence {
  sourceTitle: string
  locator: string | null
  excerpt: string | null
}

export interface ArticleFindingInput {
  findingId: string
  findingRevisionId: string
  dependencyHash: string
  question: string
  conclusion: string | null
  explanation: string | null
  uncertainty: string | null
  limitations: string | null
  conflicts: string | null
  evidence: ArticleEvidence[]
}

export interface ArticleDraftRequest {
  title: string
  audience: string | null
  purpose: string | null
  findings: ArticleFindingInput[]
}

export interface ArticleDraftResponse {
  content: string
  sourceIndexes: number[]
  unsupportedClaims: string[]
  modelVersion?: string | null
}

export interface ArticleDraftProvider {
  draftArticleFromFindings(input: ArticleDraftRequest): Promise<ArticleDraftResponse>
}
