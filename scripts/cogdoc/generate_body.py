"""
Cogdoc System Architecture Design - PDF Generator (Body)

Generates the body PDF via ReportLab (TocDocTemplate + multiBuild).
Cover is generated separately via html2poster.js and merged via pypdf.

Structure (per Outline):
  Cover (separate HTML)
  TOC
  Ch1 Executive Summary & Architectural Context
  Ch2 Architectural Decisions (ADR-style)
  Ch3 User Journey Maps
  Ch4 Use Case Diagram & Specification
  Ch5 System Architecture (Modular Monolith)
  Ch6 Sequence & Data Flow Diagrams
  Ch7 Entity-Relationship Diagram
  Ch8 Database Normalization (1NF -> 2NF -> 3NF)
  Ch9 AI Service Layer Design
  Ch10 Security, Privacy & Non-Functional Considerations
  Ch11 Conclusion & Migration Path
  Appendix A: Mermaid Source Code
"""

import os
import sys
import hashlib
import platform

# ── Skill path setup ────────────────────────────────────────────────────────
PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
sys.path.insert(0, os.path.join(PDF_SKILL_DIR, "scripts"))

# ── ReportLab imports ───────────────────────────────────────────────────────
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image,
    Table, TableStyle, KeepTogether, HRFlowable, CondPageBreak,
    Preformatted,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from PIL import Image as PILImage

# ── Font registration (mandatory per skill brief) ───────────────────────────
_IS_MAC = platform.system() == "Darwin"
FONT_DIR = os.path.expanduser("~/.openclaw/workspace/fonts") if _IS_MAC else "/usr/share/fonts"

