"""Ground-truth evaluation set v2 — REAL corpus (S1, PRODUCT.md §14.3).

The passages are the verbatim 28 chunks of the 5 real PDFs in the research
library (exported from the production pgvector store), including the realistic
junk a real corpus contains (MDPI page furniture, licence boilerplate, view
counters) — retrieval has to rank past it, exactly as in production.

The 50 claims are hand-labeled against the passage texts:
  - supported            (20): asserted by the passages, mostly written as
                               paraphrases with low lexical overlap so
                               semantic retrieval is actually exercised
  - partially_supported  (10): the right direction, but overstated or with
                               unsupported specifics (causation, "always",
                               intent, "proves")
  - unsupported          (10): directly contradicted by a passage
  - insufficient_evidence(10): off-corpus, including topic-adjacent hard
                               negatives (Gutenberg, recidivism in Norway,
                               working-memory training)

relevant_ids: for supported/partial claims, the chunks that ground the claim;
for unsupported claims, the chunks that CONTRADICT it (the evidence the
Sentinel should surface); empty for insufficient_evidence.

Corpus documents:
  Gerlich 2025, "AI Tools in Society" (MDPI Societies)     — 19 chunks G0–G18
  Gerlich 2025 abstract-only excerpt                        — 1 chunk  M0
  Angwin et al. 2016, "Machine Bias" (ProPublica)           — 3 chunks A0–A2
  Hickel & Kallis 2019, "Is Green Growth Possible?"         — 2 chunks H0–H1
  Johns 1998, "The Nature of the Book" (excerpt)            — 3 chunks J0–J2
"""
from __future__ import annotations

# ── Stable chunk ids (verbatim production PdfChunk cuids) ──────────────────
G = [  # Gerlich 2025 full paper, chunkIndex 0..18
    "cmr26zuk8004arl89iryrx7jg",  # G0  page furniture / nav junk
    "cmr26zuk8004brl89y6oduh8e",  # G1  MDPI licence boilerplate
    "cmr26zuk8004crl89egd2a5nb",  # G2  view counts / TOC junk
    "cmr26zuk8004drl89sy9smj5y",  # G3  abstract: neg. correlation, 666 participants, age & education effects
    "cmr26zuk8004erl890urjxx3v",  # G4  intro: critical thinking definition, offloading concern
    "cmr26zuk8004frl89ojfg8xp7",  # G5  Risko&Gilbert offloading, Sparrow search engines, education pros/cons
    "cmr26zuk8004grl890t527zdk",  # G6  hypotheses; Ennis/Paul&Elder/Halpern definitions
    "cmr26zuk8004hrl89aq06sos0",  # G7  offloading mechanisms; NOT inherently less engagement; trust→offloading
    "cmr26zuk8004irl897a2iczkj",  # G8  tiny section header
    "cmr26zuk8004jrl89rb0nt6af",  # G9  Google effect / transactive memory; notification fragmentation
    "cmr26zuk8004krl89hli8opca",  # G10 Sweller cognitive load theory; dependence; black-box problem
    "cmr26zuk8004lrl89zs73hp26",  # G11 analysis/evaluation/inference; echo chambers, algorithmic bias
    "cmr26zuk8004mrl89bvbr0ycw",  # G12 tiny section header
    "cmr26zuk8004nrl898gnajbx7",  # G13 cognitive laziness; skill erosion; loss of autonomy
    "cmr26zuk8004orl89ktqm8ipd",  # G14 Zhai; Krullaars — reduced problem-solving
    "cmr26zuk8004prl8913g4ldcd",  # G15 adaptive platforms; ITS in STEM; Perelman formulaic writing
    "cmr26zuk8004qrl89xdhiwqfj",  # G16 HCTA: 25 MC + 25 constructed-response
    "cmr26zuk8004rrl89kxrb0djq",  # G17 Terenzini self-reported measures; mixed-method design
    "cmr26zuk8004srl89bswoh96i",  # G18 669/666 UK participants; survey instrument
]
M0 = "cmr07goiw000bm7dtv0p1v7xp"  # Gerlich abstract-only excerpt
A0 = "cmrfxowlt0003qyd21n2bb9dy"  # COMPAS unreliable; racial error asymmetry
A1 = "cmrfxoxkf0007qyd2wyhkmryk"  # Northpointe: equal calibration defence
A2 = "cmrfxoxkf0006qyd2m2pnhxof"  # Kleinberg impossibility result
H0 = "cmrfxp0xb000nqyd2jtkz781e"  # no absolute decoupling at Paris rates
H1 = "cmrfxp0xc000oqyd2z8qjfjvv"  # relative decoupling via outsourcing
J0 = "cmrfxp2tr0012qyd2ebt4kt4j"  # fixity a social accomplishment
J1 = "cmrfxp2tr0014qyd224mk2tww"  # piracy/misattribution endemic
J2 = "cmrfxp2ts0015qyd260kqurka"  # credibility depended on institutions

VERDICT_LABELS = ["supported", "partially_supported", "unsupported", "insufficient_evidence"]

