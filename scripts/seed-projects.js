/**
 * Seeds a few sample projects (with documents) for the default user so
 * there's something to test the writing IDE against.
 *
 * Run inside the container: node scripts/seed-projects.js
 */
const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()

const DEFAULT_EMAIL = 'writer@cogdoc.local'

const projects = [
  {
    title: 'The Ethics of Algorithmic Bias',
    description: 'Essay-in-progress arguing that fairness metrics in ML systems encode contestable political choices.',
    content: `<p>Algorithmic decision-making systems are often described as objective because they replace human judgment with statistical inference. This framing obscures a deeper problem: every fairness metric embeds a political choice about which errors matter more.</p>
<p>Consider the COMPAS recidivism tool. Critics showed it produced higher false-positive rates for Black defendants, while its designers pointed to equal calibration across groups as evidence of fairness. Both claims can be true at once, because</p>`,
  },
  {
    title: 'Climate Policy and Economic Growth',
    description: 'Exploring whether decoupling GDP growth from emissions is empirically supported or aspirational.',
    content: `<p>Proponents of green growth</p>`,
  },
  {
    title: 'Historiography of the Print Revolution',
    description: "A close read of Eisenstein vs. Johns on whether print caused or merely enabled early modern intellectual change.",
    content: `<p>Elizabeth Eisenstein's thesis treats the printing press as a prime mover of the Scientific Revolution, standardizing texts and enabling cumulative knowledge in a way manuscript culture could not. Adrian Johns countered that fixity was not a technical property of print itself but a social accomplishment, fought over and often absent in the early print trade.</p>
<p>The disagreement matters for how we narrate technological change more broadly: does a medium's affordances determine its effects, or do effects emerge only through the institutions that grow up around it?</p>
<p>To adjudicate this, I want to</p>`,
  },
]

async function main() {
  const user = await db.user.findUnique({ where: { email: DEFAULT_EMAIL } })
  if (!user) {
    throw new Error(`Default user ${DEFAULT_EMAIL} not found — run scripts/seed.js first.`)
  }

  for (const p of projects) {
    const existing = await db.project.findFirst({
      where: { userId: user.id, title: p.title },
    })
    if (existing) {
      console.log(`Skipped (already exists): ${p.title}`)
      continue
    }

    const project = await db.project.create({
      data: {
        userId: user.id,
        title: p.title,
        description: p.description,
        document: { create: { content: p.content } },
      },
    })
    console.log(`Seeded project: ${project.title} (${project.id})`)
  }

  console.log('Done seeding sample projects.')
}

main()
  .catch((e) => {
    console.error('Seeding sample projects failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
