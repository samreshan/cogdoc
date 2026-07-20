/**
 * Seeds a PDF (with chunks) into each sample project, plus a spread of
 * Intervention records (one per engine type, varying status/userAction/verdict)
 * so the margin UI has something to render.
 *
 * Requires scripts/seed-projects.js to have run first.
 * Run inside the container: node scripts/seed-pdfs-interventions.js
 */
const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()

const DEFAULT_EMAIL = 'writer@cogdoc.local'

const fixtures = [
  {
    projectTitle: 'The Ethics of Algorithmic Bias',
    pdf: {
      filename: 'Angwin-et-al-2016-Machine-Bias.pdf',
      rawText:
        'Machine Bias: There\'s software used across the country to predict future criminals. And it\'s biased against blacks. ' +
        'The score proved remarkably unreliable in forecasting violent crime: only 20 percent of the people predicted to commit violent crimes actually went on to do so. ' +
        'Black defendants were often predicted to be at a higher risk of recidivism than they actually were, while white defendants were often predicted to be less risky than they were. ' +
        'Northpointe disputes this, arguing that the tool is equally well calibrated for both races: among defendants who scored high risk, the percentage who reoffended was roughly the same regardless of race.',
      chunks: [
        {
          content:
            'The score proved remarkably unreliable in forecasting violent crime: only 20 percent of the people predicted to commit violent crimes actually went on to do so. Black defendants were often predicted to be at a higher risk of recidivism than they actually were, while white defendants were often predicted to be less risky than they were.',
          pageApprox: 2,
        },
        {
          content:
            'Northpointe disputes this, arguing that the tool is equally well calibrated for both races: among defendants who scored high risk, the percentage who reoffended was roughly the same regardless of race.',
          pageApprox: 3,
        },
        {
          content:
            "Kleinberg, Mullainathan, and Raghavan (2016) later proved that except in special cases, it is mathematically impossible for a risk score to satisfy both equal calibration and equal false-positive rates across groups whenever base rates differ — the two sides of this dispute are not just disagreeing, they are each holding a fairness definition the other cannot simultaneously satisfy.",
          pageApprox: 5,
        },
      ],
    },
    interventions: [
      {
        engineType: 'interceptor',
        promptTemplateTag: 'The Spark Gap',
        promptText: 'write a paragraph about why this is unfair to Black defendants',
        responseText:
          'QUESTION: Which fairness definition are you invoking — equal false-positive rates or equal calibration — and why should it outweigh the one Northpointe used?',
        status: 'active',
        userAction: null,
      },
      {
        engineType: 'citation',
        promptTemplateTag: 'Lens',
        promptText:
          'The COMPAS tool is straightforwardly biased against Black defendants, full stop.',
        responseText:
          'The evidence supports a disparate false-positive rate, but the claim ignores that the tool is also equally calibrated across race — the two facts coexist under different fairness definitions.',
        verdict: 'partially_supported',
        status: 'active',
        userAction: null,
        evidenceChunkIndexes: [0, 1],
      },
      {
        engineType: 'socratic',
        promptTemplateTag: 'Provocation',
        promptText: null,
        responseText:
          'QUESTION: If equal calibration and equal false-positive rates cannot both hold when base rates differ, which trade-off is your argument implicitly choosing?',
        status: 'faded',
        userAction: 'dismissed',
      },
      {
        engineType: 'scaffold',
        promptTemplateTag: 'Structural Scaffold',
        promptText: 'help me structure the impossibility result section',
        responseText: '- Claim: __\n- Evidence: __\n- Limitation: __\n- Implication: __',
        status: 'resolved',
        userAction: 'engaged',
      },
    ],
  },
  {
    projectTitle: 'Climate Policy and Economic Growth',
    pdf: {
      filename: 'Hickel-Kallis-2019-Is-Green-Growth-Possible.pdf',
      rawText:
        'Green growth theory relies on the possibility of absolute, permanent decoupling of GDP growth from resource use and carbon emissions. ' +
        'Empirical evidence for absolute decoupling at anywhere near the rate required to meet the Paris Agreement targets is lacking. ' +
        'Existing decoupling has been relative, not absolute, and mostly attributable to outsourcing carbon-intensive production rather than genuine efficiency gains.',
      chunks: [
        {
          content:
            'Empirical evidence for absolute decoupling at anywhere near the rate required to meet the Paris Agreement targets is lacking; existing studies find at best a temporary and geographically limited effect.',
          pageApprox: 4,
        },
        {
          content:
            'Existing decoupling has been relative, not absolute, and mostly attributable to outsourcing carbon-intensive production to other countries rather than genuine efficiency gains within the decoupling economy.',
          pageApprox: 6,
        },
      ],
    },
    interventions: [
      {
        engineType: 'interceptor',
        promptTemplateTag: 'The Spark Gap',
        promptText: 'basically green growth works and everyone agrees now',
        responseText:
          'QUESTION: Which specific study are you relying on to claim consensus, and does it measure absolute or relative decoupling?',
        status: 'active',
        userAction: null,
      },
      {
        engineType: 'citation',
        promptTemplateTag: 'Lens',
        promptText: 'Decoupling of GDP from emissions is already happening fast enough to hit Paris targets.',
        responseText:
          'The retrieved evidence directly contradicts this: decoupling observed so far is relative, not absolute, and largely due to outsourcing rather than real efficiency gains.',
        verdict: 'unsupported',
        status: 'active',
        userAction: null,
        evidenceChunkIndexes: [0, 1],
      },
      {
        engineType: 'socratic',
        promptTemplateTag: 'Provocation',
        promptText: null,
        responseText:
          'QUESTION: If decoupling so far is mostly outsourced emissions, what happens to your argument once every country tries to outsource simultaneously?',
        status: 'active',
        userAction: null,
      },
    ],
  },
  {
    projectTitle: 'Historiography of the Print Revolution',
    pdf: {
      filename: 'Johns-1998-The-Nature-of-the-Book-excerpt.pdf',
      rawText:
        'Fixity was not an inherent technical property of print, but a social and commercial accomplishment that had to be fought for. ' +
        'Piracy, misattribution, and unauthorized reprinting were endemic in the early print trade, undermining any assumption that print automatically produced stable, trustworthy texts. ' +
        'The credibility of printed knowledge depended on institutions — licensing, registration, professional norms — that emerged slowly and unevenly across Europe.',
      chunks: [
        {
          content:
            'Fixity was not an inherent technical property of print, but a social and commercial accomplishment that had to be fought for by printers, licensers, and authors alike.',
          pageApprox: 1,
        },
        {
          content:
            'Piracy, misattribution, and unauthorized reprinting were endemic in the early print trade, undermining any assumption that print automatically produced stable, trustworthy texts.',
          pageApprox: 3,
        },
        {
          content:
            'The credibility of printed knowledge depended on institutions — licensing, registration, professional norms — that emerged slowly and unevenly across Europe, not on the press itself.',
          pageApprox: 4,
        },
      ],
    },
    interventions: [
      {
        engineType: 'scaffold',
        promptTemplateTag: 'Structural Scaffold',
        promptText: 'help me lay out the Eisenstein vs Johns contrast',
        responseText: '- Claim: __\n- Evidence: __\n- Limitation: __\n- Implication: __',
        status: 'active',
        userAction: null,
      },
      {
        engineType: 'citation',
        promptTemplateTag: 'Lens',
        promptText:
          "Johns argues that print's fixity was a social accomplishment rather than an automatic technical effect.",
        responseText:
          "This is directly supported: the evidence states fixity 'had to be fought for' by printers, licensers, and authors, not produced automatically by the press.",
        verdict: 'supported',
        status: 'resolved',
        userAction: 'engaged',
        evidenceChunkIndexes: [0],
      },
      {
        engineType: 'socratic',
        promptTemplateTag: 'Provocation',
        promptText: null,
        responseText:
          'QUESTION: If credibility came from licensing institutions rather than the press, does that weaken or strengthen the claim that print itself caused the Scientific Revolution?',
        status: 'faded',
        userAction: 'ignored',
      },
      {
        engineType: 'interceptor',
        promptTemplateTag: 'The Spark Gap',
        promptText: 'obviously Eisenstein was totally wrong about everything',
        responseText:
          'QUESTION: Which specific claim of Eisenstein’s does Johns’s evidence on piracy and licensing actually refute?',
        status: 'active',
        userAction: null,
      },
    ],
  },
]

