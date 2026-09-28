"""Upload validation (workflow 05): extension allow-list AND content sniffing AND size limit.

Everything is validated on a temporary copy BEFORE it reaches StorageService, so storage
never holds a file that failed validation (and a future MinIO backend gets the same guarantee).
"""

import codecs
import hashlib
import re
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath, PureWindowsPath
from tempfile import SpooledTemporaryFile
from typing import IO, BinaryIO

from app.core.errors import AppError
from app.models.document import FileType

CHUNK = 1024 * 1024

MIME_TYPES: dict[FileType, str] = {
    FileType.PDF: "application/pdf",
    FileType.DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    FileType.TXT: "text/plain; charset=utf-8",
}


class UploadRejectedError(AppError):
    code = "UPLOAD_REJECTED"


@dataclass
class ValidatedFile:
    file_type: FileType
    mime_type: str
    size_bytes: int
    sha256: str
    filename: str
    content: IO[bytes]  # positioned at 0; caller closes

    def close(self) -> None:
        self.content.close()


def sanitize_filename(raw: str | None, file_type: FileType) -> str:
    """Keep a display-safe basename: no directories, no control characters, ≤255 chars."""
    name = PureWindowsPath(PurePosixPath(raw or "").name).name
    # Whitespace (tabs, newlines) becomes a space first; other control characters are dropped.
    name = re.sub(r"\s+", " ", name)
    name = "".join(ch for ch in name if unicodedata.category(ch)[0] != "C").strip(" .")
    if not name:
        name = f"document.{file_type}"
    if len(name) > 255:
        stem, dot, ext = name.rpartition(".")
        name = (stem[: 250 - len(ext)] + dot + ext) if dot else name[:255]
    return name


def _extension(filename: str | None) -> str:
    suffix = PurePosixPath(PureWindowsPath(filename or "").name).suffix
    return suffix.lower().lstrip(".")


def _check_content(file_type: FileType, content: IO[bytes]) -> bool:
    content.seek(0)
    if file_type == FileType.PDF:
        return content.read(5) == b"%PDF-"
    if file_type == FileType.DOCX:
        # A .docx is a ZIP containing word/document.xml (we never extract it).
        if not zipfile.is_zipfile(content):
            return False
        content.seek(0)
        try:
            with zipfile.ZipFile(content) as archive:
                return "word/document.xml" in archive.namelist()
        except zipfile.BadZipFile:
            return False
    if file_type == FileType.TXT:
        decoder = codecs.getincrementaldecoder("utf-8")(errors="strict")
        try:
            while chunk := content.read(CHUNK):
                if b"\x00" in chunk:
                    return False  # binary data
                decoder.decode(chunk)
            decoder.decode(b"", final=True)
        except UnicodeDecodeError:
            return False
        return True
    return False


def receive_upload(
    source: BinaryIO, filename: str | None, *, max_bytes: int, allowed_types: list[str]
) -> ValidatedFile:
    ext = _extension(filename)
    allowed = [t for t in allowed_types if t in FileType._value2member_map_]
    if ext not in allowed:
        raise UploadRejectedError(
            f"Only {', '.join(t.upper() for t in allowed)} files can be uploaded.",
            code="FILE_TYPE_NOT_ALLOWED",
            details={"allowed_types": allowed},
        )
    file_type = FileType(ext)

    spooled: IO[bytes] = SpooledTemporaryFile(max_size=CHUNK)  # noqa: SIM115 (returned to caller)
    digest = hashlib.sha256()
    size = 0
    try:
        while chunk := source.read(CHUNK):
            size += len(chunk)
            if size > max_bytes:
                raise UploadRejectedError(
                    f"The file is larger than the {max_bytes // (1024 * 1024)} MB limit.",
                    code="FILE_TOO_LARGE",
                    details={"max_bytes": max_bytes},
                )
            digest.update(chunk)
            spooled.write(chunk)
        if size == 0:
            raise UploadRejectedError("The file is empty.", code="FILE_EMPTY")
        if not _check_content(file_type, spooled):
            raise UploadRejectedError(
                f"The file content is not a valid {file_type.upper()} document.",
                code="FILE_CONTENT_MISMATCH",
            )
    except BaseException:
        spooled.close()
        raise

    spooled.seek(0)
    return ValidatedFile(
        file_type=file_type,
        mime_type=MIME_TYPES[file_type],
        size_bytes=size,
        sha256=digest.hexdigest(),
        filename=sanitize_filename(filename, file_type),
        content=spooled,
    )
