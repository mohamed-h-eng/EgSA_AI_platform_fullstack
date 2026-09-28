"""Tiny but *real* test files for upload tests."""

import io
import zipfile


def pdf_bytes(text: str = "EPS requirements") -> bytes:
    return (
        b"%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% "
        + text.encode()
        + b"\ntrailer << /Root 1 0 R >>\n%%EOF\n"
    )


def docx_bytes(text: str = "Design notes") -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
        )
        archive.writestr(
            "word/document.xml",
            f'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>',
        )
    return buffer.getvalue()


def zip_without_word_bytes() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("payload.bin", b"not a word document")
    return buffer.getvalue()


def txt_bytes(text: str = "Battery undervoltage threshold: 24 V\nعتبة الجهد المنخفض") -> bytes:
    return text.encode("utf-8")