# ── Labeled claims ─────────────────────────────────────────────────────────
CLAIMS = [
    # ---- supported (20) --------------------------------------------------
    {"claim": "Frequent use of AI tools goes hand in hand with weaker critical thinking ability.",
     "expected_verdict": "supported", "relevant_ids": {G[3], M0}},
    {"claim": "Younger people lean on AI assistants more heavily and score worse on critical thinking than their elders.",
     "expected_verdict": "supported", "relevant_ids": {G[3]}},
    {"claim": "People with more schooling show stronger reasoning skills no matter how much AI they use.",
     "expected_verdict": "supported", "relevant_ids": {G[3]}},
    {"claim": "Gerlich's study collected both questionnaires and in-depth interviews from more than six hundred people.",
     "expected_verdict": "supported", "relevant_ids": {G[3], G[18]}},
    {"claim": "Handing mental work to external aids can wither the very skills that work would have exercised.",
     "expected_verdict": "supported", "relevant_ids": {G[7], G[13]}},
    {"claim": "People tend to remember where information lives rather than the information itself.",
     "expected_verdict": "supported", "relevant_ids": {G[9]}},
    {"claim": "Constant pings from smart devices splinter concentration and hurt performance on demanding work.",
     "expected_verdict": "supported", "relevant_ids": {G[9]}},
    {"claim": "Recommendation algorithms can wall users into bubbles that echo what they already think.",
     "expected_verdict": "supported", "relevant_ids": {G[11]}},
    {"claim": "Human working memory can only hold a limited amount at once, which constrains learning.",
     "expected_verdict": "supported", "relevant_ids": {G[10]}},
    {"claim": "Automated essay graders have been accused of rewarding formulaic prose over original thought.",
     "expected_verdict": "supported", "relevant_ids": {G[15]}},
    {"claim": "One-on-one AI tutoring software has boosted results in science and maths subjects.",
     "expected_verdict": "supported", "relevant_ids": {G[15]}},
    {"claim": "Halpern's critical-thinking test mixes multiple-choice questions with open-ended exercises.",
     "expected_verdict": "supported", "relevant_ids": {G[16]}},
    {"claim": "Terenzini gauges critical-thinking growth through students' own reflections instead of standardised testing.",
     "expected_verdict": "supported", "relevant_ids": {G[17]}},
    {"claim": "The more someone trusts an AI system, the more thinking they tend to offload onto it.",
     "expected_verdict": "supported", "relevant_ids": {G[7], M0}},
    {"claim": "The recidivism score flagged black defendants as riskier than their actual reoffending justified.",
     "expected_verdict": "supported", "relevant_ids": {A0}},
    {"claim": "Only one in five people the algorithm predicted would commit violent crimes actually did.",
     "expected_verdict": "supported", "relevant_ids": {A0}},
    {"claim": "When base rates differ, no risk score can satisfy equal calibration and equal false-positive rates at once.",
     "expected_verdict": "supported", "relevant_ids": {A2}},
    {"claim": "Wealthy countries' claimed emission cuts largely reflect shifting dirty industry abroad.",
     "expected_verdict": "supported", "relevant_ids": {H1}},
    {"claim": "The stability of printed texts was won through social and commercial effort, not given by the press itself.",
     "expected_verdict": "supported", "relevant_ids": {J0, J2}},
    {"claim": "Early printed books were riddled with piracy and false attribution.",
     "expected_verdict": "supported", "relevant_ids": {J1}},
    # ---- partially_supported (10) ---------------------------------------
    {"claim": "AI tool use causes an irreversible decline in critical thinking across every age group.",
     "expected_verdict": "partially_supported", "relevant_ids": {G[3]}},
    {"claim": "Search engines have destroyed people's ability to remember anything on their own.",
     "expected_verdict": "partially_supported", "relevant_ids": {G[9]}},
    {"claim": "Adaptive learning platforms guarantee better outcomes for every student.",
     "expected_verdict": "partially_supported", "relevant_ids": {G[15]}},
    {"claim": "Decision-support AI in hospitals has eliminated the need for doctors to think critically.",
     "expected_verdict": "partially_supported", "relevant_ids": {G[5]}},
    {"claim": "COMPAS was biased because its designers intended to discriminate against black defendants.",
     "expected_verdict": "partially_supported", "relevant_ids": {A0}},
    {"claim": "Green growth is impossible under any conceivable policy scenario.",
     "expected_verdict": "partially_supported", "relevant_ids": {H0}},
    {"claim": "Piracy in the early book trade meant no printed text could ever be trusted at all.",
     "expected_verdict": "partially_supported", "relevant_ids": {J1}},
    {"claim": "Gerlich's survey of 666 UK participants proves that using AI lowers intelligence.",
     "expected_verdict": "partially_supported", "relevant_ids": {G[18], G[3]}},
    {"claim": "AI-curated news feeds always improve the quality of information people consume.",
     "expected_verdict": "partially_supported", "relevant_ids": {G[11]}},
    {"claim": "Offloading memory to digital tools frees up mental capacity and therefore always improves thinking.",
     "expected_verdict": "partially_supported", "relevant_ids": {G[7]}},
    # ---- unsupported (10) — contradicted by the corpus -------------------
    {"claim": "Cognitive offloading inherently reduces engagement with the task at hand.",
     "expected_verdict": "unsupported", "relevant_ids": {G[7]}},
    {"claim": "The Gerlich study found no relationship between AI tool usage and critical thinking.",
     "expected_verdict": "unsupported", "relevant_ids": {G[3]}},
    {"claim": "Older participants were more dependent on AI tools than younger ones.",
     "expected_verdict": "unsupported", "relevant_ids": {G[3]}},
    {"claim": "The COMPAS score predicted violent crime with high accuracy.",
     "expected_verdict": "unsupported", "relevant_ids": {A0}},
    {"claim": "Northpointe conceded that its tool was poorly calibrated for black defendants.",
     "expected_verdict": "unsupported", "relevant_ids": {A1}},
    {"claim": "A well-designed risk score can always achieve equal calibration and equal false-positive rates across groups.",
     "expected_verdict": "unsupported", "relevant_ids": {A2}},
    {"claim": "Rich economies have achieved absolute decoupling fast enough to meet the Paris targets.",
     "expected_verdict": "unsupported", "relevant_ids": {H0}},
    {"claim": "The decoupling achieved so far reflects genuine domestic efficiency gains rather than offshoring.",
     "expected_verdict": "unsupported", "relevant_ids": {H1}},
    {"claim": "Fixity was an inherent technical property of the printing press.",
     "expected_verdict": "unsupported", "relevant_ids": {J0}},
    {"claim": "Printed books were immediately trusted as stable and authoritative from the moment printing arrived.",
     "expected_verdict": "unsupported", "relevant_ids": {J1, J2}},
    # ---- insufficient_evidence (10) — off-corpus, incl. hard negatives ---
    {"claim": "The mitochondria is the powerhouse of the cell.",
     "expected_verdict": "insufficient_evidence", "relevant_ids": set()},
    {"claim": "Bitcoin's proof-of-work consensus consumes more electricity than Argentina.",
     "expected_verdict": "insufficient_evidence", "relevant_ids": set()},
    {"claim": "The Treaty of Westphalia established the principle of state sovereignty in 1648.",
     "expected_verdict": "insufficient_evidence", "relevant_ids": set()},
    {"claim": "Transformer language models use self-attention to weigh relationships between tokens.",
     "expected_verdict": "insufficient_evidence", "relevant_ids": set()},
    {"claim": "Spaced repetition improves long-term vocabulary retention in second-language learners.",
     "expected_verdict": "insufficient_evidence", "relevant_ids": set()},
    {"claim": "The Great Barrier Reef has lost half of its coral cover since 1995.",
     "expected_verdict": "insufficient_evidence", "relevant_ids": set()},
    {"claim": "Gutenberg printed his forty-two-line Bible around 1455.",
     "expected_verdict": "insufficient_evidence", "relevant_ids": set()},
    {"claim": "Working-memory training games raise IQ scores in healthy adults.",
     "expected_verdict": "insufficient_evidence", "relevant_ids": set()},
    {"claim": "Norway has one of the lowest criminal reoffending rates in the world.",
     "expected_verdict": "insufficient_evidence", "relevant_ids": set()},
    {"claim": "Photosynthesis converts carbon dioxide and water into glucose using light energy.",
     "expected_verdict": "insufficient_evidence", "relevant_ids": set()},
]
SOURCE_PASSAGES = [
    {
        "chunk_id": "cmr26zuk8004arl89iryrx7jg",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking\n\n    Loading [MathJax]/jax/output/HTML-CSS/fonts/Gyre-Pagella/fontdata.js\n\n\t\t\t\t\t\t\t\t\tNext Article in Journal\n\n\t\t\t\tInclusion and Well-Being Among National and Immigrant University Students in Portugal: Avenues for Participatory Research\n\n\t\t\t\t\t\t\t\t\tPrevious Article in Journal\n\n\t\t\t\tMeasuring Destination Image Using AI and Big Data: Kastoria’s Image on TripAdvisor\n\n                            Journals\n\n                            Active Journals\n                            Find a Journal\n                            Journal Proposal\n                            Proceedings Series\n\n                Topics\n\n                            Information\n\n                            For Authors\n                            For Reviewers\n                            For Editors\n                            For Librarians\n                            For Publishers\n                            For Societies\n                            For Conference Organizers\n\n                            Open Access Policy\n                            Institutional Open Access Program\n                            Special Issues Guidelines\n                            Editorial Process\n                            Research and Publication Ethics\n                            Article Processing Charges\n                            Awards\n                            Testimonials\n\n                Author Services\n\n                            Initiatives\n\n                            Sciforum\n                            MDPI Books\n                            Preprints.org\n                            Scilit\n                            SciProfiles\n                            Encyclopedia\n                            JAMS\n                            Proceedings Series\n\n                            About\n\n                            Overview\n                            Contact\n                            Careers\n                            News\n                            Press\n                            Blog\n\n                            Sign In / Sign Up\n\n    Notice\n\n                You can make submissions to other journals \n                here.\n\n        clear\n\n            Notice\n\n                You are accessing a machine-readable page. In order to be human-readable, please install an RSS reader.\n\n            Continue\n            Cancel\n\n        clear"
    },
    {
        "chunk_id": "cmr26zuk8004brl89y6oduh8e",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "All articles published by MDPI are made immediately available worldwide under an open access license. No special \n        permission is required to reuse all or part of the article published by MDPI, including figures and tables. For \n        articles published under an open access Creative Common CC BY license, any part of the article may be reused without \n        permission provided that the original article is clearly cited. For more information, please refer to\n        https://www.mdpi.com/openaccess.\n\n        Feature papers represent the most advanced research with significant potential for high impact in the field. A Feature \n        Paper should be a substantial original Article that involves several techniques or approaches, provides an outlook for \n        future research directions and describes possible research applications.\n\n        Feature papers are submitted upon individual invitation or recommendation by the scientific editors and must receive \n        positive feedback from the reviewers.\n\n        Editor’s Choice articles are based on recommendations by the scientific editors of MDPI journals from around the world. \n        Editors select a small number of articles recently published in the journal that they believe will be particularly \n        interesting to readers, or important in the respective research area. The aim is to provide a snapshot of some of the \n        most exciting work published in the various research areas of the journal.\n\n        Original Submission Date Received: .\n\n                        You seem to have javascript disabled. Please note that many of the page functionalities won't work as expected without javascript enabled.\n\n                Submit to this Journal\n\n                    Review for this Journal\n\n                    Propose a Special Issue\n\n                ►\n                ▼\n                Article Menu\n\n                Article Menu\n\n                        Academic Editor\n\n                                                Lisa Jean Moore\n\n                                                Recommended Articles\n\n                                        Related Info Link\n\n                                Google Scholar\n\n                                        More by Author Links\n\n                                on DOAJ\n\n            Gerlich, M.\n\n                                on Google Scholar\n\n            Gerlich, M.\n\n                                on PubMed\n\n            Gerlich, M."
    },
    {
        "chunk_id": "cmr26zuk8004crl89egd2a5nb",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "Article Views\n                                757604\n\n                                Citations\n                                576\n\n                        Table of Contents\n\nAbstract\n\nIntroduction\n\nLiterature Review\n\nMaterials and Methods\n\nResults\n\nDiscussion\n\nConclusions\n\nFunding\n\nInstitutional Review Board Statement\n\nInformed Consent Statement\n\nData Availability Statement\n\nConflicts of Interest\n\nAppendix A\n\nReferences\n\n        Altmetric\n\n        share\n        Share\n\n        announcement\n        Help\n\n        format_quote\n        Cite\n\n            question_answer\n            Discuss in SciProfiles\n\n                    Need Help?\n\n                    Support\n\n                        Find support for a specific problem in the support section of our website.\n\n                        Get Support\n\n                    Feedback\n\n                        Please let us know what you think of our products and services.\n\n                        Give Feedback\n\n                    Information\n\n                        Visit our dedicated information section to learn more about MDPI.\n\n                        Get Information\n\n                clear\n\n        JSmol Viewer\n\n            clear\n\n    Correction published on 10 September 2025, see \n    Societies 2025, 15(9), 252.\n\n            first_page\n\n                Download PDF\n\n            settings\n\n            Order Article Reprints\n\n                        Font Type:\n\n                        Arial\n                        Georgia\n                                                Verdana\n\n                    Font Size:\n\n                                                    Aa\n                                                    Aa\n                                                    Aa\n\n                    Line Spacing:\n\n                                \n\n                                \n\n                                \n\n                    Column Width:\n\n                                \n\n                                \n\n                                \n\n                    Background:\n\n            Open AccessArticle\n\n                AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking            \n\n                                by\n\n    Michael Gerlich\n\nMichael Gerlich\n\n                SciProfiles\n\n            Scilit\n\n            Preprints.org\n\n            Google Scholar"
    },
    {
        "chunk_id": "cmr26zuk8004drl89sy9smj5y",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "Center for Strategic Corporate Foresight and Sustainability, SBS Swiss Business School, 8302 Kloten-Zurich, Switzerland\n\n                Societies 2025, 15(1), 6; https://doi.org/10.3390/soc15010006\n\n    Submission received: 14 October 2024\n    /\n    Revised: 18 December 2024\n    /\n    Accepted: 29 December 2024\n    /\n    Published: 3 January 2025\n    /\n    Corrected: 10 September 2025\n\n                Download keyboard_arrow_down\n\n                Download PDF\n\n                                                        Download PDF with Cover\n\n                                                        Download XML\n\n                                    Download Epub\n\n                Browse Figures\n\n                    Versions Notes\n\n            Abstract\n\n            The proliferation of artificial intelligence (AI) tools has transformed numerous aspects of daily life, yet its impact on critical thinking remains underexplored. This study investigates the relationship between AI tool usage and critical thinking skills, focusing on cognitive offloading as a mediating factor. Utilising a mixed-method approach, we conducted surveys and in-depth interviews with 666 participants across diverse age groups and educational backgrounds. Quantitative data were analysed using ANOVA and correlation analysis, while qualitative insights were obtained through thematic analysis of interview transcripts. The findings revealed a significant negative correlation between frequent AI tool usage and critical thinking abilities, mediated by increased cognitive offloading. Younger participants exhibited higher dependence on AI tools and lower critical thinking scores compared to older participants. Furthermore, higher educational attainment was associated with better critical thinking skills, regardless of AI usage. These results highlight the potential cognitive costs of AI tool reliance, emphasising the need for educational strategies that promote critical engagement with AI technologies. This study contributes to the growing discourse on AI’s cognitive implications, offering practical recommendations for mitigating its adverse effects on critical thinking. The findings underscore the importance of fostering critical thinking in an AI-driven world, making this research essential reading for educators, policymakers, and technologists.\n\n        Keywords:"
    },
    {
        "chunk_id": "cmr26zuk8004erl890urjxx3v",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "AI; artificial intelligence; critical thinking; cognitive offloading; AI tools; technology and education; cognitive development; Halpern Critical Thinking Assessment; digital dependence; AI trust\n\n      1. Introduction\n\nThe advent of artificial intelligence (AI) has revolutionised various aspects of modern life, from healthcare and finance to entertainment and education. AI tools, encompassing everything from virtual assistants and recommendation algorithms to complex decision-support systems, have become integral to daily functioning, promising enhanced efficiency, personalised experiences, and unprecedented access to information. However, alongside these benefits, there is growing concern about the potential cognitive and social impacts of AI on human users, particularly regarding critical thinking skills.\n\nCritical thinking, defined as the ability to analyse, evaluate, and synthesise information to make reasoned decisions, is a fundamental cognitive skill essential for academic success, professional competence, and informed citizenship [1]. It involves various cognitive processes, including problem-solving, decision-making, and reflective thinking, which are crucial for navigating complex and dynamic environments. The increasing reliance on AI tools for information retrieval and decision-making raises questions about how these technologies influence users’ critical thinking abilities. The dual-edged nature of AI in cognitive development has been a focal point in recent research. AI tools can enhance learning outcomes by providing personalised instruction and immediate feedback, thus supporting skill acquisition and knowledge retention [2,3]. However, growing evidence shows that over-reliance on these tools can lead to cognitive offloading. Cognitive offloading occurs when individuals delegate cognitive tasks to external aids, reducing their engagement in deep, reflective thinking [4,5]. This phenomenon is particularly concerning in the context of critical thinking, which requires active cognitive engagement to analyse and evaluate information effectively."
    },
    {
        "chunk_id": "cmr26zuk8004frl89ojfg8xp7",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "Cognitive offloading, as described by Risko and Gilbert [6], involves using external tools to reduce the cognitive load on an individual’s working memory. While this can free up cognitive resources, it may also lead to a decline in cognitive engagement and skill development. The pervasive availability of AI tools, which offer quick solutions and ready-made information, can discourage users from engaging in the cognitive processes essential for critical thinking. For example, Sparrow et al. [5] demonstrated that the availability of information through search engines can affect memory retention and the inclination to process information deeply.\n\nIn educational settings, integrating AI tools has shown promising results and potential drawbacks. Adaptive learning platforms and intelligent tutoring systems have been praised for their ability to tailor educational experiences to individual student needs, thereby enhancing learning outcomes [2,3]. Other studies did not observe any significant impact of AI in education [7]. However, there is also concern that such tools might reduce students’ engagement in critical thinking activities, as they might become accustomed to the ease and convenience of AI-provided solutions [8,9]. The potential negative impact of AI on critical thinking extends beyond educational contexts. In professional and everyday scenarios, the use of AI tools for decision-making and problem-solving can influence cognitive processes. For instance, automated decision-support systems in healthcare and finance streamline operations and improve efficiency, but might also reduce the need for professionals to engage in independent critical analysis [10]. This could result in a workforce that is highly efficient, yet potentially less capable of independent problem-solving and critical evaluation.\n\nGiven these concerns, this study sought to explore the impact of AI tool usage on critical thinking skills with a particular focus on cognitive offloading as a mediating variable. This research aimed to provide a comprehensive understanding of the broader cognitive implications of AI tool usage by investigating how AI tools influence cognitive processes and the extent to which they encourage cognitive offloading.\n\nThe research questions guiding this study were:\n\nRQ1: How does the usage of AI tools impact critical thinking skills?\n\nRQ2: What is the mediating role of cognitive offloading in the relationship between AI tool usage and critical thinking?"
    },
    {
        "chunk_id": "cmr26zuk8004grl890t527zdk",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "Based on the research questions outlined above, we propose the following hypotheses:\n\nHypothesis 1: Higher AI tool usage is associated with reduced critical thinking skills.\n\nHypothesis 2: Cognitive offloading mediates the relationship between AI tool usage and critical thinking skills.\n\nThis study aimed to shed light on the broader cognitive implications of AI tool usage and provide actionable recommendations for mitigating potential negative impacts on critical thinking. Understanding these dynamics, stakeholders can develop strategies to balance the benefits of AI with the need to maintain and enhance critical thinking skills. This research contributes to the growing body of literature on AI and cognition, offering insights that can inform educational practices, policy decisions, and the design of AI technologies.\n\n  2. Literature Review\n\n  2.1. Theoretical Foundations of Critical Thinking and Cognitive Offloading\n\nCritical thinking is a multifaceted cognitive process that involves the capacity to think clearly and rationally, understand logical connections between ideas, evaluate arguments, and identify inconsistencies in reasoning. This process is crucial for effective problem-solving, informed decision-making, and the acquisition of knowledge. Ennis [11] defines critical thinking as “reasonable reflective thinking focused on deciding what to believe or do”, highlighting its evaluative nature. Paul and Elder [12] describe it as the art of analysing and improving thinking, focusing on intellectual standards such as clarity, accuracy, and logic. Halpern [13] emphasises the practical application of critical thinking skills across different contexts, underscoring its real-world utility. Critical thinking is integral to cognitive development, enabling individuals to process information more effectively and engage in reflective thought. It enhances academic performance, problem-solving abilities, and informed decision-making [14]. Students with strong critical thinking skills tend to perform better academically, as they can understand complex concepts, analyse texts, and construct well-reasoned arguments [15]. Furthermore, critical thinkers are better equipped to solve problems systematically, evaluate evidence, and consider alternative solutions [16]. They are also less susceptible to manipulation by misleading information or cognitive biases, making them more discerning consumers of information [17]."
    },
    {
        "chunk_id": "cmr26zuk8004hrl89aq06sos0",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "Cognitive offloading refers to the externalisation of cognitive processes, often involving tools or external agents, such as notes, calculators, or digital tools like AI, to reduce cognitive load [6]. While cognitive offloading can improve efficiency by freeing up cognitive resources, it does not inherently imply a reduction in task engagement. In some cases, however, extensive reliance on external tools—particularly AI—may reduce the need for deep cognitive involvement, potentially affecting critical thinking. The mechanisms of offloading include external memory aids, digital tools, and social networks, which help individuals manage tasks and information without overwhelming their working memory. Digital tools, particularly AI-powered applications, can perform tasks such as calculations, data retrieval, and decision-making, thereby freeing up cognitive resources for more complex thinking. Social offloading involves delegating tasks to others or seeking advice and information from social networks, reducing the cognitive burden on the individual [15]. While cognitive offloading can enhance efficiency and reduce mental strain, it also affects cognitive development and critical thinking. Excessive reliance on external aids may lead to a decline in internal cognitive abilities, such as memory retention and critical analysis skills. This phenomenon raises concerns about the long-term cognitive effects of pervasive technology use. On the one hand, cognitive offloading can be seen as a beneficial strategy for managing cognitive load and enhancing productivity. On the other hand, it may undermine the development and maintenance of critical cognitive skills, particularly if individuals become overly dependent on external tools [5].\n\nCognitive offloading, particularly in the context of AI usage, has seen significant academic interest in recent years. Recent studies, such as those by Gerlich [7] show that the use of AI in educational settings does not always result in improved cognitive or communication skills, particularly in students who already demonstrate well-developed abilities. Furthermore, Gerlich [7] highlights how increased trust in AI tools can result in greater cognitive offloading, which in turn reduces engagement in critical thinking. These findings resonate with the earlier work of Sparrow et al. [5], but more recent research emphasises that the relationship between AI and cognitive offloading is multifaceted, with trust playing a key role [18]."
    },
    {
        "chunk_id": "cmr26zuk8004irl897a2iczkj",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "2.2. AI Tools and Cognitive Processes"
    },
    {
        "chunk_id": "cmr26zuk8004jrl89rb0nt6af",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "AI tools have become pervasive in modern life, offering capabilities that significantly impact cognitive processes such as memory, attention, and problem-solving. The integration of AI into daily activities presents both opportunities and challenges for cognitive development. One of the most notable impacts of AI on cognitive functions is related to memory. AI tools like virtual assistants, search engines, and recommendation systems facilitate information retrieval, potentially altering how individuals store and recall knowledge. Sparrow, Liu, and Wegner [5] introduced the concept of the ‘Google effect’, suggesting that the availability of information at our fingertips reduces the need for internal memory retention. This phenomenon, also known as ‘transactive memory’, implies that people are more likely to remember where to find information rather than the information itself. While this can enhance efficiency and quick access to information, it raises concerns about the potential decline in memory retention capabilities. AI tools also influence attention and focus, two critical aspects of cognitive functioning. On one hand, AI can help manage attention by filtering out irrelevant information and highlighting important content. For example, AI-powered news aggregators and personalised content recommendations can help users focus on relevant information, thereby enhancing cognitive efficiency. However, the constant notifications and updates from AI-driven devices and applications can also fragment attention and reduce the ability to focus on a single task for extended periods. Research by Risko and Gilbert [6] highlights that frequent interruptions and multitasking, often facilitated by AI tools, can impair cognitive performance and decrease the quality of attention. This fragmentation of attention can lead to superficial information processing and reduced engagement with complex tasks, ultimately impacting critical thinking and problem-solving abilities. AI tools are increasingly used to support problem-solving and decision-making processes. Advanced AI systems can analyse large datasets, identify patterns, and provide recommendations, thereby aiding individuals in making informed decisions. This has significant implications for fields such as medicine, finance, and engineering, where AI can enhance decision-making accuracy and efficiency. However, relying on AI for problem-solving and decision-making also raises concerns about cognitive offloading and the potential erosion of independent analytical skills. Jonassen [16] emphasised the importance of problem-solving as a critical cognitive skill, noting that the ability to engage in deep, reflective thinking is essential for effective problem-solving. When AI tools take over these tasks, individuals may become less proficient in developing and applying their own problem-solving strategies, leading to a decline in cognitive flexibility and creativity."
    },
    {
        "chunk_id": "cmr26zuk8004krl89hli8opca",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "The automation of cognitive tasks by AI tools can significantly impact cognitive load and efficiency. Cognitive load theory, developed by Sweller [19], posits that the human cognitive system has limited capacity, and reducing cognitive load can enhance learning and performance. AI tools can automate routine and complex tasks, thereby reducing cognitive load and freeing up cognitive resources for higher-order thinking. AI tools can reduce cognitive load in several ways. For instance, AI-driven personal assistants can handle scheduling, reminders, and information retrieval, allowing individuals to focus on more cognitively demanding tasks. In educational settings, AI-based tutoring systems can adapt to individual learning needs, providing personalised feedback and support, which helps manage cognitive load and enhances learning outcomes [15]. Despite the benefits, AI tools’ automation of cognitive tasks also presents potential downsides. One concern is the risk of cognitive dependence, where individuals become overly reliant on AI tools for routine and complex tasks. This dependence can lead to a decline in cognitive abilities, as individuals may lose the opportunity to practice and develop their own cognitive skills [4]. Additionally, AI tools automating decision-making processes can result in a lack of transparency and understanding. When individuals rely on AI to make decisions, they may not fully understand the underlying processes and criteria used by the AI system. This ‘black box’ problem can reduce critical engagement and accountability, as individuals may blindly trust AI recommendations without questioning or evaluating them [20]. To mitigate the potential downsides of AI-driven automation, balancing automation with cognitive engagement is essential. While AI tools can enhance efficiency and reduce cognitive load, individuals should continue to engage in activities that develop and maintain their cognitive abilities. Educational interventions that promote critical thinking, problem-solving, and independent learning can help individuals build resilience against the potential negative impacts of AI.\n\n  2.3. Impact of AI on Critical Thinking"
    },
    {
        "chunk_id": "cmr26zuk8004lrl89zs73hp26",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "AI tools have transformed various aspects of human life, offering new ways to process information, solve problems, and make decisions. However, their impact on critical thinking skills is complex and multifaceted, affecting various dimensions of critical thinking, including analysis, evaluation, and inference. The analytical dimension of critical thinking involves breaking down complex information into simpler components to understand it better. AI tools such as data analytics software and machine learning algorithms can enhance analytical capabilities by processing vast amounts of data and identifying patterns that might be difficult for humans to detect. For instance, AI-powered data visualisation tools can help users see trends and correlations in large datasets, thereby aiding analytical thinking [21]. However, there is a risk that over-reliance on AI for analysis may undermine the development of human analytical skills. Individuals who depend too heavily on AI to perform analytical tasks may become less proficient at engaging in deep, independent analysis. This reliance can lead to a superficial understanding of information and reduce the capacity for critical analysis. Evaluation involves assessing the credibility and relevance of information, as well as the quality of arguments. AI tools like recommendation systems and automated fact-checking services can assist in evaluating information by filtering out unreliable sources and highlighting high-quality content. For example, AI-driven news aggregators can personalise news feeds based on the credibility of sources, helping users access more reliable information [22]. Despite these benefits, there are concerns that AI tools might inadvertently reinforce biases and limit exposure to diverse perspectives. Algorithms used by AI systems can create echo chambers by recommending content that aligns with users’ existing beliefs, thereby reducing exposure to contrasting viewpoints. This phenomenon, known as algorithmic bias, can hinder critical evaluation by encouraging confirmation bias and reducing critical scrutiny of information [23]. Inference, a core component of critical thinking, involves drawing logical conclusions from available evidence. AI tools such as natural language processing (NLP) and predictive analytics can support inferential reasoning by providing insights and forecasts based on data analysis. These tools can help users make more informed decisions by identifying potential outcomes and suggesting evidence-based conclusions. On the other hand, using AI for inference also raises concerns about the transparency and interpretability of AI-generated conclusions. The opaqueness of AI processes often leads users to accept AI-generated conclusions without scrutiny, risking diminished engagement and reliance on automated inferences."
    },
    {
        "chunk_id": "cmr26zuk8004mrl89bvbr0ycw",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "2.4. Cognitive Offloading in the Context of AI"
    },
    {
        "chunk_id": "cmr26zuk8004nrl898gnajbx7",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "Cognitive offloading through AI tools involves delegating tasks such as memory retention, decision-making, and information retrieval to external systems. This can enhance cognitive capacity by allowing individuals to focus on more complex and creative activities. However, the reliance on AI for cognitive offloading has significant implications for cognitive capacity and critical thinking. While cognitive offloading can free up cognitive resources, there is concern that it may lead to a reduction in cognitive effort, fostering what some researchers refer to as ‘cognitive laziness’ [4]. This condition might diminish the inclination to engage in deep, reflective thinking. The use of AI tools for tasks like memory and decision-making could lead to a decline in individuals’ abilities to perform these tasks independently, potentially reducing cognitive resilience and flexibility over time [5]. The long-term reliance on AI for cognitive offloading could also erode essential cognitive skills such as memory retention, analytical thinking, and problem-solving. As individuals increasingly rely on AI tools, their internal cognitive abilities may atrophy, leading to diminished long-term memory and cognitive health. A study by Sparrow et al. [5] found that frequent use of search engines reduced participants’ likelihood of remembering information independently, with individuals focusing more on remembering where to find information rather than the information itself. Moreover, cognitive offloading through AI tools could lead to a reduction in cognitive engagement. As AI systems automate routine tasks and provide ready-made solutions, individuals may become less inclined to engage in critical thinking and problem-solving. Another study [24] explores how digital tools and the Internet affect various cognitive functions, including attention, memory, and critical thinking, offering insights into the potential downsides of heavy reliance on digital technologies. Long-term reliance on AI tools for cognitive offloading can also lead to dependence and a loss of cognitive autonomy. As individuals become accustomed to using AI for decision-making and problem-solving, they may find it increasingly difficult to operate without these tools. This dependence can reduce cognitive resilience, making individuals more vulnerable to disruptions in technology and less capable of independent thought and action [4]. For example, in professional settings, workers who rely heavily on AI-driven decision-support systems may struggle to make decisions independently when these systems are unavailable, leading to potential performance issues in situations that require quick thinking and problem-solving without technological assistance."
    },
    {
        "chunk_id": "cmr26zuk8004orl89ktqm8ipd",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "Recent studies highlight the growing concern that while AI tools can significantly reduce cognitive load, they may also hinder the development of critical thinking skills. Zhai et al. [25] found that students who heavily relied on AI dialogue systems exhibited diminished decision-making and critical analysis abilities, as these systems allowed them to offload essential cognitive tasks. Similarly, Krullaars et al. [26] reported that over-reliance on AI tools for academic tasks led to reduced problem-solving skills, with students demonstrating lower engagement in independent cognitive processing. These findings underscore the need for a balanced approach to AI integration in educational contexts, ensuring that cognitive offloading does not come at the expense of critical thinking development.\n\n  2.5. Educational Implications and Interventions"
    },
    {
        "chunk_id": "cmr26zuk8004prl8913g4ldcd",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "The integration of AI tools in educational environments is reshaping how teaching and learning processes are conducted. AI-powered platforms, such as adaptive learning technologies and intelligent tutoring systems, offer significant potential to personalise education, enhance student engagement, and assist educators in managing classroom dynamics. For example, adaptive learning platforms use AI to tailor educational content to individual student needs, improving learning outcomes and academic performance [2]. However, the growing reliance on AI tools in education raises concerns about their impact on critical thinking and cognitive development. While AI tools can improve basic skill acquisition, they may not foster the deep analytical thinking required for applying these skills in novel or complex situations [24]. Over-reliance on AI for learning can hinder the development of critical thinking skills, as students become less adept at engaging in independent thought. Intelligent tutoring systems (ITSs), which simulate one-on-one tutoring experiences through AI algorithms, have been shown to improve learning outcomes, particularly in STEM fields [3]. However, these systems may contribute to cognitive offloading, where students rely on the system to guide their learning rather than engaging actively with the material. While ITSs can provide immediate feedback and support, they may also reduce opportunities for students to engage in self-regulated learning and critical thinking [27]. AI tools are also used for automated grading and assessment, providing quick and consistent feedback to students. Automated essay scoring systems like E-rater and Grammarly help students improve their writing by offering instant feedback on grammar, style, and coherence. However, the implications for critical thinking are mixed. While these tools can help students refine their technical skills, they may not foster the deep analytical thinking required for developing arguments and critical evaluation. Perelman [28] criticises these systems for potentially encouraging formulaic writing over creative and critical thought.\n\n  2.6. Methodological Approaches in Assessing Cognitive and Critical Thinking Skills"
    },
    {
        "chunk_id": "cmr26zuk8004qrl89xdhiwqfj",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "The Halpern Critical Thinking Assessment (HCTA) measure is a widely recognised tool designed to measure critical thinking skills across various domains. Developed by Diane Halpern, the HCTA assesses several dimensions of critical thinking, including verbal reasoning, argument analysis, hypothesis testing, and likelihood estimation. The HCTA is unique in its focus on both multiple-choice questions and open-ended tasks, providing a comprehensive assessment of critical thinking abilities. The HCTA consists of 25 multiple-choice items and 25 constructed-response items, requiring participants to apply critical thinking skills to real-world scenarios. The multiple-choice section assesses skills such as recognising assumptions, evaluating arguments, and drawing conclusions. The constructed-response section, on the other hand, requires participants to generate hypotheses, design experiments, and analyse data, thereby evaluating their ability to apply critical thinking in practical contexts [1]. The HCTA has been widely used in educational and psychological research to assess critical thinking skills among students and professionals. Its comprehensive nature allows researchers to capture a broad range of critical thinking abilities and to evaluate the effectiveness of educational interventions aimed at enhancing these skills. For instance, a study by Liu, Frankel, and Roohr [29] examined the effects of critical thinking instruction on college students using the HCTA. The results showed significant improvements in students’ critical thinking skills, particularly in argument analysis and hypothesis testing, demonstrating the effectiveness of targeted instruction in developing these skills."
    },
    {
        "chunk_id": "cmr26zuk8004rrl89kxrb0djq",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "Terenzini’s self-reported measures of critical thinking development provide an alternative approach to assessing critical thinking skills. Developed by Patrick Terenzini and his colleagues, these measures focus on students’ perceptions of their critical thinking growth and the factors contributing to it. Unlike standardised tests, Terenzini’s approach relies on self-reports, capturing students’ subjective experiences and reflections on their cognitive development. Terenzini’s self-reported measures typically involve surveys and questionnaires that ask students to reflect on their critical thinking experiences and growth. These measures assess various dimensions of critical thinking, including analysis, evaluation, and synthesis, as well as the influence of instructional practices and learning environments on cognitive development [30]. Several studies have employed Terenzini’s self-reported measures to assess critical thinking development in various educational contexts. For example, a study by Terenzini et al. [30] examined the impact of collaborative learning environments on students’ critical thinking growth. The study found that students who participated in collaborative learning activities reported significant improvements in their critical thinking abilities, highlighting the value of interactive and participatory instructional practices. In another study, Tsui [31] investigated the relationship between classroom practices and students’ self-reported critical thinking development. Using Terenzini’s measures, Tsui found that instructional practices that encourage active learning, such as group discussions and problem-based learning, were associated with higher levels of self-reported critical thinking growth.\n\n  3. Materials and Methods\n\nThis chapter outlines the comprehensive methodological approach employed in this study to investigate the impact of AI tool usage on critical thinking, with cognitive offloading as a mediating variable. A mixed-method approach was utilised, combining quantitative and qualitative techniques to provide a robust and nuanced understanding of the research questions.\n\n  3.1. Research Design\n\nA mixed-method design was chosen for its ability to integrate quantitative and qualitative data, offering a more complete perspective on the research problem than either method alone [32]. This design allows for the triangulation of data, enhancing the validity and reliability of the findings [33].\n\n  3.2. Participants"
    },
    {
        "chunk_id": "cmr26zuk8004srl89bswoh96i",
        "pdf_id": "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking",
        "text": "The study sample comprised 669 participants in the United Kingdom, of which 666 were considered valid. They were recruited through a combination of convenience and purposive sampling to ensure a diverse representation across age groups, educational backgrounds, and professional fields. The sample was promoted online in the UK on different social media platforms to attract a diverse sample. Participants were categorised into three age groups: 17–25 years (young), 26–45 years (middle-aged), and 46 years and older (older). This categorisation facilitated the examination of age-related differences in AI tool usage and critical thinking skills.\n\n  3.3. Quantitative Data/Survey Instrument\n\nA structured questionnaire consisting of 23 questions was developed based on validated scales and existing literature to measure AI tool usage, cognitive offloading, and critical thinking skills. The survey included items from established instruments such as the Halpern Critical Thinking Assessment (HCTA) [1] tool and Terenzini’s self-reported measures of critical thinking [30]. The questionnaire was divided into several sections:\n\nDemographic Information: Age, gender, education level, and occupation.\n\nAI Tool Usage: Frequency and reliance on AI tools for information retrieval and decision-making.\n\nCognitive Offloading: Use of digital devices for memory and problem-solving tasks.\n\nCritical Thinking: Self-reported and assessed critical thinking skills.\n\nA 6-step Likert scale (1 = Never/Strongly Disagree to 6 = Always/Strongly Agree) was used for most items, providing ordinal data suitable for parametric statistical analysis [34]. The full questionnaire is provided in Appendix A for further reference.\n\nTo ensure the statistical relevance of the sample size, a calculation based on standard sampling adequacy was conducted. Using a 95% confidence level (Z = 1.96) and a 5% margin of error, the required sample size was calculated using the following formula:\n\n                n\n                =\n\n                      (\n\n                          Z\n                          2\n\n                        ∗\n\n                        p\n\n                        ∗\n\n                          (\n\n                            1\n                            −\n                            p"
    },
    {
        "chunk_id": "cmrfxowlt0003qyd21n2bb9dy",
        "pdf_id": "Angwin-et-al-2016-Machine-Bias.pdf",
        "text": "The score proved remarkably unreliable in forecasting violent crime: only 20 percent of the people predicted to commit violent crimes actually went on to do so. Black defendants were often predicted to be at a higher risk of recidivism than they actually were, while white defendants were often predicted to be less risky than they were."
    },
    {
        "chunk_id": "cmrfxoxkf0007qyd2wyhkmryk",
        "pdf_id": "Angwin-et-al-2016-Machine-Bias.pdf",
        "text": "Northpointe disputes this, arguing that the tool is equally well calibrated for both races: among defendants who scored high risk, the percentage who reoffended was roughly the same regardless of race."
    },
    {
        "chunk_id": "cmrfxoxkf0006qyd2m2pnhxof",
        "pdf_id": "Angwin-et-al-2016-Machine-Bias.pdf",
        "text": "Kleinberg, Mullainathan, and Raghavan (2016) later proved that except in special cases, it is mathematically impossible for a risk score to satisfy both equal calibration and equal false-positive rates across groups whenever base rates differ — the two sides of this dispute are not just disagreeing, they are each holding a fairness definition the other cannot simultaneously satisfy."
    },
    {
        "chunk_id": "cmr07goiw000bm7dtv0p1v7xp",
        "pdf_id": "Gerlich 2025 - AI Tools in Society",
        "text": "Generative AI tools such as ChatGPT have become widely used in academic settings. This study examines the impact of AI tools on cognitive offloading and critical thinking. Survey results from 666 knowledge workers showed that higher AI tool usage is associated with increased cognitive offloading and reduced critical thinking effort. The findings suggest that while AI tools can enhance productivity, they may also degrade the higher-order cognitive operations that academic work is meant to cultivate. Notably, the study found that users who frequently relied on AI for drafting and summarizing reported lower engagement with source material and weaker verification habits. The authors recommend that AI writing tools be designed to preserve user agency and encourage evidence-based reasoning rather than replacing it."
    },
    {
        "chunk_id": "cmrfxp0xb000nqyd2jtkz781e",
        "pdf_id": "Hickel-Kallis-2019-Is-Green-Growth-Possible.pdf",
        "text": "Empirical evidence for absolute decoupling at anywhere near the rate required to meet the Paris Agreement targets is lacking; existing studies find at best a temporary and geographically limited effect."
    },
    {
        "chunk_id": "cmrfxp0xc000oqyd2z8qjfjvv",
        "pdf_id": "Hickel-Kallis-2019-Is-Green-Growth-Possible.pdf",
        "text": "Existing decoupling has been relative, not absolute, and mostly attributable to outsourcing carbon-intensive production to other countries rather than genuine efficiency gains within the decoupling economy."
    },
    {
        "chunk_id": "cmrfxp2tr0012qyd2ebt4kt4j",
        "pdf_id": "Johns-1998-The-Nature-of-the-Book-excerpt.pdf",
        "text": "Fixity was not an inherent technical property of print, but a social and commercial accomplishment that had to be fought for by printers, licensers, and authors alike."
    },
    {
        "chunk_id": "cmrfxp2tr0014qyd224mk2tww",
        "pdf_id": "Johns-1998-The-Nature-of-the-Book-excerpt.pdf",
        "text": "Piracy, misattribution, and unauthorized reprinting were endemic in the early print trade, undermining any assumption that print automatically produced stable, trustworthy texts."
    },
    {
        "chunk_id": "cmrfxp2ts0015qyd260kqurka",
        "pdf_id": "Johns-1998-The-Nature-of-the-Book-excerpt.pdf",
        "text": "The credibility of printed knowledge depended on institutions — licensing, registration, professional norms — that emerged slowly and unevenly across Europe, not on the press itself."
    }
]
