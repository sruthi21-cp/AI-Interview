import os
from typing import Optional
from pdfminer.high_level import extract_text


def extract_text_from_pdf(file_path: str) -> str:
    """Extract plain text from a PDF file.

    Args:
        file_path: Path to the PDF file.
    Returns:
        Extracted text as a string. Returns empty string on failure.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")
    try:
        text = extract_text(file_path)
        return text or ""
    except Exception as e:
        raise RuntimeError(f"Failed to extract text from PDF: {e}")
