"""Extract text content from the uploaded IR and PSF docx files and save to a text file."""
import os
from docx import Document

files = [
    ("/home/z/my-project/upload/Samreshan_Sahani_NP069749_Cogdoc_IR_Report (1) (1).docx", "IR"),
    ("/home/z/my-project/upload/Project_Specification_CogdocSamreshanSahani.docx", "PSF"),
]

out_lines = []
for fpath, label in files:
    out_lines.append("=" * 100)
    out_lines.append(f"FILE: {label} - {os.path.basename(fpath)}")
    out_lines.append("=" * 100)
    try:
        doc = Document(fpath)
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                style = para.style.name if para.style else ""
                out_lines.append(f"[{style}] {text}")
        for ti, table in enumerate(doc.tables):
            out_lines.append(f"\n--- TABLE {ti+1} ---")
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells]
                out_lines.append(" | ".join(cells))
    except Exception as e:
        out_lines.append(f"ERROR reading {fpath}: {e}")
    out_lines.append("\n")

with open("/home/z/my-project/scripts/extracted_content.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out_lines))

print(f"Total lines: {len(out_lines)}")
print("Saved to /home/z/my-project/scripts/extracted_content.txt")
