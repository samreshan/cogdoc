# CogDoc interactive demo walkthrough

Date: 6 September 2026

Length: 8 to 12 minutes

Scenario: How can a simple Java application run on Kubernetes?

## What this demo proves

The interactive demo is a deterministic, client-only replay of CogDoc's research-writing journey. It begins on Home, fills a focused topic and goal in the normal research form, then uses the real editor, navigation, dock, source reader, revision preview, finding review, article composer, and explicit download interaction.

The displayed source identities link to official Dev.java and Kubernetes documentation. The inspected passage is clearly labelled as a demonstration paraphrase, not a quotation. Search states, assistant responses, checks, findings, and article content are simulated fixtures. No Java application is compiled, no image is built, and no Kubernetes cluster is contacted or measured.

The demo does not write to project, source, AI, worker, or review APIs. It does not publish. The final Markdown download occurs only after the visitor clicks the highlighted export button.

## Launch from Home

Run the application with the normal development or Compose workflow, then open Home. No live AI, research provider, retrieval service, or worker is required for this path.

1. Click **Try interactive demo** under the Home introduction.
2. The coach first explains the normal topic field instead of moving away from Home.
3. Choose **Show me** to fill **How can a simple Java application run on Kubernetes?**, or type your own wording.
4. Reveal and fill the plain-language goal, then click **Start writing**.
5. CogDoc opens the isolated client-only workspace and resumes at step 6 of 32.

The separate **Resume guided demo** action still opens the saved database-backed workspace. Use **Try interactive demo** for the deterministic Java and Kubernetes presentation described here.

## Coach controls

- **Show me** performs the highlighted non-destructive action. The visitor may also click the highlighted control directly.
- **Next** appears for explanatory highlights that are not themselves interactive. This distinction prevents the source-reader passage from looking clickable.
- **Pause** stops paced writing playback. The editor remains available for manual takeover.
- **Back** restores the exact Home form, document, dock, modal, and simulated state needed by the previous step.
- **Escape** hides the coach without discarding progress. **Resume demo** brings it back.
- Refresh restores the saved step, including the source reader and the Home-to-editor boundary.
- **Replay** resets the isolated sample after completion.
- The answer and final export steps are manual-only. The coach cannot answer or download on the visitor's behalf.

## Presentation route

### 1. Topic and goal on Home

Start with the visible topic field. The sample question is deliberately small and approachable. Reveal the goal and show that it names the Java artifact, container image, Deployment, Service, and limitations before a project is created. The visitor can edit either field. Starting the demo creates only a client-side sample project.

### 2. Document, plan, and paced writing

Introduce the mounted document as the center of the workspace. Use **Show me** to write a short explanation at a readable pace. The starter claim is intentionally too broad: putting Java on Kubernetes does not by itself make the application reliable or easy to scale.

Open **Plan** to show three questions: what Java needs before containerization, how Deployment and Service differ, and which operational responsibilities Kubernetes does not remove.

### 3. Official documentation leads and source inspection

Open **Sources** and run the deterministic search replay. It moves through queued, searching, and ready states before showing these official documentation leads:

- Dev.java, *Getting Started with Java*.
- Kubernetes Documentation, *Deployments*.
- Kubernetes Documentation, *Service*.

Inspect the Deployments record. The reader distinguishes the official page identity from a labelled sample paraphrase. This is an explanatory step, so its coach button says **Next**. The following step highlights **Use this sample passage**, making the evidence action unambiguous. Selecting it changes demo context but does not create or approve a finding.

Insert the labelled citation and watch the real editor change.

### 4. Collaborator and four checks

Open **Collaborator** and ask the prepared question about which responsibility belongs to Java, the image, the Deployment, and the Service. The answer is deterministic and not evidence.

Run the four highlighted checks:

- **Interceptor** catches the broad reliability claim.
- **Socratic Spacer** asks the visitor to distinguish the four components.
- **Citation Sentinel** limits documentation support to what the official pages actually establish.
- **Scaffold** separates the claim, support, operational limitations, and next practical test.

At the response step, manually choose **Use sample answer** and **Record response**. A response neither creates evidence nor reviews a finding.

### 5. Safe revision, finding, and article

Preview the narrower claim before applying it. The replacement explains that a Deployment manages Pods and a Service supplies a stable endpoint, while reliability still depends on health checks, resource settings, image quality, and cluster operations.

Open **Findings**, fill the deterministic conclusion and limitation, then retain it with uncertainty as a separate review decision. Open **Share**, compose the article, and check that it preserves the simulation label, official links, and statement that no live deployment was measured.

### 6. Explicit export

Continue from the explanatory article step to the manual-only export step. Personally click **Download sample Markdown**. The completion card appears only after that click and reiterates the simulation and no-cluster-test boundary.

## Verification checklist

Verified on 6 September 2026 with headless Chrome against the development application, plus the automated test suite. The browser run visited all 32 coach steps and completed the manual export. It also reloaded and used Back at the source reader, emulated a 390 by 844 viewport, and enabled reduced motion. No browser console errors or failed requests were recorded. Automated verification passed 133 test files and 720 tests before the final replay assertion was added; the focused tour suite was rerun afterward.

- [x] Home prominently offers **Try interactive demo**.
- [x] Topic and goal are filled on Home before the editor opens.
- [x] The tour contains 32 descriptive steps and distinguishes **Next** from **Show me**.
- [x] Starting and completing the demo performs no project, source, AI, or job API write.
- [x] Plan contains the Java and Kubernetes topic, goal, context, and three questions.
- [x] Discovery shows only the three official documentation fixtures.
- [x] Source identity and demonstration paraphrase are visibly distinct.
- [x] The source-reader explanation advances to the separate evidence button without trapping the visitor.
- [x] Back and refresh restore the source reader and its surrounding state.
- [x] Collaborator and all four checks have distinct deterministic outputs.
- [x] Revision preview and apply remain separate actions.
- [x] Finding fill and review remain separate actions.
- [x] Export has no **Show me** control and requires the visitor's click.
- [x] Narrow viewport, reduced motion, Escape/resume, replay, and missing-target recovery work.
- [x] Exiting returns to the normal Home form without leaving demo-only controls or state active.

## Known boundary

This is a product-behavior demonstration, not evidence that the Java application works in a cluster or that CogDoc improves research quality. A real implementation must build and test an image, choose health and resource settings, configure and secure a cluster, inspect the exact official pages, and record actual observations separately from documentation claims.
