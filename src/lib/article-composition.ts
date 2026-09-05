import { getAIService } from '@/lib/ai-service'
import type { ArticleDraftProvider, ArticleDraftRequest, ArticleDraftResponse, ArticleFindingInput } from './article-composition-types'

export function manualOutlineContent(title: string, findings: ArticleFindingInput[]) {
  const sections = findings.map((finding, index) => {
    const sources = finding.evidence.map((evidence) => '- ' + evidence.sourceTitle + (evidence.locator ? ' (' + evidence.locator + ')' : '')).join('\n')
    return '## ' + (index + 1) + '. ' + finding.question + '\n\n<!-- Write this section in your own words. -->\n\nWorking finding: ' + (finding.conclusion ?? 'Inconclusive') + '\n\nUncertainty: ' + (finding.uncertainty ?? 'Not recorded') + '\n\nSources to inspect:\n' + (sources || '- No linked source recorded')
  })
  return '# ' + title + '\n\n<!-- This outline is a private writing space. It is not published or certified. -->\n\n' + sections.join('\n\n')
}

export function reviewNotes(findings: ArticleFindingInput[], unsupportedClaims: string[]) {
  const locatorLines = findings.flatMap((finding) => finding.evidence.map((evidence) => '- ' + evidence.sourceTitle + (evidence.locator ? ' — ' + evidence.locator : ' — locator unavailable')))
  const uncertaintyLines = findings.map((finding) => '- ' + (finding.uncertainty || 'Uncertainty was not recorded.'))
  return '## Review notes\n\n### Included source locators\n' + (locatorLines.join('\n') || '- No source locators available.') + '\n\n### Preserved uncertainty\n' + uncertaintyLines.join('\n') + '\n\n### Claims requiring researcher review\n' + (unsupportedClaims.map((claim) => '- ' + claim).join('\n') || '- Review every substantive claim against the selected findings before export.')
}

export function validateGeneratedDraft(result: ArticleDraftResponse, findings: ArticleFindingInput[]) {
  const content = result.content?.trim()
  if (!content) throw new Error('The configured provider returned no article content.')
  const invalidSource = result.sourceIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= findings.length)
  if (invalidSource) throw new Error('The configured provider returned an unknown finding reference.')
  return {
    content: content + '\n\n' + reviewNotes(findings, result.unsupportedClaims ?? []),
    modelVersion: result.modelVersion ?? null,
  }
}

export async function configuredArticleDraft(request: ArticleDraftRequest) {
  const service = getAIService() as unknown as Partial<ArticleDraftProvider>
  if (typeof service.draftArticleFromFindings !== 'function') {
    throw new Error('Configured article drafting is unavailable. You can still create a manual outline.')
  }
  return validateGeneratedDraft(await service.draftArticleFromFindings(request), request.findings)
}
