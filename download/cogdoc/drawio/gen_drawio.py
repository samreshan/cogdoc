"""
Generate draw.io (.drawio) compatible XML files for all Cogdoc diagrams.

Draw.io uses mxGraph XML format. Each file is a standalone .drawio file
that can be opened directly in draw.io (web or desktop).

Diagrams generated:
  1. use_case.drawio        — Use Case diagram with stickman actors
  2. architecture.drawio    — Simplified system architecture
  3. writing_loop.drawio    — Writing loop flow
  4. er.drawio              — Entity-Relationship diagram
  5. sequence_interceptor.drawio
  6. sequence_citation.drawio
  7. sequence_socratic.drawio
  8. class_diagram.drawio   — AI Service class diagram
"""

import os
from xml.sax.saxutils import escape, quoteattr

OUT_DIR = "/home/z/my-project/download/cogdoc/drawio"
os.makedirs(OUT_DIR, exist_ok=True)

def esc(s: str) -> str:
    """Properly escape a string for XML attribute or text content."""
    return escape(s, {'"': '&quot;', "'": '&apos;'})

# ── Helpers ────────────────────────────────────────────────────────────────

def mxfile(diagrams: list[dict]) -> str:
    """Build a complete .drawio mxfile XML string.
    diagrams: list of {name, xml} dicts.
    """
    pages = []
    for d in diagrams:
        pages.append(f'<diagram name="{escape(d["name"])}" id="{d.get("id", d["name"].replace(" ", "_"))}">{d["xml"]}</diagram>')
    return f'<mxfile host="app.diagrams.net" modified="2026-07-02T00:00:00.000Z" agent="Cogdoc" version="24.0.0" type="device">\n{"\n".join(pages)}\n</mxfile>'

def model(cells: list[str]) -> str:
    """Wrap cells in an mxGraphModel."""
    return f'<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="826" math="0" shadow="0">\n<root>\n<mxCell id="0"/>\n<mxCell id="1" parent="0"/>\n{"\n".join(cells)}\n</root>\n</mxGraphModel>'

def safe_id(s: str) -> str:
    """Make a string safe for use as an XML ID (alphanumeric + underscore only)."""
    return ''.join(c if c.isalnum() else '_' for c in s)

def actor(name: str, x: int, y: int, color: str = "#226b90") -> str:
    """Stickman actor (UML use case)."""
    sid = safe_id("actor_" + name)
    return f'''<mxCell id="{sid}" value="{esc(name)}" style="shape=umlActor;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;verticalAlign=top;html=1;outlineConnect=0;fontSize=12;fontColor={color};strokeColor={color};fillColor=#ffffff;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="30" height="60" as="geometry"/></mxCell>'''

def usecase(name: str, x: int, y: int, w: int = 140, h: int = 60, fill: str = "#EFF6FF", stroke: str = "#226b90") -> str:
    """Use case ellipse."""
    sid = safe_id("uc_" + name)
    val = esc(name.replace("\n", "&#xa;"))
    return f'''<mxCell id="{sid}" value="{val}" style="ellipse;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};fontSize=11;fontColor=#181a1b;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'''

def box(name: str, x: int, y: int, w: int = 160, h: int = 60, fill: str = "#f5f8fb", stroke: str = "#354d59", rounded: bool = True, bold: bool = False) -> str:
    """Rectangular box."""
    r = "rounded=1;" if rounded else "rounded=0;"
    fw = "1" if bold else "0"
    sid = safe_id("box_" + name)
    val = esc(name.replace("\n", "&#xa;"))
    return f'''<mxCell id="{sid}" value="{val}" style="{r}whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};fontSize=11;fontColor=#181a1b;fontStyle={fw};" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'''

def cylinder(name: str, x: int, y: int, w: int = 140, h: int = 70, fill: str = "#f1f5f9", stroke: str = "#475569") -> str:
    """Database cylinder."""
    sid = safe_id("cyl_" + name)
    val = esc(name.replace("\n", "&#xa;"))
    return f'''<mxCell id="{sid}" value="{val}" style="shape=cylinder3;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};fontSize=11;fontColor=#181a1b;size=10;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'''

