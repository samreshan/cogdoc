"""
Generate draw.io (.drawio) files that faithfully reproduce each Mermaid diagram.

Each function reads the actual Mermaid source and produces an equivalent
draw.io XML file with the same nodes, labels, colors, and connections.

Diagrams:
  1. use_case.drawio           — from 01_usecase.mmd
  2. architecture.drawio       — from 02_architecture.mmd
  3. seq_interceptor.drawio    — from 03_seq_interceptor.mmd
  4. seq_citation.drawio       — from 04_seq_citation.mmd
  5. seq_socratic.drawio       — from 05_seq_socratic.mmd
  6. er.drawio                 — from 06_er.mmd
  7. class.drawio              — from 07_class.mmd
  8. writing_loop.drawio       — from 08_writing_loop.mmd
  9. use_case_simple.drawio    — from 01_usecase_simple.dot
  10. architecture_simple.drawio — from 02_architecture_simple.mmd
"""

import os
from xml.sax.saxutils import escape

OUT_DIR = "/home/z/my-project/download/cogdoc/drawio"
os.makedirs(OUT_DIR, exist_ok=True)

def esc(s: str) -> str:
    return escape(s, {'"': '&quot;', "'": '&apos;', '<': '&lt;', '>': '&gt;', '\n': '&#xa;'})

def safe_id(s: str) -> str:
    return ''.join(c if c.isalnum() else '_' for c in s)

def mxfile(diagrams):
    pages = []
    for d in diagrams:
        pages.append(f'<diagram name="{esc(d["name"])}" id="{d.get("id", safe_id(d["name"]))}">{d["xml"]}</diagram>')
    return f'<mxfile host="app.diagrams.net" modified="2026-07-02T00:00:00.000Z" agent="Cogdoc" version="24.0.0" type="device">\n{"\n".join(pages)}\n</mxfile>'

def model(cells):
    return f'<mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0">\n<root>\n<mxCell id="0"/>\n<mxCell id="1" parent="0"/>\n{"\n".join(cells)}\n</root>\n</mxGraphModel>'

# ── Shape helpers ──────────────────────────────────────────────────────────

def actor_node(name, x, y, color="#226b90"):
    sid = safe_id("actor_" + name)
    return f'<mxCell id="{sid}" value="{esc(name)}" style="shape=umlActor;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;verticalAlign=top;html=1;outlineConnect=0;fontSize=12;fontColor={color};strokeColor={color};fillColor=#ffffff;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="30" height="60" as="geometry"/></mxCell>'

def ellipse_node(name, x, y, w=140, h=60, fill="#EFF6FF", stroke="#226b90", font_color="#181a1b"):
    sid = safe_id("uc_" + name)
    return f'<mxCell id="{sid}" value="{esc(name)}" style="ellipse;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};fontSize=11;fontColor={font_color};" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'

def box_node(name, x, y, w=160, h=60, fill="#f5f8fb", stroke="#354d59", rounded=True, bold=False, font_color="#181a1b"):
    r = "rounded=1;" if rounded else "rounded=0;"
    fw = "1" if bold else "0"
    sid = safe_id("box_" + name)
    return f'<mxCell id="{sid}" value="{esc(name)}" style="{r}whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};fontSize=11;fontColor={font_color};fontStyle={fw};" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'

def diamond_node(name, x, y, w=120, h=60, fill="#FEF3C7", stroke="#92400e"):
    sid = safe_id("dia_" + name)
    return f'<mxCell id="{sid}" value="{esc(name)}" style="rhombus;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};fontSize=10;fontColor=#181a1b;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'

def cylinder_node(name, x, y, w=140, h=70, fill="#f1f5f9", stroke="#475569"):
    sid = safe_id("cyl_" + name)
    return f'<mxCell id="{sid}" value="{esc(name)}" style="shape=cylinder3;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};fontSize=11;fontColor=#181a1b;size=10;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'

def container_node(name, x, y, w, h, fill="#faf7f0", stroke="#78716c"):
    sid = safe_id("grp_" + name)
    return f'<mxCell id="{sid}" value="{esc(name)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};fontSize=13;fontColor=#181a1b;fontStyle=1;verticalAlign=top;align=left;spacingLeft=10;spacingTop=8;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'

def lifeline_node(name, x, y, h=500, fill="#EFF6FF", stroke="#226b90"):
    sid = safe_id("ll_" + name)
    return f'<mxCell id="{sid}" value="{esc(name)}" style="shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=0;collapsible=0;recursiveResize=0;outlineConnect=0;size=40;fillColor={fill};strokeColor={stroke};fontSize=11;fontColor=#181a1b;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="130" height="{h}" as="geometry"/></mxCell>'

def class_node(name, x, y, w, h, fields, fill="#e4e6e7", stroke="#226b90"):
    """UML class box with three sections: name, attributes, methods."""
    sid = safe_id("cls_" + name)
    # Build the value as HTML table
    br = "&lt;br&gt;"
    field_lines = br.join(esc(f) for f in fields)
    val = f"{esc(name)}{br}{br}{field_lines}"
    return f'<mxCell id="{sid}" value="{val}" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;collapsible=1;marginBottom=0;fillColor={fill};strokeColor={stroke};fontSize=11;fontColor=#181a1b;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'

def edge(src, dst, label="", color="#354d59", dashed=False, arrow="none", font_color=None):
    d = "1" if dashed else "0"
    fc = font_color or color
    lbl = esc(label) if label else ""
    eid = safe_id(f"e_{src}_{dst}_{label}")
    return f'<mxCell id="{eid}" value="{lbl}" style="edgeStyle=orthogonalEdgeStyle;html=1;strokeColor={color};dashed={d};fontSize=9;fontColor={fc};endArrow={arrow};endFill=0;" edge="1" parent="1" source="{src}" target="{dst}"><mxGeometry relative="1" as="geometry"/></mxCell>'

def seq_msg(src, dst, label, y, dashed=False, color="#354d59"):
    d = "1" if dashed else "0"
    arrow = "open" if dashed else "block"
    eid = safe_id(f"msg_{src}_{dst}_{label}_{y}")
    return f'<mxCell id="{eid}" value="{esc(label)}" style="html=1;strokeColor={color};dashed={d};fontSize=9;fontColor={color};endArrow={arrow};endFill=0;" edge="1" parent="1" source="{src}" target="{dst}"><mxGeometry relative="1" as="geometry"><mxPoint x="0" y="{y}" as="sourcePoint"/><mxPoint x="0" y="{y}" as="targetPoint"/></mxGeometry></mxCell>'

