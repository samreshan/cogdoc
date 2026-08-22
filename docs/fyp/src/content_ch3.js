// content_ch3.js — Chapter 3: Methodology.
const {
  h1, h2, h3, body, bodyFlat, bullet, numItem, figure, table, tableTitle, spacer,
} = require("./helpers");

function chapter3() {
  return [
    h1("CHAPTER 3: METHODOLOGY"),

    h2("3.1 Introduction"),
    bodyFlat(
      "This chapter explains the methods used to carry out the project. It covers the software-development life-cycle (SDLC) approach, the test-driven development practice that governs every change, the methods used to gather and analyse requirements, and the methods used to evaluate the finished system. The chapter also justifies why an iterative, agile approach was chosen over a strict waterfall."
    ),

    h2("3.2 Software Development Life-Cycle Approach"),
    bodyFlat(
      "The project followed a hybrid agile methodology rather than a strict waterfall. A waterfall model would have required fixing all requirements up front, designing the whole system, and only then building and testing it. That approach is a poor fit for a research-oriented project, because the requirements and the technical risks (for example, whether vector retrieval would genuinely outperform a keyword baseline) were not fully known at the start and needed to be discovered through building and measuring."
    ),
    body(
      "Instead, the work was organised into four short sprints inside a roughly sixty-day window. Each sprint produced a working, tested increment: Sprint 0 delivered the foundation and the test suite; Sprint 1 delivered the retrieval-augmented generation service and the evaluation harness; Sprint 2 delivered streaming, authentication, and the editor; and Sprint 3 delivered friction calibration and experimental engines. At the end of each sprint the system was demonstrable, and the findings of that sprint fed directly into the plan for the next one. Figure 3.2 shows how the research, build, and evaluation phases relate."
    ),
    ...figure("03_methodology.png", "Figure 3.2: Overall project methodology", 620),

    h2("3.3 Test-Driven Development"),
    bodyFlat(
      "Within the agile sprints, every change was made using test-driven development (TDD). The practice was not optional decoration: it was the single load-bearing rule of the project. Two TDD regimes were used, matched to the type of work."
    ),
    h3("3.3.1 Red\u2013Green\u2013Refactor for New Features"),
    bodyFlat(
      "For net-new features (the friction modes, the experimental engines, and the evaluation harness) the classic three-step cycle was used. First, a failing test was written that described the desired behaviour (Red). Second, the minimum code needed to make that test pass was written (Green). Third, the code was cleaned up without changing its behaviour (Refactor). The cycle then repeated for the next piece of behaviour."
    ),
    h3("3.3.2 Characterization-First for Migrations"),
    bodyFlat(
      "When changing existing behaviour \u2014 such as replacing the simple contentEditable editor with the Tiptap editor, or replacing keyword retrieval with vector retrieval \u2014 the team instead wrote characterization tests first. These are tests that capture exactly what the current code already does, so that the old code passes them. The underlying implementation was then swapped behind a feature flag, and the same tests were required to stay green. This approach, advocated by Feathers in Working Effectively with Legacy Code, lets large changes be made safely because a test suite guards the behaviour throughout."
    ),
    ...figure("02_tdd_gate.png", "Figure 3.1: The test-driven development gate cycle", 560),

    h2("3.4 The Coverage Gate"),
    bodyFlat(
      "To make the discipline of TDD objective and non-negotiable, the project used a mechanical gate implemented as a shell script (scripts/gate.sh). The gate runs the entire test suite for both the TypeScript front end and the Python back end, and it measures code coverage. A sprint could not advance unless every test passed and coverage was at least eighty percent of lines, branches, functions, and statements in both codebases."
    ),
    body(
      "Crucially, the gate was never softened. During Sprint 0 the gate failed twice, first at forty-eight percent and then at sixty-six percent coverage. Rather than lowering the threshold, more tests were written until the gate genuinely passed. The project records this as a deliberate stance: coverage is a hard floor, and a coverage of 79.9 percent is a failed sprint. By the end of the build phase the suite contained 247 tests (179 in TypeScript and 68 in Python) guarding roughly six thousand lines of application code, with coverage above ninety percent in both codebases."
    ),

    h2("3.5 Research Methodology (Requirements Gathering)"),
    bodyFlat(
      "Requirements were gathered using a mixed-methods approach with three components: a structured questionnaire, semi-structured interviews, and document analysis."
    ),
    h3("3.5.1 Questionnaire"),
    bodyFlat(
      "An online questionnaire was administered to thirty-three respondents using purposive sampling. The target sample size was at least thirty. Respondents were undergraduates, postgraduates, doctoral candidates, researchers, and academic writers. The questionnaire had four sections: demographics and AI-usage habits; cognitive offloading and automation bias; the illusion of mastery; and receptivity to a friction-based tool. The full results are reported in Chapter 4."
    ),
    h3("3.5.2 Interviews"),
    bodyFlat(
      "At least three semi-structured interviews were conducted to add qualitative depth to the numbers. The interview guide explored how respondents actually write with AI, where they feel it helps, and where they feel it harms their thinking. Responses were analysed thematically and used to refine the personas and the use cases."
    ),
    h3("3.5.3 Document Analysis"),
    bodyFlat(
      "The literature reviewed in Chapter 2, the comparison of existing tools, and technical documentation (for example, the pgvector extension and the Tiptap editor) were analysed to ground the design decisions and the Architecture Decision Records (ADRs) described in Chapter 5."
    ),

    h2("3.6 Evaluation Methodology"),
    bodyFlat(
      "Because the central claim of the project is empirical \u2014 that AI can increase cognition rather than bypass it, and that real embeddings improve retrieval \u2014 the system was evaluated against measurable targets rather than only by demonstration. Two evaluation methods were used."
    ),
    h3("3.6.1 Calibrated Retrieval and Verdict Evaluation"),
    bodyFlat(
      "The citation-verification engine was benchmarked against a real corpus of 28 passages drawn from five real research PDFs, with 50 hand-labelled claims (20 supported, 10 partially supported, 10 unsupported, and 10 with insufficient evidence, including topic-adjacent hard negatives). To avoid the common error of tuning on the test set, the claims were split deterministically into a calibration set (about one third) and a held-out test set (about two thirds). The similarity threshold was chosen using only the calibration split, under a parsimony rule that selected the least restrictive floor within a small margin of the best score. All reported metrics are computed on the held-out test set. A verdict API failure was always treated as a missing measurement and never silently scored."
    ),
    h3("3.6.2 Engine and Friction Evaluation"),
    bodyFlat(
      "The Interceptor engine was evaluated for blocking precision (the fraction of times it correctly blocks a delegative prompt) using a targeted test set. The friction modes were evaluated by a set of invariant tests asserting that the non-generation contract holds across all three modes. User acceptance was assessed through the survey and the interviews. The full results appear in Chapter 7."
    ),

    h2("3.7 Justification of the Approach"),
    bodyFlat(
      "An iterative, test-driven approach was chosen for three reasons. First, the project\u2019s central risks were technical and empirical, and they could only be resolved by building and measuring, not by planning. Second, a high-coverage test suite made it safe to make the large migrations the project required (editor, retrieval, and architecture changes) without silently breaking behaviour. Third, the scientific claims demanded reproducible measurement, which the calibrated harness and the held-out split provide. A strict waterfall would have delivered the whole system late and would have offered no opportunity to correct the design in response to what was measured."
    ),

    h2("3.8 Summary"),
    bodyFlat(
      "The project used a hybrid agile SDLC organised into four sprints, governed by strict test-driven development and an eighty-percent coverage gate. Requirements were gathered by questionnaire, interview, and document analysis, and the system was evaluated against measurable targets using a calibrated, held-out methodology. The next chapter presents the requirements and the system analysis that this methodology produced."
    ),
  ];
}

module.exports = { chapter3 };
