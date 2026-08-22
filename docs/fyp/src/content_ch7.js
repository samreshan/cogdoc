// content_ch7.js — Chapter 7: Testing and Evaluation.
const {
  h1, h2, h3, body, bodyFlat, bullet, numItem, figure, table, tableTitle, spacer,
} = require("./helpers");

function chapter7() {
  return [
    h1("CHAPTER 7: TESTING AND EVALUATION"),

    h2("7.1 Introduction"),
    bodyFlat(
      "This chapter reports how the system was tested and how the central claims were evaluated. It has two parts. The first covers the software test strategy that protected correctness throughout development. The second covers the scientific evaluation of the citation-verification engine against a real corpus, which is where the project\u2019s empirical contributions are measured. The chapter states results honestly, including a target that was not met, and explains why."
    ),

    h2("7.2 Software Test Strategy"),
    bodyFlat(
      "Testing was continuous and test-driven, as described in Chapter 3. Three levels of testing were used. Unit tests covered individual functions and modules (the content analyser, the friction guard, the embedder, the verdict classifier, and the chunker). Integration tests covered the route handlers and the FastAPI endpoints together with their data stores. System-level checks covered end-to-end behaviour such as uploading a PDF and receiving an intervention. All tests had to pass and coverage had to reach at least eighty percent before a sprint could advance."
    ),
    tableTitle("Table 7.1: Test summary (end of build phase)"),
    table(
      ["Metric", "Result"],
      [
        ["TypeScript tests", "179 (across the front end and BFF)"],
        ["Python tests", "68 (across the retrieval service)"],
        ["Total tests", "247"],
        ["TypeScript coverage (src/lib + src/app/api)", "\u2265 93% lines"],
        ["Python coverage (fastapi/app)", "\u2265 97% lines"],
        ["Coverage gate", "80% hard floor \u2014 enforced, never softened"],
      ],
      [55, 45]
    ),
    spacer(),
    body(
      "Two specific test suites deserve emphasis. The friction-invariant tests assert that the non-generation contract holds in all three modes \u2014 that no combination of mode and input can coax the system into producing paragraph-length prose. The interceptor-blocking tests assert a high blocking precision against a targeted set of delegative prompts."
    ),

    h2("7.3 Evaluation of the Citation Sentinel"),
    h3("7.3.1 Method"),
    bodyFlat(
      "The citation-verification engine was evaluated against a real corpus of 28 passages drawn from five real research PDFs (including the Gerlich study and papers on critical thinking, algorithmic fairness, and environmental accounting). Fifty claims were hand-labelled with ground-truth verdicts: 20 supported (paraphrases of source content), 10 partially supported (overstatement, incorrect causation, or misattributed intent), 10 unsupported (contradicted by the sources), and 10 with insufficient evidence (off-corpus, including topic-adjacent hard negatives). To prevent tuning on the test set, the claims were split deterministically into a calibration set of about one third and a held-out test set of about two thirds; the similarity threshold was chosen on the calibration set only, and all reported metrics are on the held-out test set. Figure 7.1 shows the pipeline."
    ),
    ...figure("18_eval_pipeline.png", "Figure 7.1: Calibrated evaluation pipeline (real corpus, held-out test split)", 640),
    body(
      "The calibrated pipeline runs as follows: embed the claim as a retrieval query, retrieve the top passages by cosine similarity, apply the verdict guard (forcing \u201cinsufficient evidence\u201d when grounding is weak), and otherwise classify the verdict with the language model against the retrieved evidence. Any verdict API failure was treated as a missing measurement and was never silently scored; the final run recorded zero failures."
    ),
    h3("7.3.2 Results"),
    bodyFlat(
      "Table 7.2 reports the headline results against the project targets. Two of the three targets were met; the third was not, and the reason is informative rather than flattering."
    ),
    tableTitle("Table 7.2: Evaluation results against targets (held-out test, n = 31)"),
    table(
      ["Metric", "Result", "Target", "Met?"],
      [
        ["Verdict macro-F1", "0.773", "\u2265 0.70", "Yes"],
        ["Retrieval Recall@5 (vector)", "0.8875", "\u2265 0.80", "Yes"],
        ["Vector vs keyword \u0394 Recall@5", "+2.5 pp", "\u2265 15 pp", "No"],
        ["Verdict API failures", "0", "0", "Yes"],
      ],
      [34, 22, 22, 22]
    ),
    spacer(),
    body(
      "Per-class performance (Figure 7.2) was balanced: every verdict class achieved an F1 of at least 0.70 \u2014 supported 0.82, partially supported 0.80, unsupported 0.77, and insufficient evidence 0.71. The verdict guard did its job: the \u201cinsufficient evidence\u201d class reached perfect recall, meaning every claim for which evidence was genuinely absent was correctly flagged."
    ),
    ...figure("16_chart_f1_by_class.png", "Figure 7.2: Per-verdict precision, recall and F1 (held-out test, n = 31)", 560),

    h2("7.4 Retrieval: Vector versus Keyword"),
    bodyFlat(
      "The retrieval comparison is shown in Figure 7.3. Vector retrieval (using the real Gemini embeddings) beat the keyword (Jaccard) baseline at every cut-off, and the gap was largest at Recall@1 (+5.0 percentage points) \u2014 the rank that matters most, because it determines which passage the verdict model reads first. Vector Recall@5 reached 0.8875 against the keyword\u2019s 0.8625, a difference of 2.5 percentage points."
    ),
    ...figure("17_chart_recall_by_k.png", "Figure 7.3: Vector versus keyword retrieval recall by cut-off k", 540),
    body(
      "The project set an ambitious ablation target of a fifteen-percentage-point gap, and that target was not met on this corpus. The reason is honest: when a claim shares proper nouns with its sources (Gerlich, Halpern, COMPAS, Northpointe), a simple keyword baseline is already strong, and the corpus is small (only 28 chunks), which limits how many lexical collisions can occur. The project\u2019s expectation, supported by the Recall@1 result, is that the gap widens as the corpus grows and lexical collisions multiply; validating that on a larger corpus is identified as future work."
    ),

    h2("7.5 The Two Implementation Findings"),
    bodyFlat(
      "The evaluation surfaced two findings that go beyond the headline numbers. First, the asymmetric-embedding finding: queries were initially embedded with the wrong task type, which caused vector retrieval to lose to the keyword baseline; correcting the task type flipped the result so that vector retrieval won at every cut-off. This is a concrete, reproducible demonstration that Gemini\u2019s retrieval embeddings are asymmetric by design and that mixing the task types measurably degrades ranking. Second, the calibration finding: real embeddings produce a high baseline cosine similarity even for unrelated distractor claims, so the verdict similarity floor that was appropriate for the simple surrogate embedder (0.30) was far too low for real embeddings (which need a floor around 0.80). Switching to real embeddings therefore required re-calibrating the verdict guard, not merely the retriever. Both findings are recorded as Architecture Decision Records and are the project\u2019s empirical contributions to practice."
    ),

    h2("7.6 Engine and Friction Evaluation"),
    bodyFlat(
      "Beyond the citation engine, the Interceptor was evaluated for blocking precision against a targeted set of delegative prompts and achieved a blocking precision of 1.000 (it correctly blocked every attempt to make it write prose) with full recall on delegative prompts. The friction modes were evaluated by invariant tests confirming that the non-generation contract holds across Socratic, Coach, and Assistant modes. Together these tests establish that the central design invariant is enforced, not merely intended."
    ),

    h2("7.7 User Testing and Acceptance"),
    bodyFlat(
      "User acceptance was assessed primarily through the requirements survey (Chapter 4) and interviews, which established both the need for the tool and the tension that friction calibration resolves. The 59.1 percent of respondents who rated a friction-based tool useful for long-term learning, set against the 78.3 percent who expected it to be frustrating under pressure, directly motivated the three-mode design. Formal usability testing with a larger sample under controlled conditions is identified as future work."
    ),

    h2("7.8 Limitations"),
    bodyFlat(
      "The evaluation has clear limitations, stated openly. The corpus is real but modest (28 passages, 50 claims), so the absolute numbers should be read as evidence on this corpus, not as a guarantee at scale. The fifteen-percentage-point ablation target was not met. The live round-trip through a hosted pgvector instance was not verified in the evaluation environment because outbound database ports were blocked, so the production vector store was exercised through its adapter rather than against a live managed instance. User acceptance is based on a survey and interviews rather than a controlled trial. None of these limitations undermine the central findings, but they bound the strength of the claims and define the future work."
    ),

    h2("7.9 Summary"),
    bodyFlat(
      "The system met its verdict-accuracy and retrieval-recall targets (macro-F1 0.773, Recall@5 0.8875), enforced the non-generation contract across all friction modes, and produced two empirical findings \u2014 the asymmetry of retrieval embeddings and the need to re-calibrate the verdict guard for real embeddings \u2014 that constitute its contribution to practice. The ambitious ablation target was honestly not met, and the limitations define a clear programme of future work."
    ),
  ];
}

module.exports = { chapter7 };