def activation_bar(lifeline_id, y, h, color="#226b90"):
    """Activation bar on a lifeline."""
    eid = safe_id(f"act_{lifeline_id}_{y}")
    return f'<mxCell id="{eid}" value="" style="shape=mxgraph.uml.activation;fillColor={color};strokeColor={color};" vertex="1" parent="1"><mxGeometry x="0" y="{y}" width="10" height="{h}" as="geometry" relative="1"/></mxCell>'


# ═══════════════════════════════════════════════════════════════════════════
# Diagram 1: Use Case (faithful to 01_usecase.mmd)
# ═══════════════════════════════════════════════════════════════════════════
def gen_use_case():
    cells = []
    # Actors
    cells.append(actor_node("Writer", 20, 380))
    cells.append(actor_node("Gemini API", 1180, 250, color="#be6a4e"))
    # Supabase as a box (database-shaped in mermaid)
    cells.append(cylinder_node("Supabase\nAuth + pgvector", 1160, 450, 160, 70, fill="#FFF7ED", stroke="#be6a4e"))

    # System container
    cells.append(container_node("Cogdoc System", 140, 20, 1000, 700, fill="#f5f8fb", stroke="#354d59"))

    # Account Management subgraph
    cells.append(container_node("Account Management", 180, 50, 240, 130, fill="#f5f8fb", stroke="#354d59"))
    cells.append(ellipse_node("Register Account", 200, 80))
    cells.append(ellipse_node("Log In / Log Out", 200, 130))

    # Workspace subgraph
    cells.append(container_node("Workspace", 180, 200, 240, 280, fill="#f5f8fb", stroke="#354d59"))
    cells.append(ellipse_node("Create Project", 200, 230))
    cells.append(ellipse_node("Open Editor", 200, 290))
    cells.append(ellipse_node("Upload Research PDF", 190, 350, w=170))
    cells.append(ellipse_node("Delete Project", 200, 410))
    cells.append(ellipse_node("Manage PDF Library", 200, 470))

    # Writing & Friction subgraph
    cells.append(container_node("Writing & Friction", 480, 50, 280, 380, fill="#f5f8fb", stroke="#354d59"))
    cells.append(ellipse_node("Type Draft Paragraph", 500, 80))
    cells.append(ellipse_node("Trigger Prompt\nInterceptor", 490, 140, w=160))
    cells.append(ellipse_node("Receive Socratic\nSpacer", 490, 200, w=160))
    cells.append(ellipse_node("Verify Claim via\nCitation Sentinel", 490, 260, w=160))
    cells.append(ellipse_node("Dismiss / Accept\nMargin Intervention", 490, 320, w=160))
    cells.append(ellipse_node("Apply Structural\nScaffold", 490, 380, w=160))

    # Library & RAG subgraph
    cells.append(container_node("Library & RAG", 820, 50, 260, 280, fill="#f5f8fb", stroke="#354d59"))
    cells.append(ellipse_node("Parse & Chunk PDF", 840, 80))
    cells.append(ellipse_node("Generate Embedding", 840, 140))
    cells.append(ellipse_node("Retrieve Evidence\nChunks", 850, 200, w=160))

    # Writer → use cases
    w_id = safe_id("actor_Writer")
    for uc in ["Register Account", "Log In / Log Out", "Create Project", "Open Editor",
               "Upload Research PDF", "Delete Project", "Manage PDF Library",
               "Type Draft Paragraph", "Trigger Prompt\nInterceptor",
               "Receive Socratic\nSpacer", "Verify Claim via\nCitation Sentinel",
               "Dismiss / Accept\nMargin Intervention", "Apply Structural\nScaffold"]:
        cells.append(edge(w_id, safe_id("uc_" + uc)))

    # Includes & extends
    cells.append(edge(safe_id("uc_Trigger Prompt\nInterceptor"), safe_id("uc_Retrieve Evidence\nChunks"), "<<include>>", dashed=True, color="#78716c", font_color="#78716c"))
    cells.append(edge(safe_id("uc_Verify Claim via\nCitation Sentinel"), safe_id("uc_Retrieve Evidence\nChunks"), "<<include>>", dashed=True, color="#78716c", font_color="#78716c"))
    cells.append(edge(safe_id("uc_Verify Claim via\nCitation Sentinel"), safe_id("uc_Trigger Prompt\nInterceptor"), "<<include>>", dashed=True, color="#78716c", font_color="#78716c"))
    cells.append(edge(safe_id("uc_Receive Socratic\nSpacer"), safe_id("uc_Type Draft Paragraph"), "<<extend>>", dashed=True, color="#78716c", font_color="#78716c"))
    cells.append(edge(safe_id("uc_Apply Structural\nScaffold"), safe_id("uc_Trigger Prompt\nInterceptor"), "<<extend>>", dashed=True, color="#78716c", font_color="#78716c"))
    cells.append(edge(safe_id("uc_Upload Research PDF"), safe_id("uc_Parse & Chunk PDF"), "<<include>>", dashed=True, color="#78716c", font_color="#78716c"))
    cells.append(edge(safe_id("uc_Parse & Chunk PDF"), safe_id("uc_Generate Embedding"), "<<include>>", dashed=True, color="#78716c", font_color="#78716c"))

    # External
    gem_id = safe_id("actor_Gemini API")
    supa_id = safe_id("cyl_Supabase\nAuth + pgvector")
    cells.append(edge(safe_id("uc_Trigger Prompt\nInterceptor"), gem_id, "", dashed=True, color="#be6a4e", font_color="#be6a4e"))
    cells.append(edge(safe_id("uc_Receive Socratic\nSpacer"), gem_id, "", dashed=True, color="#be6a4e", font_color="#be6a4e"))
    cells.append(edge(safe_id("uc_Verify Claim via\nCitation Sentinel"), gem_id, "", dashed=True, color="#be6a4e", font_color="#be6a4e"))
    cells.append(edge(safe_id("uc_Generate Embedding"), gem_id, "", dashed=True, color="#be6a4e", font_color="#be6a4e"))
    cells.append(edge(safe_id("uc_Register Account"), supa_id, "", dashed=True, color="#be6a4e", font_color="#be6a4e"))
    cells.append(edge(safe_id("uc_Log In / Log Out"), supa_id, "", dashed=True, color="#be6a4e", font_color="#be6a4e"))
    cells.append(edge(safe_id("uc_Retrieve Evidence\nChunks"), supa_id, "", dashed=True, color="#be6a4e", font_color="#be6a4e"))

    return model(cells)