def edge(src: str, dst: str, label: str = "", style: str = "solid", color: str = "#354d59", dashed: bool = False) -> str:
    """Edge between two cells by ID."""
    d = "1" if dashed else "0"
    s = "edgeStyle=orthogonalEdgeStyle;" if style == "orthogonal" else ""
    lbl = esc(label) if label else ""
    eid = safe_id(f"edge_{src}_{dst}_{label}")
    return f'''<mxCell id="{eid}" value="{lbl}" style="{s}html=1;strokeColor={color};dashed={d};fontSize=9;fontColor={color};endArrow=none;" edge="1" parent="1" source="{src}" target="{dst}"><mxGeometry relative="1" as="geometry"/></mxCell>'''

def edge_arrow(src: str, dst: str, label: str = "", color: str = "#354d59", dashed: bool = False) -> str:
    """Edge with arrowhead."""
    d = "1" if dashed else "0"
    lbl = esc(label) if label else ""
    eid = safe_id(f"edge_{src}_{dst}_{label}")
    return f'''<mxCell id="{eid}" value="{lbl}" style="edgeStyle=orthogonalEdgeStyle;html=1;strokeColor={color};dashed={d};fontSize=9;fontColor={color};endArrow=open;endFill=0;" edge="1" parent="1" source="{src}" target="{dst}"><mxGeometry relative="1" as="geometry"/></mxCell>'''

def container(name: str, x: int, y: int, w: int, h: int, fill: str = "#faf7f0", stroke: str = "#78716c") -> str:
    """Container/group box."""
    sid = safe_id("grp_" + name)
    val = esc(name)
    return f'''<mxCell id="{sid}" value="{val}" style="rounded=1;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};fontSize=13;fontColor=#181a1b;fontStyle=1;verticalAlign=top;align=left;spacingLeft=10;spacingTop=8;dashed=0;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'''

def lifeline(name: str, x: int, y: int, h: int = 400) -> str:
    """Sequence diagram lifeline."""
    sid = safe_id("ll_" + name)
    val = esc(name)
    return f'''<mxCell id="{sid}" value="{val}" style="shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=0;collapsible=0;recursiveResize=0;outlineConnect=0;size=40;fillColor=#EFF6FF;strokeColor=#226b90;fontSize=11;fontColor=#181a1b;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="120" height="{h}" as="geometry"/></mxCell>'''

def seq_msg(src: str, dst: str, label: str, y: int, dashed: bool = False, color: str = "#354d59") -> str:
    """Sequence diagram message."""
    d = "1" if dashed else "0"
    arrow = "open" if dashed else "block"
    eid = safe_id(f"msg_{src}_{dst}_{label}_{y}")
    return f'''<mxCell id="{eid}" value="{esc(label)}" style="html=1;strokeColor={color};dashed={d};fontSize=9;fontColor={color};endArrow={arrow};endFill=0;" edge="1" parent="1" source="{src}" target="{dst}"><mxGeometry relative="1" as="geometry"><mxPoint x="0" y="{y}" as="sourcePoint"/><mxPoint x="0" y="{y}" as="targetPoint"/></mxGeometry></mxCell>'''

def class_box(name: str, x: int, y: int, w: int, h: int, attrs: list[str] = [], methods: list[str] = []) -> str:
    """UML class box."""
    sid = safe_id("cls_" + name)
    # Use &lt;br&gt; (escaped) inside attribute value — draw.io renders it as <br>
    br = "&lt;br&gt;"
    lines = [esc(name)]
    if attrs:
        lines.append("- " + f"{br}- ".join(esc(a) for a in attrs))
    if methods:
        lines.append("+ " + f"{br}+ ".join(esc(m) for m in methods))
    val = f"{br}{br}".join(lines)
    return f'''<mxCell id="{sid}" value="{val}" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;collapsible=1;marginBottom=0;fillColor=#f5f8fb;strokeColor=#354d59;fontSize=11;fontColor=#181a1b;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'''

