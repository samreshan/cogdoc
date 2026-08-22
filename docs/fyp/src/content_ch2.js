// content_ch2.js — Chapter 2: Literature Review.
const {
  h1, h2, body, bodyFlat, bullet, numItem, figure, table, tableTitle, spacer,
} = require("./helpers");

function chapter2() {
  return [
    h1("CHAPTER 2: LITERATURE REVIEW"),

    h2("2.1 Introduction"),
    bodyFlat(
      "This chapter reviews the literature that motivates and grounds the design of Cogdoc. It is organised around five themes: cognitive offloading and automation bias; the limits of large language models; desirable difficulties and the emerging idea of frictional AI; the older tradition of intelligence amplification; and a comparative review of existing writing tools. The chapter ends with a gap analysis and a statement of the theoretical framework adopted by the project."
    ),

    h2("2.2 Cognitive Offloading and Automation Bias"),
    bodyFlat(
      "Cognitive offloading is the use of an external tool or action to reduce the internal cognitive demand of a task. Risko and Gilbert (2016) provide the now-standard definition and argue that offloading is not inherently bad \u2014 humans have always used tools such as writing and diaries to extend memory. The concern arises when offloading is applied to the very processes that build skill. If the cognitive work is outsourced, the skill that the work would have exercised can weaken."
    ),
    body(
      "A rapidly growing set of empirical studies applies this concern to generative AI. Gerlich (2025), in a study of 666 participants, found a negative correlation between the frequency of AI tool use and measured critical-thinking scores, with cognitive offloading acting as a mediating factor and the effect being strongest among younger users. Lee et al. (2025) surveyed knowledge workers and reported that higher self-reported confidence in generative AI was associated with less critical-thinking effort. Stadler et al. (2024) found that large language models can reduce cognitive load while compromising the depth of a person\u2019s reasoning. Kosmyna et al. (2025), using electroencephalography (brain-wave) monitoring of essay writers, reported accumulated \u201ccognitive debt\u201d among those who relied on ChatGPT, with weaker brain activity and weaker ownership of the resulting text over repeated sessions."
    ),
    body(
      "A related concept is automation bias: the tendency to over-trust automated output and to stop applying independent judgement. Together these findings describe a clear pattern. The more a writer offloads thinking to an AI, the less cognitive engagement remains, and the harder it becomes to notice when the AI is wrong. The project\u2019s own survey, summarised in Chapter 4, mirrors this pattern in a small local sample."
    ),

    h2("2.3 The Limits of Large Language Models"),
    bodyFlat(
      "A second strand of literature concerns what large language models (LLMs) actually are, and therefore what they can and cannot be trusted to do. Bender, Gebru and colleagues (2021), in the widely cited \u201cstochastic parrots\u201d critique, argue that large language models produce fluent, plausible language without grounded understanding: they predict likely next words based on statistical patterns in their training data, but they do not possess knowledge in the human sense. The practical consequence is hallucination \u2014 the confident assertion of statements that are false or fabricated."
    ),
    body(
      "This matters for a writing tool in two ways. First, it means an AI that generates prose for a student is generating prose that may be subtly or overtly wrong, and the student is poorly placed to detect it because they did not do the reasoning. Second, it means that any factual verification must be grounded in real evidence rather than in the model\u2019s own fluency. This motivates Cogdoc\u2019s Citation Sentinel engine, which retrieves passages from the writer\u2019s own uploaded library and classifies a verdict against that evidence, with a guard that forces an \u201cinsufficient evidence\u201d result when the grounding is weak."
    ),

    h2("2.4 Desirable Difficulties and Frictional AI"),
    bodyFlat(
      "If cognitive offloading is the disease, the literature also points to a cure rooted in learning science. Bjork (1994) introduced the concept of desirable difficulties: the finding that intentional, well-placed inefficiency in a learning task \u2014 spacing, testing, interleaving \u2014 improves long-term retention and the transfer of knowledge, even when it makes the task feel harder in the short term. The principle is that some friction is productive."
    ),
    body(
      "Cabitza and Natali (2024) and related work on frictional AI translate this idea into interaction design. They argue that rather than always minimising friction, AI systems should sometimes introduce it deliberately, in order to keep the human cognitively engaged and to prevent deskilling. This is the direct theoretical basis for Cogdoc\u2019s central design principle, which the project calls productive friction: the AI deliberately slows the writer down at the right moments \u2014 to question a vague claim, to challenge an assumption, to demand evidence \u2014 so that the AI support increases cognition rather than bypassing it. The novelty claimed by the project is not the existence of the idea but its operationalisation: a concrete, user-controllable, three-mode friction calibration backed by a hard non-generation invariant."
    ),

    h2("2.5 Intelligence Amplification"),
    bodyFlat(
      "Cogdoc also sits within a much older and more optimistic tradition. Bush (1945), in \u201cAs We May Think\u201d, imagined a machine (the \u201cmemex\u201d) that would help a thinker organise and connect the records of their reading. Engelbart (1962), in \u201cAugmenting Human Intellect\u201d, framed computing as a way to amplify human intellectual capacity rather than replace it. In this lineage the artefact exists to augment the thinker. Cogdoc adopts this framing explicitly: the AI is a reflective and adversarial layer around the human author, not an author itself. The final text is always written by the learner, because producing the text is the learning."
    ),

    h2("2.6 Review of Existing Systems"),
    bodyFlat(
      "A survey of widely used writing tools shows that none of them is built around productive friction. Table 2.1 summarises the comparison. The dominant design goal across these tools is to make writing faster and more fluent, which is precisely the property the literature links to cognitive offloading."
    ),
    tableTitle("Table 2.1: Comparative analysis of existing writing tools"),
    table(
      ["Tool", "Primary goal", "Generates prose for user?", "Verifies claims against user\u2019s sources?", "User-controllable friction?"],
      [
        ["ChatGPT (OpenAI)", "Generate and rewrite text", "Yes \u2014 paragraph length", "No (general knowledge)", "No"],
        ["Gemini (Google)", "Generate, summarise, rewrite", "Yes \u2014 paragraph length", "No", "No"],
        ["Grammarly", "Correct grammar and style", "Yes (rewrites)", "No", "Limited (tone presets)"],
        ["Elicit", "Literature search and summary", "Yes (summaries)", "Partial (its own corpus)", "No"],
        ["Google Docs", "Word processing", "No (text editor)", "No", "No"],
        ["Cogdoc (this project)", "Increase critical engagement", "No \u2014 structurally blocked", "Yes (user\u2019s own library)", "Yes \u2014 three modes"],
      ],
      [16, 22, 22, 22, 18]
    ),
    spacer(),

    h2("2.7 Gap Analysis"),
    bodyFlat(
      "Three gaps emerge from the literature and the review of existing tools. First, although the cognitive-offloading literature is well established, very few working tools translate the remedy (frictional AI) into a usable product; the idea lives mostly in research papers. Second, existing tools that touch verification (such as Elicit) verify against their own corpus rather than the writer\u2019s own uploaded sources, and they offer no guarantee of behaviour when evidence is absent. Third, no reviewed tool gives the user control over how much friction they experience, which the project\u2019s survey (Chapter 4) shows is essential for adoption under deadline pressure. Cogdoc is positioned to address all three gaps."
    ),

    h2("2.8 Theoretical Framework"),
    bodyFlat(
      "The project adopts a combined framework. Its diagnosis rests on the cognitive-offloading and automation-bias literature (Risko & Gilbert, 2016; Gerlich, 2025; Lee et al., 2025; Stadler et al., 2024; Kosmyna et al., 2025). Its design remedy rests on desirable difficulties (Bjork, 1994) and frictional AI (Cabitza & Natali, 2024). Its stance toward the AI itself rests on the stochastic-parrots critique (Bender et al., 2021), which forces the design to ground every factual claim in retrieved evidence. Its overall philosophy rests on intelligence amplification (Bush, 1945; Engelbart, 1962). Cogdoc is, in short, an attempt to build the frictional-AI response that the literature calls for, and to measure whether it works."
    ),

    h2("2.9 Summary"),
    bodyFlat(
      "The literature is consistent: generative-AI writing tools enable cognitive offloading, and heavy offloading is associated with weaker critical thinking and an illusion of mastery. The remedy proposed by learning science and frictional-AI research is to introduce productive friction. Yet existing tools optimise for the opposite, and none offers user-controllable friction grounded in the writer\u2019s own sources. This gap defines the design space for Cogdoc and motivates the requirements developed in Chapter 4."
    ),
  ];
}

module.exports = { chapter2 };
