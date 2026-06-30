"""Merge cover PDF + body PDF -> final Cogdoc architecture PDF.

Then run preflight checks:
  - meta.brand
  - pages.clean (remove blank pages)
  - font.check (scan for missing glyphs)
  - toc.check (validate TOC)
  - pdf_qa.py (full QA scan)
"""

import os
import sys
import subprocess
from pypdf import PdfReader, PdfWriter

PDF_SKILL = "/home/z/my-project/skills/pdf"
COVER = "/home/z/my-project/scripts/cogdoc/cover.pdf"
BODY  = "/home/z/my-project/scripts/cogdoc/body.pdf"
FINAL = "/home/z/my-project/download/cogdoc/Cogdoc_System_Architecture_Design.pdf"

A4_W, A4_H = 595.28, 841.89


def normalize(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    # Always scale to exact A4 to eliminate sub-pt mismatches that break
    # pdf_qa.py's page-size consistency check.
    if abs(w - A4_W) > 0.5 or abs(h - A4_H) > 0.5:
        page.scale_to(A4_W, A4_H)
    return page


def merge():
    print(f"Merging cover ({COVER}) + body ({BODY}) -> {FINAL}")
    writer = PdfWriter()

    # Cover as page 1
    cover_pages = PdfReader(COVER).pages
    for p in cover_pages:
        writer.add_page(normalize(p))

    # Body pages follow
    body_pages = PdfReader(BODY).pages
    for p in body_pages:
        writer.add_page(normalize(p))

    writer.add_metadata({
        "/Title": "Cogdoc System Architecture Design",
        "/Author": "Samreshan Sahani",
        "/Subject": "Final Year Project - System Architecture Design Document",
        "/Creator": "Z.ai",
        "/Producer": "Z.ai",
    })

    os.makedirs(os.path.dirname(FINAL), exist_ok=True)
    with open(FINAL, "wb") as f:
        writer.write(f)

    size_mb = os.path.getsize(FINAL) / (1024 * 1024)
    print(f"  -> {FINAL}")
    print(f"  -> Size: {size_mb:.2f} MB")
    print(f"  -> Total pages: {len(cover_pages) + len(body_pages)}")
    return FINAL


def run(cmd, label):
    print(f"\n>>> {label}")
    print(f"    $ {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout[-2000:])
    if result.returncode != 0:
        print(f"    (exit code {result.returncode})")
        if result.stderr:
            print(f"    stderr: {result.stderr[-1000:]}")
    return result.returncode


def preflight(final):
    py = sys.executable
    run([py, f"{PDF_SKILL}/scripts/pdf.py", "meta.brand", final], "meta.brand")
    run([py, f"{PDF_SKILL}/scripts/pdf.py", "pages.clean", final, "-o",
         final.replace(".pdf", "_clean.pdf")], "pages.clean")
    # If clean produced a file, replace
    clean = final.replace(".pdf", "_clean.pdf")
    if os.path.exists(clean):
        os.replace(clean, final)
        print(f"    Replaced original with cleaned version")
    run([py, f"{PDF_SKILL}/scripts/pdf.py", "font.check", final], "font.check")
    run([py, f"{PDF_SKILL}/scripts/pdf.py", "toc.check", final], "toc.check")
    run([py, f"{PDF_SKILL}/scripts/pdf_qa.py", "--skip-cover", final], "pdf_qa.py")


if __name__ == "__main__":
    final = merge()
    preflight(final)
    print(f"\n=== Final deliverable: {final} ===")
