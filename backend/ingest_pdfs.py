#!/usr/bin/env python3
"""
ingest_pdfs.py — Batch PDF ingestion into FAISS vector store

Usage:
    python ingest_pdfs.py                   # ingest from ./pdfs/
    python ingest_pdfs.py /path/to/pdfs     # ingest from custom directory

Extracts text from every PDF in the target directory, chunks it,
embeds with SentenceTransformer (all-MiniLM-L6-v2), and saves:
    ./data/faiss_index.bin   — FAISS IndexFlatL2
    ./data/chunks.json       — parallel list of chunk strings
"""

import os
import sys
import json
import time
import logging
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
INDEX_PATH = os.path.join(DATA_DIR, "faiss_index.bin")
CHUNKS_PATH = os.path.join(DATA_DIR, "chunks.json")


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from a single PDF using PyMuPDF."""
    import fitz  # pymupdf

    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
    doc.close()
    return text.strip()


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start : start + chunk_size])
        start += chunk_size - overlap
    return chunks


def main():
    pdf_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE_DIR, "pdfs")

    if not os.path.isdir(pdf_dir):
        logger.error(f"PDF directory not found: {pdf_dir}")
        logger.info("Create a 'pdfs/' folder in the backend directory and add medical PDFs.")
        sys.exit(1)

    pdf_files = [f for f in os.listdir(pdf_dir) if f.lower().endswith(".pdf")]
    if not pdf_files:
        logger.error(f"No PDF files found in {pdf_dir}")
        sys.exit(1)

    logger.info(f"Found {len(pdf_files)} PDFs in {pdf_dir}")

    # --- Extract & chunk ---
    all_chunks: list[str] = []
    for fname in sorted(pdf_files):
        fpath = os.path.join(pdf_dir, fname)
        try:
            text = extract_text_from_pdf(fpath)
            chunks = chunk_text(text)
            all_chunks.extend(chunks)
            logger.info(f"  {fname}: {len(text)} chars → {len(chunks)} chunks")
        except Exception as e:
            logger.warning(f"  {fname}: FAILED — {e}")

    if not all_chunks:
        logger.error("No chunks produced from any PDF. Aborting.")
        sys.exit(1)

    logger.info(f"Total chunks: {len(all_chunks)}")

    # --- Embed ---
    logger.info(f"Loading embedding model: {EMBEDDING_MODEL} ...")
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(EMBEDDING_MODEL)

    logger.info("Encoding chunks ...")
    t0 = time.time()
    embeddings = model.encode(all_chunks, show_progress_bar=True, convert_to_numpy=True)
    embeddings = np.asarray(embeddings, dtype="float32")
    t1 = time.time()
    logger.info(f"Encoded {len(all_chunks)} chunks in {t1 - t0:.1f}s  →  shape {embeddings.shape}")

    # --- Build FAISS index ---
    import faiss

    index = faiss.IndexFlatL2(EMBEDDING_DIM)
    index.add(embeddings)
    logger.info(f"FAISS index built: {index.ntotal} vectors, dim={EMBEDDING_DIM}")

    # --- Save ---
    os.makedirs(DATA_DIR, exist_ok=True)
    faiss.write_index(index, INDEX_PATH)
    with open(CHUNKS_PATH, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False)

    logger.info(f"Saved index  → {INDEX_PATH}")
    logger.info(f"Saved chunks → {CHUNKS_PATH}")
    logger.info("")
    logger.info("=" * 50)
    logger.info(f"  PDFs processed:   {len(pdf_files)}")
    logger.info(f"  Total chunks:     {len(all_chunks)}")
    logger.info(f"  Index vectors:    {index.ntotal}")
    logger.info(f"  Embedding dim:    {EMBEDDING_DIM}")
    logger.info("=" * 50)


if __name__ == "__main__":
    main()