pdfmetrics.registerFont(TTFont("NotoSerifSC",      f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf"))
pdfmetrics.registerFont(TTFont("NotoSerifSC-Bold", f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf"))
# Noto Sans SC only ships as a variable font on this system; use NotoSerifSC for CJK fallback.
pdfmetrics.registerFont(TTFont("SarasaMonoSC",     f"{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif",        f"{FONT_DIR}/truetype/freefont/FreeSerif.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Bold",   f"{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Italic", f"{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-BoldItalic", f"{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuSans",       f"{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf"))

registerFontFamily("NotoSerifSC",  normal="NotoSerifSC",  bold="NotoSerifSC-Bold")
registerFontFamily("FreeSerif",    normal="FreeSerif",    bold="FreeSerif-Bold",
                   italic="FreeSerif-Italic", boldItalic="FreeSerif-BoldItalic")
registerFontFamily("DejaVuSans",   normal="DejaVuSans",   bold="DejaVuSans")

from pdf import install_font_fallback
install_font_fallback()

# ── Cascade Palette (auto-generated; cool blue tech tone) ───────────────────
PAGE_BG       = colors.HexColor("#eff0f0")
SECTION_BG    = colors.HexColor("#ecedee")
CARD_BG       = colors.HexColor("#e4e6e7")
TABLE_STRIPE  = colors.HexColor("#eceef0")
HEADER_FILL   = colors.HexColor("#354d59")
COVER_BLOCK   = colors.HexColor("#44606e")
BORDER        = colors.HexColor("#c8d0d3")
ICON          = colors.HexColor("#407f9e")
ACCENT        = colors.HexColor("#226b90")
ACCENT_2      = colors.HexColor("#be6a4e")
TEXT_PRIMARY  = colors.HexColor("#181a1b")
TEXT_MUTED    = colors.HexColor("#808689")
SEM_SUCCESS   = colors.HexColor("#4f8862")
SEM_WARNING   = colors.HexColor("#af8a42")
SEM_ERROR     = colors.HexColor("#944942")
SEM_INFO      = colors.HexColor("#47729e")

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ── Output paths ────────────────────────────────────────────────────────────
OUT_DIR    = "/home/z/my-project/download/cogdoc"
BODY_PDF   = "/home/z/my-project/scripts/cogdoc/body.pdf"
COVER_PDF  = "/home/z/my-project/scripts/cogdoc/cover.pdf"
COVER_HTML = "/home/z/my-project/scripts/cogdoc/cover.html"
ASSETS_DIR = "/home/z/my-project/scripts/cogdoc/assets"
DIAG_DIR   = "/home/z/my-project/scripts/cogdoc/diagrams"
FINAL_PDF  = f"{OUT_DIR}/Cogdoc_System_Architecture_Design.pdf"

os.makedirs(OUT_DIR, exist_ok=True)

# ── Page geometry ───────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
LEFT_MARGIN   = 0.85 * inch
RIGHT_MARGIN  = 0.85 * inch
TOP_MARGIN    = 0.85 * inch
BOTTOM_MARGIN = 0.85 * inch
CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ── Paragraph styles ────────────────────────────────────────────────────────
H1_STYLE = ParagraphStyle(
    "H1", fontName="FreeSerif-Bold", fontSize=20, leading=26,
    textColor=HEADER_FILL, alignment=TA_LEFT,
    spaceBefore=18, spaceAfter=10,
)
H2_STYLE = ParagraphStyle(
    "H2", fontName="FreeSerif-Bold", fontSize=14, leading=20,
    textColor=HEADER_FILL, alignment=TA_LEFT,
    spaceBefore=14, spaceAfter=6,
)
H3_STYLE = ParagraphStyle(
    "H3", fontName="FreeSerif-Bold", fontSize=11.5, leading=16,
    textColor=ACCENT, alignment=TA_LEFT,
    spaceBefore=10, spaceAfter=4,
)
BODY_STYLE = ParagraphStyle(
    "Body", fontName="FreeSerif", fontSize=10.5, leading=16,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY,
    spaceBefore=0, spaceAfter=8, firstLineIndent=0,
)
BODY_INDENT = ParagraphStyle(
    "BodyIndent", parent=BODY_STYLE, leftIndent=18,
)
BULLET_STYLE = ParagraphStyle(
    "Bullet", fontName="FreeSerif", fontSize=10.5, leading=15,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    leftIndent=22, bulletIndent=10, spaceBefore=2, spaceAfter=2,
)
NUMBERED_STYLE = ParagraphStyle(
    "Numbered", fontName="FreeSerif", fontSize=10.5, leading=15,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    leftIndent=22, spaceBefore=2, spaceAfter=2,
)
CAPTION_STYLE = ParagraphStyle(
    "Caption", fontName="FreeSerif-Italic", fontSize=9, leading=12,
    textColor=TEXT_MUTED, alignment=TA_CENTER,
    spaceBefore=3, spaceAfter=12,
)
CODE_STYLE = ParagraphStyle(
    "Code", fontName="SarasaMonoSC", fontSize=8.5, leading=11,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    leftIndent=8, rightIndent=8, backColor=CARD_BG,
    borderPadding=6, spaceBefore=4, spaceAfter=4,
)
QUOTE_STYLE = ParagraphStyle(
    "Quote", fontName="FreeSerif-Italic", fontSize=10.5, leading=16,
    textColor=TEXT_MUTED, alignment=TA_LEFT,
    leftIndent=20, rightIndent=10, spaceBefore=8, spaceAfter=8,
    borderColor=ACCENT, borderWidth=0, borderPadding=0,
)
STAT_BIG_STYLE = ParagraphStyle(
    "StatBig", fontName="FreeSerif-Bold", fontSize=22, leading=26,
    textColor=ACCENT, alignment=TA_CENTER,
)
STAT_LABEL_STYLE = ParagraphStyle(
    "StatLabel", fontName="FreeSerif", fontSize=9, leading=12,
    textColor=TEXT_MUTED, alignment=TA_CENTER,
)
TABLE_HEADER_STYLE = ParagraphStyle(
    "TH", fontName="FreeSerif-Bold", fontSize=9.5, leading=12,
    textColor=colors.white, alignment=TA_LEFT,
)
TABLE_HEADER_CENTER = ParagraphStyle(
    "THC", fontName="FreeSerif-Bold", fontSize=9.5, leading=12,
    textColor=colors.white, alignment=TA_CENTER,
)
TABLE_CELL_STYLE = ParagraphStyle(
    "TC", fontName="FreeSerif", fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)
TABLE_CELL_CENTER = ParagraphStyle(
    "TCC", fontName="FreeSerif", fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER,
)
TABLE_CELL_MONO = ParagraphStyle(
    "TCM", fontName="SarasaMonoSC", fontSize=8.5, leading=11,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)
TOC_L0 = ParagraphStyle(
    "TOC0", fontName="FreeSerif-Bold", fontSize=12, leading=18,
    leftIndent=0, textColor=TEXT_PRIMARY,
)
TOC_L1 = ParagraphStyle(
    "TOC1", fontName="FreeSerif", fontSize=10.5, leading=16,
    leftIndent=24, textColor=TEXT_PRIMARY,
)

# ── TocDocTemplate ──────────────────────────────────────────────────────────
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, "bookmark_name"):
            level = getattr(flowable, "bookmark_level", 0)
            text  = getattr(flowable, "bookmark_text", "")
            key   = getattr(flowable, "bookmark_key", "")
            self.notify("TOCEntry", (level, text, self.page, key))

def add_heading(text, style, level=0):
    """Heading flowable with TOC bookmark."""
    key = "h_" + hashlib.md5(text.encode("utf-8")).hexdigest()[:8]
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name  = key
    p.bookmark_level = level
    p.bookmark_text  = text
    p.bookmark_key   = key
    return p

def _glue_dash(text):
    """Glue em-dashes to preceding word with non-breaking space."""
    return text.replace(" \u2014 ", "\u00A0\u2014 ")

def h1(text):
    return add_heading(_glue_dash(text), H1_STYLE, level=0)

def h2(text):
    return add_heading(_glue_dash(text), H2_STYLE, level=1)

def h3(text):
    # H3 not added to TOC (keeps TOC clean)
    return Paragraph(_glue_dash(text), H3_STYLE)

def body(text):
    # Glue em-dashes to the preceding word with a non-breaking space so the
    # dash never wraps to the start of a new line (CJK punctuation rule that
    # pdf_qa.py enforces even for English text).
    text = text.replace(" \u2014 ", "\u00A0\u2014 ")
    return Paragraph(text, BODY_STYLE)

def bullet(text):
    return Paragraph(f"• {text}", BULLET_STYLE)

def numbered(n, text):
    return Paragraph(f"{n}. {text}", NUMBERED_STYLE)

def caption(text):
    text = text.replace(" \u2014 ", "\u00A0\u2014 ")
    return Paragraph(text, CAPTION_STYLE)

def quote(text):
    text = text.replace(" \u2014 ", "\u00A0\u2014 ")
    return Paragraph(text, QUOTE_STYLE)

# ── Page header/footer ──────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    # Header
    canvas.setFont("FreeSerif", 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(LEFT_MARGIN, PAGE_H - 0.55 * inch,
                      "Cogdoc - System Architecture Design")
    canvas.drawRightString(PAGE_W - RIGHT_MARGIN, PAGE_H - 0.55 * inch,
                           "Samreshan Sahani - NP069749 - 2026")
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(LEFT_MARGIN, PAGE_H - 0.65 * inch,
                PAGE_W - RIGHT_MARGIN, PAGE_H - 0.65 * inch)
    # Footer
    canvas.drawString(LEFT_MARGIN, 0.55 * inch,
                      "BSc (Hons) IT - Asia Pacific University")
    canvas.drawRightString(PAGE_W - RIGHT_MARGIN, 0.55 * inch,
                           f"Page {doc.page}")
    canvas.line(LEFT_MARGIN, 0.65 * inch,
                PAGE_W - RIGHT_MARGIN, 0.65 * inch)
    canvas.restoreState()

# ── Embed image helper (preserves aspect ratio) ─────────────────────────────
def embed_image(path, max_width=None, max_height=None):
    if max_width is None:
        max_width = CONTENT_W
    if max_height is None:
        max_height = PAGE_H * 0.55
    pil = PILImage.open(path)
    w, h = pil.size
    ratio_w = max_width / w if w > max_width else 1.0
    ratio_h = max_height / h if h > max_height else 1.0
    ratio = min(ratio_w, ratio_h)
    return Image(path, width=w * ratio, height=h * ratio)

# ── Callout box ─────────────────────────────────────────────────────────────
def callout(title, body_text, accent=ACCENT, bg=SECTION_BG):
    title_p = Paragraph(f"<b>{_glue_dash(title)}</b>", ParagraphStyle(
        "CalloutT", fontName="FreeSerif-Bold", fontSize=10, leading=13,
        textColor=accent, alignment=TA_LEFT,
    ))
    body_p = Paragraph(_glue_dash(body_text), ParagraphStyle(
        "CalloutB", fontName="FreeSerif", fontSize=9.5, leading=14,
        textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    ))
    t = Table([[title_p], [body_p]], colWidths=[CONTENT_W - 6])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (0, 0), 8),
        ("BOTTOMPADDING", (0, 0), (0, 0), 2),
        ("TOPPADDING", (0, 1), (0, 1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
    ]))
    return t

# ── Standard table builder ──────────────────────────────────────────────────
def std_table(header_row, body_rows, col_ratios, header_align="left"):
    """Build a standard styled table.
    header_row: list of strings
    body_rows: list of lists of strings
    col_ratios: list of floats summing to ~1.0
    """
    col_widths = [r * CONTENT_W for r in col_ratios]
    hdr_style = TABLE_HEADER_CENTER if header_align == "center" else TABLE_HEADER_STYLE
    data = [[Paragraph(f"<b>{_glue_dash(c)}</b>", hdr_style) for c in header_row]]
    for row in body_rows:
        data.append([Paragraph(_glue_dash(str(c)), TABLE_CELL_STYLE) for c in row])
    t = Table(data, colWidths=col_widths, hAlign="CENTER", repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("VALIGN",     (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.25, BORDER),
    ]
    # Alternating rows
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style.append(("BACKGROUND", (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style))
    return t

# ── Safe KeepTogether ───────────────────────────────────────────────────────
MAX_KEEP_H = A4[1] * 0.4

def safe_keep(elements):
    total_h = 0
    for el in elements:
        try:
            _, h = el.wrap(CONTENT_W, A4[1])
            total_h += h
        except Exception:
            total_h += 100
    if total_h <= MAX_KEEP_H:
        return [KeepTogether(elements)]
    elif len(elements) >= 2:
        return [KeepTogether(elements[:2])] + list(elements[2:])
    return list(elements)

# ── Build story (constructed in separate functions) ─────────────────────────
# Story builders are imported from a sibling module to keep this file manageable.
from cogdoc_content import build_story

# ── Main ────────────────────────────────────────────────────────────────────
def main():
    story = []

    # Table of Contents
    toc = TableOfContents()
    toc.levelStyles = [TOC_L0, TOC_L1]
    story.append(Paragraph("<b>Table of Contents</b>", ParagraphStyle(
        "TOCTitle", fontName="FreeSerif-Bold", fontSize=22, leading=28,
        textColor=HEADER_FILL, alignment=TA_LEFT, spaceBefore=0, spaceAfter=18,
    )))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT,
                            spaceBefore=0, spaceAfter=14))
    story.append(toc)
    story.append(PageBreak())

    # Body content (from cogdoc_content.py)
    # Construct context dict with all helpers the content module needs
    ctx = dict(
        h1=h1, h2=h2, h3=h3, body=body, bullet=bullet, numbered=numbered,
        caption=caption, quote=quote, callout=callout,
        std_table=std_table, embed_image=embed_image, safe_keep=safe_keep,
        PAGE_W=PAGE_W, PAGE_H=PAGE_H, CONTENT_W=CONTENT_W,
        ACCENT=ACCENT, ACCENT_2=ACCENT_2, HEADER_FILL=HEADER_FILL,
        TEXT_PRIMARY=TEXT_PRIMARY, TEXT_MUTED=TEXT_MUTED,
        SECTION_BG=SECTION_BG, CARD_BG=CARD_BG, BORDER=BORDER,
        TABLE_STRIPE=TABLE_STRIPE, TABLE_HEADER_COLOR=TABLE_HEADER_COLOR,
        STAT_BIG_STYLE=STAT_BIG_STYLE, STAT_LABEL_STYLE=STAT_LABEL_STYLE,
        BODY_STYLE=BODY_STYLE, BULLET_STYLE=BULLET_STYLE,
        H1_STYLE=H1_STYLE, H2_STYLE=H2_STYLE, H3_STYLE=H3_STYLE,
        CODE_STYLE=CODE_STYLE, CAPTION_STYLE=CAPTION_STYLE,
        TABLE_HEADER_STYLE=TABLE_HEADER_STYLE, TABLE_CELL_STYLE=TABLE_CELL_STYLE,
        TOC_L0=TOC_L0, TOC_L1=TOC_L1,
    )
    build_story(story, ctx)

    # Build PDF
    doc = TocDocTemplate(
        BODY_PDF, pagesize=A4,
        leftMargin=LEFT_MARGIN, rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
        title="Cogdoc System Architecture Design",
        author="Samreshan Sahani",
        subject="Final Year Project - System Architecture Design Document",
        creator="Z.ai",
    )
    doc.multiBuild(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"Body PDF generated: {BODY_PDF}")

if __name__ == "__main__":
    main()
