"""Generate small, valid placeholder files for the demo seed (D12). Content is clearly fake."""

import io
import zipfile
from xml.sax.saxutils import escape

from app.models.document import FileType

DISCLAIMER = "FAKE DEMO DOCUMENT - generated for demonstrations, contains no real EgSA data."

# Fixed Office Open XML identifiers for a minimal .docx package.
_OOXML = "http://schemas.openxmlformats.org"
_NS_CONTENT_TYPES = f"{_OOXML}/package/2006/content-types"
_NS_RELS = f"{_OOXML}/package/2006/relationships"
_REL_OFFICE_DOCUMENT = f"{_OOXML}/officeDocument/2006/relationships/officeDocument"
_CT_RELS = "application/vnd.openxmlformats-package.relationships+xml"
_CT_DOCUMENT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"


def _pdf(title: str, body: str) -> bytes:
    lines = [title, "", DISCLAIMER, "", *body.splitlines()]
    text_ops = (
        "BT /F1 12 Tf 72 760 Td 16 TL "
        + " ".join(
            "(" + line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ") '"
            for line in lines
        )
        + " ET"
    )
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        f"<< /Length {len(text_ops)} >>\nstream\n{text_ops}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for number, obj in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{number} 0 obj\n{obj}\nendobj\n".encode("latin-1"))
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets:
        out.write(f"{offset:010d} 00000 n \n".encode())
    out.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return out.getvalue()


def _docx(title: str, body: str) -> bytes:
    paragraphs = "".join(
        f'<w:p><w:r><w:t xml:space="preserve">{escape(line)}</w:t></w:r></w:p>'
        for line in [title, DISCLAIMER, *body.splitlines()]
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            f'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="{_NS_CONTENT_TYPES}">'
            f'<Default Extension="rels" ContentType="{_CT_RELS}"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            f'<Override PartName="/word/document.xml" ContentType="{_CT_DOCUMENT}"/>'
            "</Types>",
        )
        archive.writestr(
            "_rels/.rels",
            f'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{_NS_RELS}">'
            f'<Relationship Id="rId1" Type="{_REL_OFFICE_DOCUMENT}" Target="word/document.xml"/>'
            "</Relationships>",
        )
        archive.writestr(
            "word/document.xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            f"<w:body>{paragraphs}</w:body></w:document>",
        )
    return buffer.getvalue()


def _txt(title: str, body: str) -> bytes:
    return f"{title}\n\n{DISCLAIMER}\n\n{body}\n".encode()


def make_demo_file(file_type: FileType, title: str, body: str) -> bytes:
    if file_type == FileType.PDF:
        return _pdf(title, body)
    if file_type == FileType.DOCX:
        return _docx(title, body)
    return _txt(title, body)