# ═══════════════════════════════════════════════════════════════════════════
# Diagram 2: Architecture (faithful to 02_architecture.mmd)
# ═══════════════════════════════════════════════════════════════════════════
def gen_architecture():
    cells = []
    # Client layer
    cells.append(container_node("Client Layer - Browser", 20, 20, 620, 200, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box_node("React SPA\n+ Tiptap Editor", 40, 60, 180, 60, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box_node("Living Margin\nUI Component", 240, 60, 180, 60, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box_node("Idle Detector\nService", 440, 60, 180, 60, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box_node("SSE Client\nEventSource", 240, 140, 180, 60, fill="#EFF6FF", stroke="#226b90"))

    # Gateway
    cells.append(box_node("FastAPI Gateway\nJWT validation\nRate limiting", 280, 260, 200, 70, fill="#FEF3C7", stroke="#92400e", bold=True))

    # Monolith container
    cells.append(container_node("FastAPI Modular Monolith - Single Deployable", 20, 360, 1080, 540, fill="#f5f8fb", stroke="#354d59"))

    # Core modules
    cells.append(container_node("Core Modules", 40, 400, 240, 200, fill="#f5f8fb", stroke="#354d59"))
    cells.append(box_node("auth\nSupabase JWT verify", 60, 440, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))
    cells.append(box_node("documents\nProject + Draft CRUD", 60, 490, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))
    cells.append(box_node("pdf_manager\nUpload + Parse", 60, 540, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))

    # RAG pipeline
    cells.append(container_node("RAG Pipeline Module", 300, 400, 240, 200, fill="#f5f8fb", stroke="#354d59"))
    cells.append(box_node("chunker\nPDF to text chunks", 320, 440, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))
    cells.append(box_node("embedder\nGemini text-embedding", 320, 490, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))
    cells.append(box_node("vector_search\npgvector cosine", 320, 540, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))

    # AI Engines
    cells.append(container_node("AI Engines Module", 560, 400, 260, 240, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box_node("Interceptor\nLazy-prompt detector", 580, 440, 220, 40, fill="#FFF7ED", stroke="#be6a4e", rounded=False))
    cells.append(box_node("Socratic Spacer\nIdle ghost-question gen", 580, 490, 220, 40, fill="#FFF7ED", stroke="#be6a4e", rounded=False))
    cells.append(box_node("Citation Sentinel\nClaim verifier", 580, 540, 220, 40, fill="#FFF7ED", stroke="#be6a4e", rounded=False))
    cells.append(box_node("Structural Scaffold\nOutline generator", 580, 590, 220, 40, fill="#FFF7ED", stroke="#be6a4e", rounded=False))

    # Margin module
    cells.append(container_node("Margin Module", 840, 400, 240, 130, fill="#f5f8fb", stroke="#354d59"))
    cells.append(box_node("Intervention Repository\nFull audit log", 860, 440, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))
    cells.append(box_node("SSE Push Service", 860, 490, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))

    # AI Provider Abstraction
    cells.append(container_node("AI Provider Abstraction", 840, 560, 240, 200, fill="#f5f8fb", stroke="#354d59"))
    cells.append(box_node("AIService Interface", 860, 600, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))
    cells.append(box_node("GeminiAdapter", 860, 650, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))
    cells.append(box_node("PromptTemplate Registry\nversioned + behavior tags", 860, 700, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))

    # Telemetry
    cells.append(container_node("Telemetry", 300, 620, 500, 100, fill="#f5f8fb", stroke="#354d59"))
    cells.append(box_node("Structured Logger", 320, 660, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))
    cells.append(box_node("Metrics Collector", 580, 660, 200, 40, fill="#f5f8fb", stroke="#354d59", rounded=False))

    # External services
    cells.append(container_node("External Services", 20, 940, 1080, 120, fill="#f1f5f9", stroke="#475569"))
    cells.append(cylinder_node("Supabase Auth", 40, 970, 180, 70))
    cells.append(cylinder_node("Supabase Postgres\n+ pgvector", 260, 970, 200, 70))
    cells.append(cylinder_node("Gemini API\nClassification\nEmbedding\nGeneration", 500, 970, 200, 70))
    cells.append(cylinder_node("Object Storage\nRaw PDFs", 740, 970, 200, 70))

    # Connections
    cells.append(edge(safe_id("box_React SPA\n+ Tiptap Editor"), safe_id("box_FastAPI Gateway\nJWT validation\nRate limiting"), "HTTPS REST"))
    cells.append(edge(safe_id("box_SSE Client\nEventSource"), safe_id("box_Living Margin\nUI Component"), "", dashed=True))
    cells.append(edge(safe_id("box_Idle Detector\nService"), safe_id("box_React SPA\n+ Tiptap Editor"), "", dashed=True))
    cells.append(edge(safe_id("box_SSE Client\nEventSource"), safe_id("box_Living Margin\nUI Component"), "SSE stream", dashed=True))

    cells.append(edge(safe_id("box_FastAPI Gateway\nJWT validation\nRate limiting"), safe_id("box_auth\nSupabase JWT verify")))
    cells.append(edge(safe_id("box_FastAPI Gateway\nJWT validation\nRate limiting"), safe_id("box_documents\nProject + Draft CRUD")))
    cells.append(edge(safe_id("box_FastAPI Gateway\nJWT validation\nRate limiting"), safe_id("box_pdf_manager\nUpload + Parse")))
    cells.append(edge(safe_id("box_FastAPI Gateway\nJWT validation\nRate limiting"), safe_id("grp_AI Engines Module")))
    cells.append(edge(safe_id("box_FastAPI Gateway\nJWT validation\nRate limiting"), safe_id("grp_Margin Module")))

    cells.append(edge(safe_id("box_auth\nSupabase JWT verify"), safe_id("cyl_Supabase Auth")))
    cells.append(edge(safe_id("box_documents\nProject + Draft CRUD"), safe_id("cyl_Supabase Postgres\n+ pgvector")))
    cells.append(edge(safe_id("box_pdf_manager\nUpload + Parse"), safe_id("cyl_Object Storage\nRaw PDFs")))
    cells.append(edge(safe_id("box_pdf_manager\nUpload + Parse"), safe_id("box_chunker\nPDF to text chunks")))
    cells.append(edge(safe_id("box_chunker\nPDF to text chunks"), safe_id("box_embedder\nGemini text-embedding")))
    cells.append(edge(safe_id("box_embedder\nGemini text-embedding"), safe_id("cyl_Gemini API\nClassification\nEmbedding\nGeneration")))
    cells.append(edge(safe_id("box_embedder\nGemini text-embedding"), safe_id("cyl_Supabase Postgres\n+ pgvector")))
    cells.append(edge(safe_id("box_vector_search\npgvector cosine"), safe_id("cyl_Supabase Postgres\n+ pgvector")))

    cells.append(edge(safe_id("box_Interceptor\nLazy-prompt detector"), safe_id("box_AIService Interface")))
    cells.append(edge(safe_id("box_Socratic Spacer\nIdle ghost-question gen"), safe_id("box_AIService Interface")))
    cells.append(edge(safe_id("box_Citation Sentinel\nClaim verifier"), safe_id("box_AIService Interface")))
    cells.append(edge(safe_id("box_Structural Scaffold\nOutline generator"), safe_id("box_AIService Interface")))
    cells.append(edge(safe_id("box_Citation Sentinel\nClaim verifier"), safe_id("box_vector_search\npgvector cosine")))

    cells.append(edge(safe_id("box_AIService Interface"), safe_id("box_GeminiAdapter")))
    cells.append(edge(safe_id("box_GeminiAdapter"), safe_id("cyl_Gemini API\nClassification\nEmbedding\nGeneration")))
    cells.append(edge(safe_id("box_AIService Interface"), safe_id("box_PromptTemplate Registry\nversioned + behavior tags")))

    cells.append(edge(safe_id("box_Intervention Repository\nFull audit log"), safe_id("cyl_Supabase Postgres\n+ pgvector")))
    cells.append(edge(safe_id("box_SSE Push Service"), safe_id("box_SSE Client\nEventSource"), "SSE", dashed=True))

    return model(cells)


# ═══════════════════════════════════════════════════════════════════════════
# Diagram 3: Interceptor Sequence (faithful to 03_seq_interceptor.mmd)
# ═══════════════════════════════════════════════════════════════════════════
def gen_seq_interceptor():
    cells = []
    actors = ["U: Writer", "FE: React + Tiptap", "GW: FastAPI Gateway",
              "INT: Interceptor Engine", "AI: AIService (Gemini)",
              "DB: Postgres", "MR: Margin Repository"]
    ll = {}
    x = 40
    for a in actors:
        ll[a] = safe_id("ll_" + a)
        cells.append(lifeline_node(a, x, 40, 560))
        x += 150

    msgs = [
        ("U: Writer", "FE: React + Tiptap", "Types prompt:\nwrite a paragraph about X", 100, False),
        ("FE: React + Tiptap", "FE: React + Tiptap", "Detect delegative pattern\n(regex + heuristics)", 140, False),
        ("FE: React + Tiptap", "GW: FastAPI Gateway", "POST /interceptor\n{paragraph_context, prompt_text}", 180, False),
        ("GW: FastAPI Gateway", "GW: FastAPI Gateway", "Validate JWT + rate limit", 220, False),
        ("GW: FastAPI Gateway", "INT: Interceptor Engine", "classify_prompt()", 260, False),
        ("INT: Interceptor Engine", "AI: AIService (Gemini)", "classify via Gemini\n(behavior tag classifier)", 300, False),
        ("AI: AIService (Gemini)", "INT: Interceptor Engine", "{tag: delegative,\nconfidence: 0.92}", 340, True),
        ("INT: Interceptor Engine", "AI: AIService (Gemini)", "generate_socratic_reframing\n(prompt template: [Spark Gap])", 380, False),
        ("AI: AIService (Gemini)", "INT: Interceptor Engine", "What claim must your\nreader accept first?", 420, True),
        ("INT: Interceptor Engine", "MR: Margin Repository", "persist intervention\n(type=interceptor, status=active)", 460, False),
        ("MR: Margin Repository", "DB: Postgres", "INSERT intervention", 500, False),
        ("INT: Interceptor Engine", "GW: FastAPI Gateway", "{action: reframe,\nsocratic_question, intervention_id}", 540, True),
        ("GW: FastAPI Gateway", "FE: React + Tiptap", "200 OK + intervention payload", 580, True),
        ("FE: React + Tiptap", "FE: React + Tiptap", "Render ghost question in\nLiving Margin (NOT in body)", 620, False),
        ("FE: React + Tiptap", "U: Writer", "Margin displays:\nWhat claim must your\nreader accept first?", 660, True),
        ("U: Writer", "FE: React + Tiptap", "Writer types their own answer\n(original prose preserved)", 700, False),
    ]
    for src, dst, label, y, dashed in msgs:
        cells.append(seq_msg(ll[src], ll[dst], label, y, dashed))
    return model(cells)


# ═══════════════════════════════════════════════════════════════════════════
# Diagram 4: Citation Sentinel Sequence (faithful to 04_seq_citation.mmd)
# ═══════════════════════════════════════════════════════════════════════════
def gen_seq_citation():
    cells = []
    actors = ["U: Writer", "FE: React + Tiptap", "GW: FastAPI Gateway",
              "CIT: Citation Sentinel", "VS: Vector Search",
              "DB: Postgres + pgvector", "AI: AIService (Gemini)",
              "MR: Margin Repository"]
    ll = {}
    x = 20
    for a in actors:
        ll[a] = safe_id("ll_" + a)
        cells.append(lifeline_node(a, x, 40, 660))
        x += 140

    msgs = [
        ("U: Writer", "FE: React + Tiptap", "Selects paragraph + clicks Verify Claim", 100, False),
        ("FE: React + Tiptap", "GW: FastAPI Gateway", "POST /citation-sentinel/verify\n{project_id, paragraph_id, claim_text}", 140, False),
        ("GW: FastAPI Gateway", "GW: FastAPI Gateway", "JWT + rate limit", 180, False),
        ("GW: FastAPI Gateway", "CIT: Citation Sentinel", "verify_claim()", 220, False),
        ("CIT: Citation Sentinel", "CIT: Citation Sentinel", "Extract atomic claims\nfrom paragraph", 260, False),
        ("CIT: Citation Sentinel", "VS: Vector Search", "retrieve_top_k(claim_embedding, k=5)", 300, False),
        ("VS: Vector Search", "DB: Postgres + pgvector", "SELECT chunks ORDER BY\nembedding <=> claim_embedding LIMIT 5", 340, False),
        ("DB: Postgres + pgvector", "VS: Vector Search", "top 5 PDF chunks\nwith source metadata", 380, True),
        ("VS: Vector Search", "CIT: Citation Sentinel", "retrieved_evidence[]", 420, True),
        ("CIT: Citation Sentinel", "AI: AIService (Gemini)", "Verify claim against evidence\n(prompt template: [Lens])", 460, False),
        ("AI: AIService (Gemini)", "CIT: Citation Sentinel", "{verdict: partially_supported,\nsupported_claims, unsupported_claims,\ncitations: [chunk_ids]}", 500, True),
        ("CIT: Citation Sentinel", "MR: Margin Repository", "persist intervention\n(type=citation, verdict, citations)", 540, False),
        ("MR: Margin Repository", "DB: Postgres + pgvector", "INSERT intervention +\nintervention_evidence junction", 580, False),
        ("CIT: Citation Sentinel", "GW: FastAPI Gateway", "{verdict, citations, intervention_id}", 620, True),
        ("GW: FastAPI Gateway", "FE: React + Tiptap", "200 OK + verdict payload", 660, True),
        ("FE: React + Tiptap", "FE: React + Tiptap", "Render verdict card in Living Margin\nwith clickable chunk references", 700, False),
        ("FE: React + Tiptap", "U: Writer", "Margin shows:\nPartially Supported +\n3 source passages highlighted", 740, True),
        ("U: Writer", "FE: React + Tiptap", "Clicks source passage", 780, False),
        ("FE: React + Tiptap", "GW: FastAPI Gateway", "GET /pdfs/{pdf_id}/chunks/{chunk_id}", 820, False),
        ("GW: FastAPI Gateway", "FE: React + Tiptap", "chunk_text + page_number", 860, True),
        ("FE: React + Tiptap", "U: Writer", "Modal displays source passage", 900, True),
    ]
    for src, dst, label, y, dashed in msgs:
        cells.append(seq_msg(ll[src], ll[dst], label, y, dashed))
    return model(cells)


# ═══════════════════════════════════════════════════════════════════════════
# Diagram 5: Socratic Spacer Sequence (faithful to 05_seq_socratic.mmd)
# ═══════════════════════════════════════════════════════════════════════════
def gen_seq_socratic():
    cells = []
    actors = ["U: Writer", "FE: React + Tiptap", "ID: Idle Detector\n(frontend timer)",
              "GW: FastAPI Gateway", "SOC: Socratic Spacer Engine",
              "AI: AIService (Gemini)", "SSE: SSE Push Service",
              "DB: Postgres"]
    ll = {}
    x = 20
    for a in actors:
        ll[a] = safe_id("ll_" + a)
        cells.append(lifeline_node(a, x, 40, 760))
        x += 140

    msgs = [
        ("U: Writer", "FE: React + Tiptap", "(inactivity - no keystrokes)", 100, False),
        ("FE: React + Tiptap", "ID: Idle Detector\n(frontend timer)", "keystroke timer expires\n(threshold: 45s)", 140, False),
        ("ID: Idle Detector\n(frontend timer)", "FE: React + Tiptap", "emit idle event with\ncurrent paragraph context", 180, False),
        ("FE: React + Tiptap", "GW: FastAPI Gateway", "POST /socratic-spacer\n{project_id, paragraph_id,\nlast_text, cursor_position}", 220, False),
        ("GW: FastAPI Gateway", "GW: FastAPI Gateway", "JWT + rate limit", 260, False),
        ("GW: FastAPI Gateway", "SOC: Socratic Spacer Engine", "generate_ghost_question()", 300, False),
        ("SOC: Socratic Spacer Engine", "SOC: Socratic Spacer Engine", "Build context window\n(last 3 paragraphs +\ncurrent paragraph stub)", 340, False),
        ("SOC: Socratic Spacer Engine", "AI: AIService (Gemini)", "Generate Socratic question\n(prompt template: [Provocation])", 380, False),
        ("AI: AIService (Gemini)", "SOC: Socratic Spacer Engine", "What evidence would\nmake this claim false?", 420, True),
        ("SOC: Socratic Spacer Engine", "SSE: SSE Push Service", "push intervention\n(type=socratic, intervention_id)", 460, False),
        ("SOC: Socratic Spacer Engine", "DB: Postgres", "INSERT intervention\n(status=active)", 500, False),
        ("SSE: SSE Push Service", "FE: React + Tiptap", "SSE event:\nintervention payload", 540, True),
        ("FE: React + Tiptap", "FE: React + Tiptap", "Render ghost question\nin Living Margin (dimmed,\nnon-blocking)", 580, False),
        ("FE: React + Tiptap", "U: Writer", "Margin shows ghost question:\nWhat evidence would\nmake this claim false?", 620, True),
        # alt block: Writer engages
        ("U: Writer", "FE: React + Tiptap", "Clicks Explore this (engaged)", 660, False),
        ("FE: React + Tiptap", "GW: FastAPI Gateway", "PATCH /interventions/{id}\n{action: engaged}", 700, False),
        ("GW: FastAPI Gateway", "DB: Postgres", "UPDATE intervention\nSET user_action=engaged", 740, False),
        ("FE: React + Tiptap", "U: Writer", "Question promotes to\nprimary intervention card", 780, True),
        # alt block: Writer dismisses
        ("U: Writer", "FE: React + Tiptap", "Clicks Dismiss", 820, False),
        ("FE: React + Tiptap", "GW: FastAPI Gateway", "PATCH /interventions/{id}\n{action: dismissed}", 860, False),
        ("GW: FastAPI Gateway", "DB: Postgres", "UPDATE intervention\nSET user_action=dismissed", 900, False),
        ("FE: React + Tiptap", "U: Writer", "Margin clears ghost question", 940, True),
    ]
    for src, dst, label, y, dashed in msgs:
        cells.append(seq_msg(ll[src], ll[dst], label, y, dashed))
    return model(cells)


# ═══════════════════════════════════════════════════════════════════════════
# Diagram 6: ER Diagram (faithful to 06_er.mmd)
# ═══════════════════════════════════════════════════════════════════════════
def gen_er():
    cells = []
    entities = [
        ("User", 40, 40, 220, 140,
         ["id: uuid PK", "email: string UK", "display_name: string", "created_at: timestamp",
          "last_login: timestamp", "daily_token_budget: int"],
         []),
        ("Project", 340, 40, 220, 140,
         ["id: uuid PK", "user_id: uuid FK", "title: string", "description: string",
          "archived: boolean", "created_at: timestamp", "updated_at: timestamp"],
         []),
        ("Document", 640, 40, 220, 100,
         ["id: uuid PK", "project_id: uuid FK", "content: text",
          "tiptap_state: jsonb", "last_saved: timestamp"],
         []),
        ("Paragraph", 940, 40, 220, 120,
         ["id: uuid PK", "document_id: uuid FK", "order_index: int",
          "content: text", "created_at: timestamp", "updated_at: timestamp"],
         []),
        ("PDF", 40, 260, 220, 160,
         ["id: uuid PK", "project_id: uuid FK", "filename: string",
          "storage_path: string", "size_bytes: bigint", "mime_type: string",
          "page_count: int", "uploaded_at: timestamp", "parse_status: string"],
         []),
        ("PDF_Chunk", 340, 260, 220, 120,
         ["id: uuid PK", "pdf_id: uuid FK", "chunk_index: int",
          "content: text", "page_number: int", "char_count: int", "created_at: timestamp"],
         []),
        ("Embedding", 640, 260, 220, 100,
         ["id: uuid PK", "chunk_id: uuid FK", "embedding: vector",
          "model_version: string", "created_at: timestamp"],
         []),
        ("INTERVENTION", 40, 500, 280, 200,
         ["id: uuid PK", "user_id: uuid FK", "project_id: uuid FK",
          "paragraph_id: uuid FK", "prompt_template_id: uuid FK",
          "engine_type: string", "behavior_tag: string",
          "prompt_text: text", "response_text: text", "verdict: string",
          "status: string", "user_action: string",
          "created_at: timestamp", "resolved_at: timestamp"],
         []),
        ("INTERVENTION_EVIDENCE", 380, 500, 260, 100,
         ["id: uuid PK", "intervention_id: uuid FK", "chunk_id: uuid FK",
          "similarity_score: float", "cited_excerpt: text"],
         []),
        ("PROMPT_TEMPLATE", 700, 500, 260, 120,
         ["id: uuid PK", "behavior_tag: string", "name: string",
          "template: text", "model_id: string", "version: int",
          "active: boolean", "created_at: timestamp"],
         []),
        ("AI_PROVIDER_CONFIG", 700, 700, 260, 100,
         ["id: uuid PK", "user_id: uuid FK", "provider: string",
          "api_key_encrypted: string", "model_preferences: jsonb", "updated_at: timestamp"],
         []),
    ]

    ids = {}
    for name, x, y, w, h, fields, methods in entities:
        cells.append(class_node(name, x, y, w, h, fields))
        ids[name] = safe_id("cls_" + name)

    # Relationships (faithful to 06_er.mmd)
    rels = [
        ("User", "Project", "owns", "1", "N"),
        ("User", "INTERVENTION", "triggers", "1", "N"),
        ("User", "AI_PROVIDER_CONFIG", "configures", "1", "1"),
        ("Project", "Document", "contains", "1", "1"),
        ("Project", "PDF", "has", "1", "N"),
        ("Project", "INTERVENTION", "has", "1", "N"),
        ("Document", "Paragraph", "contains", "1", "N"),
        ("Paragraph", "INTERVENTION", "receives", "1", "N"),
        ("PDF", "PDF_Chunk", "parsed_into", "1", "N"),
        ("PDF_Chunk", "Embedding", "has", "1", "1"),
        ("PDF_Chunk", "INTERVENTION_EVIDENCE", "cited_in", "1", "N"),
        ("INTERVENTION", "INTERVENTION_EVIDENCE", "references", "1", "N"),
        ("PROMPT_TEMPLATE", "INTERVENTION", "generates", "1", "N"),
    ]
    for src, dst, label, card1, card2 in rels:
        cells.append(edge(ids[src], ids[dst], f"{card1}:{card2}  {label}", color="#354d59"))

    return model(cells)


# ═══════════════════════════════════════════════════════════════════════════
# Diagram 7: Class Diagram (faithful to 07_class.mmd)
# ═══════════════════════════════════════════════════════════════════════════
def gen_class_diagram():
    cells = []
    classes = [
        ("AIService", 40, 40, 280, 160,
         ["<<interface>>", "",
          "+ classify_prompt(text, context): ClassifyResult",
          "+ generate_socratic(tag, context): SocraticResponse",
          "+ verify_claim(claim, evidence): VerdictResult",
          "+ generate_embedding(text): Vector",
          "+ generate_scaffold(outline_type, context): ScaffoldResult"]),
        ("BaseAdapter", 40, 260, 280, 120,
         ["<<abstract>>", "",
          "# provider: str", "# api_key: str", "# model_map: dict",
          "+ call_api(method, payload): Response",
          "# track_tokens(used: int)",
          "# fallback_to_default_model()"]),
        ("GeminiAdapter", 380, 40, 280, 180,
         ["", "",
          "- gemini_client: GeminiSDK",
          "+ classify_prompt(text, context): ClassifyResult",
          "+ generate_socratic(tag, context): SocraticResponse",
          "+ verify_claim(claim, evidence): VerdictResult",
          "+ generate_embedding(text): Vector",
          "+ generate_scaffold(outline_type, context): ScaffoldResult",
          "- build_classification_prompt(text): str",
          "- build_verification_prompt(claim, evidence): str"]),
        ("OpenAIAdapter", 380, 280, 280, 120,
         ["", "",
          "- openai_client: OpenAISDK",
          "+ classify_prompt(text, context): ClassifyResult",
          "+ generate_socratic(tag, context): SocraticResponse",
          "+ verify_claim(claim, evidence): VerdictResult",
          "+ generate_embedding(text): Vector"]),
        ("LocalLLMAdapter", 380, 460, 280, 100,
         ["", "",
          "- model_path: str",
          "+ classify_prompt(text, context): ClassifyResult",
          "+ generate_socratic(tag, context): SocraticResponse",
          "+ verify_claim(claim, evidence): VerdictResult"]),
        ("PromptTemplateRegistry", 720, 40, 260, 120,
         ["", "",
          "- templates: dict",
          "+ get(behavior_tag): PromptTemplate",
          "+ register(template: PromptTemplate)",
          "+ activate(version: int)",
          "+ deactivate(version: int)"]),
        ("PromptTemplate", 720, 220, 260, 140,
         ["", "",
          "+ id: uuid", "+ behavior_tag: BehaviorTag", "+ name: str",
          "+ template: str", "+ model_id: str", "+ version: int",
          "+ active: bool", "+ render(context: dict): str"]),
        ("TokenBudget", 720, 420, 260, 120,
         ["", "",
          "+ daily_limit: int", "+ used_today: int", "+ reset_at: timestamp",
          "+ check_available(amount: int): bool",
          "+ consume(amount: int)", "+ reset()"]),
        ("BehaviorTag", 720, 600, 260, 100,
         ["<<enumeration>>", "",
          "PROVOCATION", "LENS_PERSPECTIVE",
          "STRUCTURAL_SCAFFOLD", "THE_SPARK_GAP"]),
        ("ClassifyResult", 1040, 40, 220, 80,
         ["", "",
          "+ tag: str", "+ confidence: float", "+ is_delegative: bool"]),
        ("VerdictResult", 1040, 180, 220, 100,
         ["", "",
          "+ verdict: str", "+ supported_claims: list",
          "+ unsupported_claims: list", "+ citations: list"]),
    ]

    ids = {}
    for name, x, y, w, h, fields in classes:
        cells.append(class_node(name, x, y, w, h, fields, fill="#e4e6e7", stroke="#226b90"))
        ids[name] = safe_id("cls_" + name)

    # Relationships (faithful to 07_class.mmd)
    # AIService <|.. BaseAdapter : implements
    cells.append(edge(ids["BaseAdapter"], ids["AIService"], "implements", dashed=True, color="#78716c", font_color="#78716c", arrow="open"))
    # BaseAdapter <|-- GeminiAdapter, OpenAIAdapter, LocalLLMAdapter
    cells.append(edge(ids["GeminiAdapter"], ids["BaseAdapter"], "extends", color="#354d59", arrow="open"))
    cells.append(edge(ids["OpenAIAdapter"], ids["BaseAdapter"], "extends", color="#354d59", arrow="open"))
    cells.append(edge(ids["LocalLLMAdapter"], ids["BaseAdapter"], "extends", color="#354d59", arrow="open"))
    # BaseAdapter o-- PromptTemplateRegistry : uses
    cells.append(edge(ids["BaseAdapter"], ids["PromptTemplateRegistry"], "uses", color="#354d59"))
    # BaseAdapter o-- TokenBudget : tracks
    cells.append(edge(ids["BaseAdapter"], ids["TokenBudget"], "tracks", color="#354d59"))
    # PromptTemplateRegistry o-- PromptTemplate : manages
    cells.append(edge(ids["PromptTemplateRegistry"], ids["PromptTemplate"], "manages", color="#354d59"))
    # PromptTemplate --> BehaviorTag : tagged with
    cells.append(edge(ids["PromptTemplate"], ids["BehaviorTag"], "tagged with", color="#354d59", arrow="open"))
    # GeminiAdapter ..> ClassifyResult : produces
    cells.append(edge(ids["GeminiAdapter"], ids["ClassifyResult"], "produces", dashed=True, color="#78716c", font_color="#78716c", arrow="open"))
    # GeminiAdapter ..> VerdictResult : produces
    cells.append(edge(ids["GeminiAdapter"], ids["VerdictResult"], "produces", dashed=True, color="#78716c", font_color="#78716c", arrow="open"))

    return model(cells)


# ═══════════════════════════════════════════════════════════════════════════
# Diagram 8: Writing Loop (faithful to 08_writing_loop.mmd)
# ═══════════════════════════════════════════════════════════════════════════
def gen_writing_loop():
    cells = []
    # Nodes (left to right flow)
    cells.append(box_node("Writer types\na sentence", 20, 200, 140, 60, fill="#EFF6FF", stroke="#226b90", bold=True))
    cells.append(diamond_node(". ? !\nsentence complete", 220, 200, 140, 70))
    cells.append(diamond_node("Cogdoc analyzes\nthe sentence", 420, 200, 140, 70))
    cells.append(diamond_node("Which engines\nshould fire?", 620, 200, 140, 70))

    # Engine branches
    cells.append(box_node("Socrates\nchallenges vagueness", 840, 60, 200, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box_node("Galileo\nverifies claim", 840, 130, 200, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box_node("Diogenes\nprovokes thinking", 840, 200, 200, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box_node("Aristotle\noffers scaffold", 840, 270, 200, 50, fill="#FFF7ED", stroke="#be6a4e"))

    cells.append(box_node("Sentence gets\ncolored underline", 1100, 170, 160, 60, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box_node("Writer hovers", 1320, 180, 120, 50, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box_node("Actionable insights\nFind sources / Rewrite / Answer", 1500, 160, 220, 80, fill="#EFF6FF", stroke="#226b90", bold=True))

    # IDs
    b_write = safe_id("box_Writer types\na sentence")
    d_dot = safe_id("dia_. ? !\nsentence complete")
    d_analyze = safe_id("dia_Cogdoc analyzes\nthe sentence")
    d_fire = safe_id("dia_Which engines\nshould fire?")
    b_soc = safe_id("box_Socrates\nchallenges vagueness")
    b_gal = safe_id("box_Galileo\nverifies claim")
    b_dio = safe_id("box_Diogenes\nprovokes thinking")
    b_ari = safe_id("box_Aristotle\noffers scaffold")
    b_underline = safe_id("box_Sentence gets\ncolored underline")
    b_hover = safe_id("box_Writer hovers")
    b_actions = safe_id("box_Actionable insights\nFind sources / Rewrite / Answer")

    # Edges
    cells.append(edge(b_write, d_dot, "", arrow="open"))
    cells.append(edge(d_dot, d_analyze, "", arrow="open"))
    cells.append(edge(d_analyze, d_fire, "", arrow="open"))
    cells.append(edge(d_fire, b_soc, "vague language", color="#be6a4e", font_color="#be6a4e", arrow="open"))
    cells.append(edge(d_fire, b_gal, "factual claim", color="#be6a4e", font_color="#be6a4e", arrow="open"))
    cells.append(edge(d_fire, b_dio, "idle pause", color="#be6a4e", font_color="#be6a4e", arrow="open"))
    cells.append(edge(d_fire, b_ari, "long sentence", color="#be6a4e", font_color="#be6a4e", arrow="open"))
    for engine in [b_soc, b_gal, b_dio, b_ari]:
        cells.append(edge(engine, b_underline, "", arrow="open"))
    cells.append(edge(b_underline, b_hover, "", arrow="open"))
    cells.append(edge(b_hover, b_actions, "", arrow="open"))
    # Loop back
    cells.append(edge(b_actions, b_write, "", color="#78716c", dashed=True))

    return model(cells)


# ═══════════════════════════════════════════════════════════════════════════
# Diagram 9: Simple Use Case (faithful to 01_usecase_simple.dot)
# ═══════════════════════════════════════════════════════════════════════════
def gen_use_case_simple():
    cells = []
    cells.append(actor_node("Writer", 20, 300))
    cells.append(actor_node("LLM API", 980, 180, color="#be6a4e"))
    cells.append(actor_node("Web Search", 980, 420, color="#be6a4e"))
    cells.append(container_node("Cogdoc System", 140, 40, 800, 580, fill="#f5f8fb", stroke="#354d59"))
    cells.append(ellipse_node("Create Project", 200, 80))
    cells.append(ellipse_node("Write Draft", 200, 170))
    cells.append(ellipse_node("Upload Sources\n(PDF / Text)", 190, 260, w=170))
    cells.append(ellipse_node("Find Sources\nOnline", 190, 350, w=170, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(ellipse_node("View Intervention\n(hover underline)", 440, 80, w=180))
    cells.append(ellipse_node("Take Action\n(Rewrite / Find / Answer)", 430, 170, w=200, h=70))
    cells.append(ellipse_node("Export Draft\n(MD / TXT / HTML)", 440, 260, w=180))
    cells.append(ellipse_node("View Stats &\nHistory", 440, 350, w=160))
    cells.append(ellipse_node("AI Engines Analyze\nSentence\nSocrates - Diogenes\nGalileo - Aristotle", 420, 450, w=240, h=100, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(ellipse_node("Verify Claim\nagainst Library", 720, 200, w=160, fill="#d1fae5", stroke="#059669"))

    w_id = safe_id("actor_Writer")
    llm_id = safe_id("actor_LLM API")
    web_id = safe_id("actor_Web Search")
    uc_write = safe_id("uc_Write Draft")
    uc_find = safe_id("uc_Find Sources\nOnline")
    uc_view = safe_id("uc_View Intervention\n(hover underline)")
    uc_act = safe_id("uc_Take Action\n(Rewrite / Find / Answer)")
    uc_engines = safe_id("uc_AI Engines Analyze\nSentence\nSocrates - Diogenes\nGalileo - Aristotle")
    uc_verify = safe_id("uc_Verify Claim\nagainst Library")

    for uc in ["Create Project", "Write Draft", "Upload Sources\n(PDF / Text)",
               "Find Sources\nOnline", "View Intervention\n(hover underline)",
               "Export Draft\n(MD / TXT / HTML)", "View Stats &\nHistory"]:
        cells.append(edge(w_id, safe_id("uc_" + uc)))

    cells.append(edge(uc_write, uc_engines, "<<include>>", dashed=True, color="#78716c", font_color="#78716c"))
    cells.append(edge(uc_find, uc_engines, "<<include>>", dashed=True, color="#78716c", font_color="#78716c"))
    cells.append(edge(uc_verify, uc_view, "<<extend>>", dashed=True, color="#78716c", font_color="#78716c"))
    cells.append(edge(uc_act, uc_view, "<<extend>>", dashed=True, color="#78716c", font_color="#78716c"))
    cells.append(edge(uc_engines, llm_id, "chat", dashed=True, color="#be6a4e", font_color="#be6a4e"))
    cells.append(edge(uc_find, web_id, "search", dashed=True, color="#be6a4e", font_color="#be6a4e"))
    cells.append(edge(uc_verify, llm_id, "verify", dashed=True, color="#be6a4e", font_color="#be6a4e"))

    return model(cells)


# ═══════════════════════════════════════════════════════════════════════════
# Diagram 10: Simple Architecture (faithful to 02_architecture_simple.mmd)
# ═══════════════════════════════════════════════════════════════════════════
def gen_architecture_simple():
    cells = []
    # Browser
    cells.append(container_node("Browser", 40, 40, 920, 160, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box_node("Notebook Editor\ncontenteditable + auto-save", 80, 90, 260, 70, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box_node("Underlined Sentences\nhover to see popover", 380, 90, 240, 70, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box_node("Pixelated Pets\nanimate when engines fire", 660, 90, 260, 70, fill="#EFF6FF", stroke="#226b90"))

    # App
    cells.append(container_node("Next.js App - Single Deployable", 40, 240, 920, 320, fill="#f5f8fb", stroke="#354d59"))
    cells.append(box_node("Content Analyzer\nclassifies each sentence\nroutes to engines", 80, 290, 220, 70, fill="#f5f8fb", stroke="#354d59"))
    cells.append(box_node("Find Sources\nweb search + add to library", 80, 380, 220, 60, fill="#f5f8fb", stroke="#354d59"))
    cells.append(box_node("AI Service\nprovider abstraction", 80, 460, 220, 60, fill="#f5f8fb", stroke="#354d59"))

    cells.append(container_node("4 AI Engines", 360, 270, 560, 100, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box_node("Diogenes\nSocratic", 390, 300, 120, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box_node("Socrates\nInterceptor", 530, 300, 120, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box_node("Galileo\nCitation", 670, 300, 120, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box_node("Aristotle\nScaffold", 810, 300, 120, 50, fill="#FFF7ED", stroke="#be6a4e"))

    cells.append(container_node("External Services", 40, 600, 920, 120, fill="#f1f5f9", stroke="#475569"))
    cells.append(cylinder_node("Database\nSQLite / Postgres", 100, 630, 200, 70, fill="#f1f5f9", stroke="#475569"))
    cells.append(cylinder_node("LLM API\nGemini / Groq / OpenAI", 400, 630, 220, 70, fill="#f1f5f9", stroke="#475569"))
    cells.append(cylinder_node("Web Search\n+ Page Reader", 720, 630, 200, 70, fill="#f1f5f9", stroke="#475569"))

    b_editor = safe_id("box_Notebook Editor\ncontenteditable + auto-save")
    b_analyzer = safe_id("box_Content Analyzer\nclassifies each sentence\nroutes to engines")
    b_pets = safe_id("box_Pixelated Pets\nanimate when engines fire")
    g_engines = safe_id("grp_4 AI Engines")
    b_find = safe_id("box_Find Sources\nweb search + add to library")
    b_ai = safe_id("box_AI Service\nprovider abstraction")
    c_llm = safe_id("cyl_LLM API\nGemini / Groq / OpenAI")
    c_web = safe_id("cyl_Web Search\n+ Page Reader")

    cells.append(edge(b_editor, b_analyzer, "sentence completed"))
    cells.append(edge(b_pets, g_engines, "engine fired", dashed=True))
    cells.append(edge(b_ai, c_llm, "chat"))
    cells.append(edge(b_find, c_web, "find evidence"))

    return model(cells)


# ═══════════════════════════════════════════════════════════════════════════
# Generate all
# ═══════════════════════════════════════════════════════════════════════════

diagrams = [
    ("Use Case Diagram", gen_use_case()),
    ("System Architecture", gen_architecture()),
    ("Interceptor Sequence", gen_seq_interceptor()),
    ("Citation Sentinel Sequence", gen_seq_citation()),
    ("Socratic Spacer Sequence", gen_seq_socratic()),
    ("ER Diagram", gen_er()),
    ("AI Service Class Diagram", gen_class_diagram()),
    ("Writing Loop", gen_writing_loop()),
    ("Use Case (Simple)", gen_use_case_simple()),
    ("Architecture (Simple)", gen_architecture_simple()),
]

# Write individual files
for name, xml in diagrams:
    fname = name.lower().replace(" ", "_").replace("(", "").replace(")", "") + ".drawio"
    fpath = os.path.join(OUT_DIR, fname)
    content = mxfile([{"name": name, "xml": xml}])
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Wrote {fname}")

# Write combined file with all diagrams as tabs
combined = mxfile([{"name": d[0], "xml": d[1], "id": str(i)} for i, d in enumerate(diagrams)])
combined_path = os.path.join(OUT_DIR, "ALL_DIAGRAMS.drawio")
with open(combined_path, "w", encoding="utf-8") as f:
    f.write(combined)
print(f"  Wrote ALL_DIAGRAMS.drawio ({len(diagrams)} tabs)")

# Copy generator script
import shutil
shutil.copy(__file__, os.path.join(OUT_DIR, "gen_drawio.py"))

print(f"\nDone. {len(diagrams) + 1} files written to {OUT_DIR}")