async function main() {
  const user = await db.user.findUnique({ where: { email: DEFAULT_EMAIL } })
  if (!user) {
    throw new Error(`Default user ${DEFAULT_EMAIL} not found — run scripts/seed.js first.`)
  }

  for (const fixture of fixtures) {
    const project = await db.project.findFirst({
      where: { userId: user.id, title: fixture.projectTitle },
    })
    if (!project) {
      console.log(`Skipped (project not found): ${fixture.projectTitle} — run scripts/seed-projects.js first.`)
      continue
    }

    // ── PDF + chunks ──
    let pdf = await db.pdf.findFirst({ where: { projectId: project.id, filename: fixture.pdf.filename } })
    let chunks = []
    if (pdf) {
      console.log(`Skipped (PDF already exists): ${fixture.pdf.filename}`)
      chunks = await db.pdfChunk.findMany({ where: { pdfId: pdf.id }, orderBy: { chunkIndex: 'asc' } })
    } else {
      pdf = await db.pdf.create({
        data: {
          projectId: project.id,
          userId: user.id,
          filename: fixture.pdf.filename,
          rawText: fixture.pdf.rawText,
          sizeBytes: Buffer.byteLength(fixture.pdf.rawText, 'utf8'),
          parseStatus: 'ready',
        },
      })
      chunks = await Promise.all(
        fixture.pdf.chunks.map((c, i) =>
          db.pdfChunk.create({
            data: {
              pdfId: pdf.id,
              chunkIndex: i,
              content: c.content,
              charCount: c.content.length,
              pageApprox: c.pageApprox,
            },
          }),
        ),
      )
      console.log(`Seeded PDF: ${pdf.filename} (${chunks.length} chunks) for "${fixture.projectTitle}"`)
    }

    // ── Interventions (+ evidence for citation ones) ──
    for (const iv of fixture.interventions) {
      const existing = await db.intervention.findFirst({
        where: { projectId: project.id, engineType: iv.engineType, promptTemplateTag: iv.promptTemplateTag },
      })
      if (existing) {
        console.log(`Skipped (intervention already exists): ${iv.engineType} / ${iv.promptTemplateTag}`)
        continue
      }

      const created = await db.intervention.create({
        data: {
          userId: user.id,
          projectId: project.id,
          paragraphId: `p-${iv.engineType}-seed`,
          promptTemplateTag: iv.promptTemplateTag,
          engineType: iv.engineType,
          promptText: iv.promptText ?? null,
          responseText: iv.responseText ?? null,
          verdict: iv.verdict ?? null,
          status: iv.status,
          userAction: iv.userAction ?? null,
          resolvedAt: iv.status === 'resolved' ? new Date() : null,
          evidences: iv.evidenceChunkIndexes
            ? {
                create: iv.evidenceChunkIndexes.map((idx) => ({
                  chunkId: chunks[idx].id,
                  similarityScore: 0.72 + idx * 0.05,
                  citedExcerpt: chunks[idx].content.slice(0, 300),
                })),
              }
            : undefined,
        },
      })
      console.log(`Seeded intervention: ${created.engineType} / ${created.promptTemplateTag} [${created.status}]`)
    }
  }

  console.log('Done seeding PDFs and interventions.')
}

main()
  .catch((e) => {
    console.error('Seeding PDFs/interventions failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