# ═══════════════════════════════════════════════════════════════════════════
# Diagram 1: Use Case
# ═══════════════════════════════════════════════════════════════════════════
def gen_use_case() -> str:
    cells = []
    # Actor IDs
    w_id = safe_id("actor_Writer")
    llm_id = safe_id("actor_LLM API")
    web_id = safe_id("actor_Web Search")
    # Use case IDs
    uc_create = safe_id("uc_Create Project")
    uc_write = safe_id("uc_Write Draft")
    uc_upload = safe_id("uc_Upload Sources\n(PDF / Text)")
    uc_find = safe_id("uc_Find Sources\nOnline")
    uc_view = safe_id("uc_View Intervention\n(hover underline)")
    uc_act = safe_id("uc_Take Action\n(Rewrite / Find / Answer)")
    uc_export = safe_id("uc_Export Draft\n(MD / TXT / HTML)")
    uc_stats = safe_id("uc_View Stats\n& History")
    uc_engines = safe_id("uc_AI Engines Analyze\nSentence\nSocrates - Diogenes\nGalileo - Aristotle")
    uc_verify = safe_id("uc_Verify Claim\nagainst Library")

    cells.append(actor("Writer", 40, 350))
    cells.append(actor("LLM API", 980, 200, color="#be6a4e"))
    cells.append(actor("Web Search", 980, 450, color="#be6a4e"))
    cells.append(container("Cogdoc System", 180, 60, 760, 620, fill="#f5f8fb", stroke="#354d59"))
    cells.append(usecase("Create Project", 240, 100))
    cells.append(usecase("Write Draft", 240, 200))
    cells.append(usecase("Upload Sources\n(PDF / Text)", 240, 300))
    cells.append(usecase("Find Sources\nOnline", 240, 400, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(usecase("View Intervention\n(hover underline)", 500, 100))
    cells.append(usecase("Take Action\n(Rewrite / Find / Answer)", 500, 200))
    cells.append(usecase("Export Draft\n(MD / TXT / HTML)", 500, 300))
    cells.append(usecase("View Stats\n& History", 500, 400))
    cells.append(usecase("AI Engines Analyze\nSentence\nSocrates - Diogenes\nGalileo - Aristotle", 500, 500, w=200, h=90, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(usecase("Verify Claim\nagainst Library", 760, 250, fill="#d1fae5", stroke="#059669"))
    # Writer associations
    for uc in [uc_create, uc_write, uc_upload, uc_find, uc_view, uc_export, uc_stats]:
        cells.append(edge(w_id, uc))
    # Includes
    cells.append(edge(uc_write, uc_engines, "&lt;&lt;include&gt;&gt;", dashed=True, color="#78716c"))
    cells.append(edge(uc_find, uc_engines, "&lt;&lt;include&gt;&gt;", dashed=True, color="#78716c"))
    # Extends
    cells.append(edge(uc_verify, uc_view, "&lt;&lt;extend&gt;&gt;", dashed=True, color="#78716c"))
    cells.append(edge(uc_act, uc_view, "&lt;&lt;extend&gt;&gt;", dashed=True, color="#78716c"))
    # External
    cells.append(edge(uc_engines, llm_id, "chat", dashed=True, color="#be6a4e"))
    cells.append(edge(uc_find, web_id, "search", dashed=True, color="#be6a4e"))
    cells.append(edge(uc_verify, llm_id, "verify", dashed=True, color="#be6a4e"))
    return model(cells)

# ═══════════════════════════════════════════════════════════════════════════
# Diagram 2: Architecture
# ═══════════════════════════════════════════════════════════════════════════
def gen_architecture() -> str:
    cells = []
    # IDs
    b_editor = safe_id("box_Notebook Editor\n(contenteditable + auto-save)")
    b_analyzer = safe_id("box_Content Analyzer\nclassifies each sentence\nroutes to engines")
    b_pets = safe_id("box_Pixelated Pets\n(animate when engines fire)")
    g_engines = safe_id("grp_4 AI Engines")
    b_find = safe_id("box_Find Sources\nweb search + add to library")
    b_ai = safe_id("box_AI Service\nprovider abstraction")
    c_db = safe_id("cyl_Database\nSQLite / Postgres")
    c_llm = safe_id("cyl_LLM API\nGemini / Groq / OpenAI")
    c_web = safe_id("cyl_Web Search\n+ Page Reader")

    cells.append(container("Browser", 40, 40, 920, 140, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box("Notebook Editor\n(contenteditable + auto-save)", 80, 80, 240, 70, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box("Underlined Sentences\n(hover to see popover)", 350, 80, 240, 70, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box("Pixelated Pets\n(animate when engines fire)", 620, 80, 280, 70, fill="#EFF6FF", stroke="#226b90"))
    cells.append(container("Next.js App - Single Deployable", 40, 220, 920, 320, fill="#f5f8fb", stroke="#354d59"))
    cells.append(box("Content Analyzer\nclassifies each sentence\nroutes to engines", 80, 270, 200, 70, fill="#f5f8fb", stroke="#354d59"))
    cells.append(box("Find Sources\nweb search + add to library", 80, 370, 200, 70, fill="#f5f8fb", stroke="#354d59"))
    cells.append(box("AI Service\nprovider abstraction", 80, 450, 200, 60, fill="#f5f8fb", stroke="#354d59"))
    cells.append(container("4 AI Engines", 340, 240, 620, 90, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box("Diogenes\n(Socratic)", 360, 260, 130, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box("Socrates\n(Interceptor)", 510, 260, 130, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box("Galileo\n(Citation)", 660, 260, 130, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box("Aristotle\n(Scaffold)", 810, 260, 130, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(container("External Services", 40, 580, 920, 120, fill="#f1f5f9", stroke="#475569"))
    cells.append(cylinder("Database\nSQLite / Postgres", 100, 600, 180, 80, fill="#f1f5f9", stroke="#475569"))
    cells.append(cylinder("LLM API\nGemini / Groq / OpenAI", 400, 600, 200, 80, fill="#f1f5f9", stroke="#475569"))
    cells.append(cylinder("Web Search\n+ Page Reader", 720, 600, 200, 80, fill="#f1f5f9", stroke="#475569"))
    cells.append(edge(b_editor, b_analyzer, "sentence completed"))
    cells.append(edge(b_pets, g_engines, "engine fired", dashed=True))
    cells.append(edge(b_ai, c_llm, "chat"))
    cells.append(edge(b_find, c_web, "find evidence"))
    return model(cells)

# ═══════════════════════════════════════════════════════════════════════════
# Diagram 3: Writing Loop
# ═══════════════════════════════════════════════════════════════════════════
def gen_writing_loop() -> str:
    cells = []
    # IDs
    b_write = safe_id("box_Writer types\na sentence")
    b_dot = safe_id("box_. ? !\nsentence complete")
    b_analyze = safe_id("box_Cogdoc analyzes\nthe sentence")
    b_fire = safe_id("box_Which engines\nshould fire?")
    b_soc = safe_id("box_Socrates\nchallenges vagueness")
    b_gal = safe_id("box_Galileo\nverifies claim")
    b_dio = safe_id("box_Diogenes\nprovokes thinking")
    b_ari = safe_id("box_Aristotle\noffers scaffold")
    b_underline = safe_id("box_Sentence gets\ncolored underline")
    b_hover = safe_id("box_Writer hovers")
    b_actions = safe_id("box_Actionable insights\nFind sources / Rewrite / Answer")

    cells.append(box("Writer types\na sentence", 40, 200, 140, 60, fill="#EFF6FF", stroke="#226b90", bold=True))
    cells.append(box(". ? !\nsentence complete", 240, 200, 140, 60, fill="#FEF3C7", stroke="#92400e"))
    cells.append(box("Cogdoc analyzes\nthe sentence", 440, 200, 140, 60, fill="#FEF3C7", stroke="#92400e"))
    cells.append(box("Which engines\nshould fire?", 640, 200, 140, 60, fill="#FEF3C7", stroke="#92400e", bold=True))
    cells.append(box("Socrates\nchallenges vagueness", 880, 80, 180, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box("Galileo\nverifies claim", 880, 150, 180, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box("Diogenes\nprovokes thinking", 880, 220, 180, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box("Aristotle\noffers scaffold", 880, 290, 180, 50, fill="#FFF7ED", stroke="#be6a4e"))
    cells.append(box("Sentence gets\ncolored underline", 1120, 180, 160, 60, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box("Writer hovers", 1340, 180, 120, 60, fill="#EFF6FF", stroke="#226b90"))
    cells.append(box("Actionable insights\nFind sources / Rewrite / Answer", 1520, 170, 220, 80, fill="#EFF6FF", stroke="#226b90", bold=True))
    cells.append(edge_arrow(b_write, b_dot))
    cells.append(edge_arrow(b_dot, b_analyze))
    cells.append(edge_arrow(b_analyze, b_fire))
    cells.append(edge_arrow(b_fire, b_soc, "vague language", color="#be6a4e"))
    cells.append(edge_arrow(b_fire, b_gal, "factual claim", color="#be6a4e"))
    cells.append(edge_arrow(b_fire, b_dio, "idle pause", color="#be6a4e"))
    cells.append(edge_arrow(b_fire, b_ari, "long sentence", color="#be6a4e"))
    for engine in [b_soc, b_gal, b_dio, b_ari]:
        cells.append(edge_arrow(engine, b_underline))
    cells.append(edge_arrow(b_underline, b_hover))
    cells.append(edge_arrow(b_hover, b_actions))
    cells.append(edge(b_actions, b_write, "", color="#78716c", dashed=True))
    return model(cells)

# ═══════════════════════════════════════════════════════════════════════════
# Diagram 4: ER Diagram
# ═══════════════════════════════════════════════════════════════════════════
def gen_er() -> str:
    cells = []
    entities = [
        ("User", 40, 40, ["id: uuid PK", "email: str UK", "displayName: str?", "dailyTokenBudget: int", "createdAt: datetime", "lastLogin: datetime?"]),
        ("Project", 280, 40, ["id: uuid PK", "userId: uuid FK", "title: str", "description: str?", "archived: bool", "createdAt: datetime", "updatedAt: datetime"]),
        ("Document", 520, 40, ["id: uuid PK", "projectId: uuid FK", "content: text", "lastSaved: datetime"]),
        ("Pdf", 760, 40, ["id: uuid PK", "projectId: uuid FK", "userId: uuid FK", "filename: str", "rawText: text", "sizeBytes: int", "parseStatus: str", "uploadedAt: datetime"]),
        ("PdfChunk", 760, 320, ["id: uuid PK", "pdfId: uuid FK", "chunkIndex: int", "content: text", "charCount: int", "pageApprox: int", "createdAt: datetime"]),
        ("Intervention", 40, 320, ["id: uuid PK", "userId: uuid FK", "projectId: uuid FK", "paragraphId: str?", "promptTemplateTag: str?", "engineType: str", "promptText: text?", "responseText: text?", "verdict: str?", "status: str", "userAction: str?", "createdAt: datetime", "resolvedAt: datetime?"]),
        ("InterventionEvidence", 340, 320, ["id: uuid PK", "interventionId: uuid FK", "chunkId: uuid FK", "similarityScore: float", "citedExcerpt: text"]),
        ("PromptTemplate", 40, 600, ["id: uuid PK", "behaviorTag: str UK", "name: str", "template: text", "modelId: str", "version: int", "active: bool", "createdAt: datetime"]),
    ]
    ids = {}
    for name, x, y, attrs in entities:
        cells.append(class_box(name, x, y, 220, 30 + len(attrs) * 18, attrs=attrs, methods=[]))
        ids[name] = safe_id("cls_" + name)
    cells.append(edge(ids["User"], ids["Project"], "1:N"))
    cells.append(edge(ids["User"], ids["Intervention"], "1:N"))
    cells.append(edge(ids["Project"], ids["Document"], "1:1"))
    cells.append(edge(ids["Project"], ids["Pdf"], "1:N"))
    cells.append(edge(ids["Project"], ids["Intervention"], "1:N"))
    cells.append(edge(ids["Pdf"], ids["PdfChunk"], "1:N"))
    cells.append(edge(ids["Intervention"], ids["InterventionEvidence"], "1:N"))
    cells.append(edge(ids["PdfChunk"], ids["InterventionEvidence"], "1:N"))
    cells.append(edge(ids["PromptTemplate"], ids["Intervention"], "1:N"))
    return model(cells)

# ═══════════════════════════════════════════════════════════════════════════
# Diagram 5: Interceptor Sequence
# ═══════════════════════════════════════════════════════════════════════════
def gen_seq_interceptor() -> str:
    cells = []
    ll = {n: safe_id("ll_" + n) for n in ["Writer", "Editor", "Content Analyzer", "Socrates (Interceptor)", "LLM API", "Database"]}
    cells.append(lifeline("Writer", 40, 40, 500))
    cells.append(lifeline("Editor", 200, 40, 500))
    cells.append(lifeline("Content Analyzer", 360, 40, 500))
    cells.append(lifeline("Socrates (Interceptor)", 520, 40, 500))
    cells.append(lifeline("LLM API", 680, 40, 500))
    cells.append(lifeline("Database", 820, 40, 500))
    msgs = [
        ("Writer", "Editor", "Types sentence ending in .", 100, False),
        ("Editor", "Content Analyzer", "extractLastSentence()", 140, False),
        ("Content Analyzer", "Socrates (Interceptor)", "classifySentence()", 180, False),
        ("Socrates (Interceptor)", "LLM API", "isDelegative?", 220, False),
        ("LLM API", "Socrates (Interceptor)", "yes (confidence 0.9)", 260, True),
        ("Socrates (Interceptor)", "LLM API", "generateSocratic([Spark Gap])", 300, False),
        ("LLM API", "Socrates (Interceptor)", "QUESTION: ...", 340, True),
        ("Socrates (Interceptor)", "Database", "INSERT intervention", 380, False),
        ("Socrates (Interceptor)", "Editor", "underline sentence", 420, True),
        ("Editor", "Writer", "show popover on hover", 460, True),
    ]
    for src, dst, label, y, dashed in msgs:
        cells.append(seq_msg(ll[src], ll[dst], label, y, dashed))
    return model(cells)

# ═══════════════════════════════════════════════════════════════════════════
# Diagram 6: Citation Sentinel Sequence
# ═══════════════════════════════════════════════════════════════════════════
def gen_seq_citation() -> str:
    cells = []
    ll = {n: safe_id("ll_" + n) for n in ["Writer", "Editor", "Galileo (Citation)", "Retrieval (RAG)", "LLM API", "Database"]}
    cells.append(lifeline("Writer", 40, 40, 600))
    cells.append(lifeline("Editor", 200, 40, 600))
    cells.append(lifeline("Galileo (Citation)", 360, 40, 600))
    cells.append(lifeline("Retrieval (RAG)", 520, 40, 600))
    cells.append(lifeline("LLM API", 680, 40, 600))
    cells.append(lifeline("Database", 820, 40, 600))
    msgs = [
        ("Writer", "Editor", "Types factual claim + .", 100, False),
        ("Editor", "Galileo (Citation)", "verifyClaim(sentence)", 140, False),
        ("Galileo (Citation)", "Retrieval (RAG)", "retrieveTopK(claim, k=5)", 180, False),
        ("Retrieval (RAG)", "Database", "SELECT chunks (keyword overlap)", 220, False),
        ("Database", "Retrieval (RAG)", "top 5 chunks", 260, True),
        ("Galileo (Citation)", "LLM API", "verifyClaim(claim, evidence) [Lens]", 300, False),
        ("LLM API", "Galileo (Citation)", "verdict: partially_supported", 340, True),
        ("Galileo (Citation)", "Database", "INSERT intervention + evidence", 380, False),
        ("Galileo (Citation)", "Editor", "underline + verdict", 420, True),
        ("Editor", "Writer", "show popover with evidence", 460, True),
    ]
    for src, dst, label, y, dashed in msgs:
        cells.append(seq_msg(ll[src], ll[dst], label, y, dashed))
    return model(cells)

# ═══════════════════════════════════════════════════════════════════════════
# Diagram 7: Socratic Spacer Sequence
# ═══════════════════════════════════════════════════════════════════════════
def gen_seq_socratic() -> str:
    cells = []
    ll = {n: safe_id("ll_" + n) for n in ["Writer", "Editor", "Diogenes (Socratic)", "LLM API", "Database"]}
    cells.append(lifeline("Writer", 40, 40, 500))
    cells.append(lifeline("Editor", 200, 40, 500))
    cells.append(lifeline("Diogenes (Socratic)", 360, 40, 500))
    cells.append(lifeline("LLM API", 520, 40, 500))
    cells.append(lifeline("Database", 680, 40, 500))
    msgs = [
        ("Writer", "Editor", "Stops typing (2s idle)", 100, False),
        ("Editor", "Diogenes (Socratic)", "fireSocratic('idle')", 140, False),
        ("Diogenes (Socratic)", "LLM API", "generateSocratic([Provocation])", 180, False),
        ("LLM API", "Diogenes (Socratic)", "QUESTION: ...", 220, True),
        ("Diogenes (Socratic)", "Database", "INSERT intervention", 260, False),
        ("Diogenes (Socratic)", "Editor", "underline last sentence", 300, True),
        ("Editor", "Writer", "pet runs across screen", 340, True),
    ]
    for src, dst, label, y, dashed in msgs:
        cells.append(seq_msg(ll[src], ll[dst], label, y, dashed))
    return model(cells)

# ═══════════════════════════════════════════════════════════════════════════
# Diagram 8: AI Service Class Diagram
# ═══════════════════════════════════════════════════════════════════════════
def gen_class_diagram() -> str:
    cells = []
    ids = {
        "aiservice": safe_id("cls_AIService (interface)"),
        "zai": safe_id("cls_ZAIAdapter"),
        "registry": safe_id("cls_PromptTemplateRegistry"),
        "template": safe_id("cls_PromptTemplate"),
        "budget": safe_id("cls_TokenBudget"),
    }
    cells.append(class_box("AIService (interface)", 40, 40, 260, 140,
        attrs=["provider: str", "apiKey: str", "modelMap: dict"],
        methods=["classifyPrompt(text, ctx)", "generateSocratic(tag, ctx)", "verifyClaim(claim, ev)", "generateEmbedding(text)", "generateScaffold(prompt, ctx)"]))
    cells.append(class_box("ZAIAdapter", 40, 240, 260, 120,
        attrs=["- zaiClient: ZAI", "- promptRegistry: PromptTemplateRegistry", "- budget: TokenBudget"],
        methods=["+ classifyPrompt()", "+ generateSocratic()", "+ verifyClaim()", "+ generateScaffold()"]))
    cells.append(class_box("PromptTemplateRegistry", 360, 40, 240, 100,
        attrs=["templates: Map"],
        methods=["+ get(tag): PromptTemplate", "+ register(t)", "+ activate(version)"]))
    cells.append(class_box("PromptTemplate", 360, 200, 240, 100,
        attrs=["id: uuid", "behaviorTag: str", "template: str", "version: int", "active: bool"],
        methods=["+ render(ctx): str"]))
    cells.append(class_box("TokenBudget", 360, 360, 240, 100,
        attrs=["dailyLimit: int", "usedToday: int"],
        methods=["+ checkAvailable(n): bool", "+ consume(n)"]))
    cells.append(edge(ids["zai"], ids["aiservice"], "implements", dashed=True, color="#78716c"))
    cells.append(edge(ids["zai"], ids["registry"], "uses"))
    cells.append(edge(ids["zai"], ids["budget"], "tracks"))
    cells.append(edge(ids["registry"], ids["template"], "manages"))
    return model(cells)

# ═══════════════════════════════════════════════════════════════════════════
# Generate all
# ═══════════════════════════════════════════════════════════════════════════

diagrams = [
    ("Use Case Diagram", gen_use_case()),
    ("System Architecture", gen_architecture()),
    ("Writing Loop", gen_writing_loop()),
    ("ER Diagram", gen_er()),
    ("Interceptor Sequence", gen_seq_interceptor()),
    ("Citation Sentinel Sequence", gen_seq_citation()),
    ("Socratic Spacer Sequence", gen_seq_socratic()),
    ("AI Service Class Diagram", gen_class_diagram()),
]

# Write each as a separate .drawio file
for name, xml in diagrams:
    fname = name.lower().replace(" ", "_") + ".drawio"
    fpath = os.path.join(OUT_DIR, fname)
    content = mxfile([{"name": name, "xml": xml}])
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Wrote {fname}")

# Also write a combined file with all diagrams as tabs
combined = mxfile([{"name": d[0], "xml": d[1], "id": str(i)} for i, d in enumerate(diagrams)])
combined_path = os.path.join(OUT_DIR, "ALL_DIAGRAMS.drawio")
with open(combined_path, "w", encoding="utf-8") as f:
    f.write(combined)
print(f"  Wrote ALL_DIAGRAMS.drawio (combined, {len(diagrams)} tabs)")

print(f"\nDone. {len(diagrams) + 1} files written to {OUT_DIR}")
