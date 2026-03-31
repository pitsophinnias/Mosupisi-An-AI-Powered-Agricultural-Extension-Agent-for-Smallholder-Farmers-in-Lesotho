"""
ingest.py - Standalone script to (re)build the ChromaDB vector store.

Run this once after setup, or any time you add new documents:
    python ingest.py

It will:
1. Copy PDFs from the planting guide service data/pdfs folder (they contain
   agrometeorological data relevant to pest pressure)
2. Load the pest knowledge JSON
3. Embed and index everything into ChromaDB
"""

import shutil
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SRC_PDF_DIR = (
    Path(__file__).parent.parent
    / "mosupisi-planting-guide-service"
    / "data"
    / "pdfs"
)
DEST_PDF_DIR = Path(__file__).parent / "data" / "pdfs"
CHROMA_DIR = Path(__file__).parent / "chroma_db"


def copy_pdfs():
    """Copy PDFs from planting guide service to pest control data folder."""
    if not SRC_PDF_DIR.exists():
        logger.warning(f"Source PDF dir not found: {SRC_PDF_DIR}")
        return

    DEST_PDF_DIR.mkdir(parents=True, exist_ok=True)
    copied = 0
    for pdf in SRC_PDF_DIR.glob("*.pdf"):
        dest = DEST_PDF_DIR / pdf.name
        if not dest.exists():
            shutil.copy2(pdf, dest)
            logger.info(f"Copied: {pdf.name}")
            copied += 1
    logger.info(f"Copied {copied} PDFs to {DEST_PDF_DIR}")


def reset_chroma():
    """Delete existing ChromaDB to force re-ingestion."""
    if CHROMA_DIR.exists():
        shutil.rmtree(CHROMA_DIR)
        logger.info("Cleared existing ChromaDB")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Ingest pest control documents into ChromaDB")
    parser.add_argument("--reset", action="store_true", help="Clear existing ChromaDB before ingesting")
    parser.add_argument("--copy-pdfs", action="store_true", help="Copy PDFs from planting guide service")
    args = parser.parse_args()

    if args.copy_pdfs:
        copy_pdfs()

    if args.reset:
        reset_chroma()

    logger.info("Starting RAG initialization and ingestion...")
    from rag import PestRAG
    rag = PestRAG()
    rag.initialize()
    logger.info(f"Done! ChromaDB now has {rag.collection.count() if rag.collection else 0} documents")


if __name__ == "__main__":
    main()