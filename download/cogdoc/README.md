# Cogdoc System Architecture Design - Deliverables

## Main Deliverable
- **`Cogdoc_System_Architecture_Design.pdf`** (3.6 MB, 36 pages)
  - The full architecture design document with cover, TOC, 11 chapters, and Appendix A.
  - Passes all PDF quality checks (page-size consistency, font embedding, margin symmetry, punctuation, TOC populated, table centering, content fill ratio, full-bleed cover).

## Mermaid Diagram Sources (`mermaid_source/`)
Editable Mermaid source files for every diagram in the document. Edit and re-render with:

```bash
# Install mermaid-cli if you don't have it
npm install -g @mermaid-js/mermaid-cli

# Set the Chrome executable path (Playwright Chromium works)
export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome

# Render a single diagram
mmdc -i mermaid_source/01_usecase.mmd \
     -o diagram_pngs/01_usecase.png \
     -c mermaid_source/mermaid-config.json \
     -w 1600 -b "#eff0f0" --scale 2

# Or render all 7 diagrams
bash mermaid_source/render_diagrams.sh
```

### Diagram inventory
| File | Diagram | Where it appears |
|------|---------|------------------|
| `01_usecase.mmd` | Use Case Diagram | Chapter 4, Figure 4.1 |
| `02_architecture.mmd` | System Architecture (Modular Monolith) | Chapter 5, Figure 5.1 |
| `03_seq_interceptor.mmd` | Prompt Interceptor Sequence | Chapter 6, Figure 6.1 |
| `04_seq_citation.mmd` | Citation Sentinel RAG Sequence | Chapter 3 Fig 3.1 + Chapter 6, Figure 6.2 |
| `05_seq_socratic.mmd` | Socratic Spacer Sequence | Chapter 6, Figure 6.3 |
| `06_er.mmd` | Entity-Relationship Diagram | Chapter 7, Figure 7.1 |
| `07_class.mmd` | AI Service Class Diagram | Chapter 9, Figure 9.1 |

## Rendered PNGs (`diagram_pngs/`)
High-resolution (2x scale) PNG renders of each Mermaid diagram, ready for re-use in slides, the IR, or other documents.

## Document Structure
1. **Cover** (HUD Data Terminal layout, Template 01)
2. **Table of Contents** (auto-generated, clickable)
3. **Chapter 1** - Executive Summary & Architectural Context
4. **Chapter 2** - 7 Architecture Decision Records (ADRs)
5. **Chapter 3** - 3 User Journey Maps with sequence diagram
6. **Chapter 4** - Use Case Diagram + 8-row specification table
7. **Chapter 5** - Modular Monolith architecture + module matrix + microservices rejection rationale
8. **Chapter 6** - 3 sequence diagrams (Interceptor, Citation, Socratic)
9. **Chapter 7** - ER Diagram (10 entities) + entity descriptions
10. **Chapter 8** - Normalization walkthrough UNF → 1NF → 2NF → 3NF + final schema summary
11. **Chapter 9** - AI Service Layer class diagram + prompt template registry
12. **Chapter 10** - Security controls matrix + latency budgets + privacy
13. **Chapter 11** - Conclusion + migration path to microservices
14. **Appendix A** - All 7 Mermaid source code blocks

## Architecture Summary
- **Pattern**: Modular Monolith (single FastAPI deployable, 8 internal modules)
- **Auth**: Supabase Auth + JWT, single Writer role, RLS on every table
- **AI**: Provider Abstraction Layer (AIService interface + GeminiAdapter)
- **RAG**: Project → PDF → Chunk → Embedding hierarchy in pgvector
- **Audit**: Full Intervention Log (every AI event persisted)
- **Streaming**: Server-Sent Events (SSE)
- **Stack**: React + Tiptap, FastAPI, Supabase Postgres + pgvector, Gemini API
- **Scope**: 60-day solo build, 4 AI engines, 10 tables at 3NF
