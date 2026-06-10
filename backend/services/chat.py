"""
services/chat.py — RAG chat service with FAISS semantic search

Uses sentence-transformers (all-MiniLM-L6-v2) to embed document chunks
and FAISS IndexFlatL2 for fast similarity search.  Falls back to keyword
overlap if the embedding model fails to load.
"""

import os
import json
import logging
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths for persisted index
# ---------------------------------------------------------------------------
_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
_INDEX_PATH = os.path.join(_DATA_DIR, "faiss_index.bin")
_CHUNKS_PATH = os.path.join(_DATA_DIR, "chunks.json")


class MedicalRAGService:
    """FAISS-backed Retrieval-Augmented Generation service."""

    def __init__(self):
        self._client = None          # Groq LLM client (lazy)
        self._model = None           # SentenceTransformer model (lazy)
        self._index = None           # faiss.IndexFlatL2
        self.document_chunks: list[str] = []
        self._embedding_dim = 384    # all-MiniLM-L6-v2 output size

        # Try to load a previously-saved index from disk
        self._try_load_index()

    # ------------------------------------------------------------------
    # Lazy loaders
    # ------------------------------------------------------------------
    def _get_client(self):
        if self._client is None:
            from groq import Groq
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                raise RuntimeError("GROQ_API_KEY not set")
            self._client = Groq(api_key=api_key)
        return self._client

    def _get_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Loaded SentenceTransformer: all-MiniLM-L6-v2")
        return self._model

    # ------------------------------------------------------------------
    # Index persistence
    # ------------------------------------------------------------------
    def save_index(self, index_path: str | None = None, chunks_path: str | None = None):
        """Write current FAISS index + chunk list to disk."""
        import faiss

        idx_p = index_path or _INDEX_PATH
        chk_p = chunks_path or _CHUNKS_PATH
        os.makedirs(os.path.dirname(idx_p), exist_ok=True)

        if self._index is not None and self._index.ntotal > 0:
            faiss.write_index(self._index, idx_p)
            with open(chk_p, "w", encoding="utf-8") as f:
                json.dump(self.document_chunks, f, ensure_ascii=False)
            logger.info(f"Saved FAISS index ({self._index.ntotal} vectors) → {idx_p}")

    def _try_load_index(self):
        """Load a persisted index if one exists on disk."""
        try:
            if os.path.exists(_INDEX_PATH) and os.path.exists(_CHUNKS_PATH):
                import faiss
                self._index = faiss.read_index(_INDEX_PATH)
                with open(_CHUNKS_PATH, "r", encoding="utf-8") as f:
                    self.document_chunks = json.load(f)
                logger.info(
                    f"Loaded FAISS index from disk: {self._index.ntotal} vectors, "
                    f"{len(self.document_chunks)} chunks"
                )
        except Exception as e:
            logger.warning(f"Could not load persisted FAISS index: {e}")

    # ------------------------------------------------------------------
    # Document ingestion
    # ------------------------------------------------------------------
    def ingest_document(self, text: str):
        """Chunk text, embed with SentenceTransformer, add to FAISS index."""
        if not text or not text.strip():
            return

        # Chunk: 500 chars, 100-char overlap
        chunk_size, overlap = 500, 100
        chunks: list[str] = []
        start = 0
        while start < len(text):
            chunks.append(text[start : start + chunk_size])
            start += chunk_size - overlap

        try:
            import faiss
            model = self._get_model()

            embeddings = model.encode(chunks, show_progress_bar=False, convert_to_numpy=True)
            embeddings = np.asarray(embeddings, dtype="float32")

            if self._index is None:
                self._index = faiss.IndexFlatL2(self._embedding_dim)

            self._index.add(embeddings)
            self.document_chunks.extend(chunks)

            logger.info(
                f"RAG: ingested {len(chunks)} chunks "
                f"(total index: {self._index.ntotal} vectors)"
            )

            # Persist to disk so the index survives restarts
            self.save_index()

        except Exception as e:
            logger.error(f"FAISS ingestion failed, falling back to keyword store: {e}")
            # Fallback: keep chunks for keyword retrieval
            self.document_chunks.extend(chunks)

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------
    def _get_relevant_chunks(self, question: str, k: int = 3) -> list[str]:
        """Retrieve top-k chunks via FAISS semantic search.
        Falls back to keyword overlap if FAISS is unavailable."""
        if not self.document_chunks:
            return []

        # --- Primary: FAISS semantic search ---
        if self._index is not None and self._index.ntotal > 0:
            try:
                model = self._get_model()
                q_emb = model.encode([question], convert_to_numpy=True)
                q_emb = np.asarray(q_emb, dtype="float32")

                k_actual = min(k, self._index.ntotal)
                distances, indices = self._index.search(q_emb, k_actual)

                results = []
                for idx in indices[0]:
                    if 0 <= idx < len(self.document_chunks):
                        results.append(self.document_chunks[idx])
                return results
            except Exception as e:
                logger.warning(f"FAISS search failed, falling back to keyword: {e}")

        # --- Fallback: keyword overlap ---
        q_words = set(question.lower().split())
        scored = []
        for chunk in self.document_chunks:
            chunk_words = set(chunk.lower().split())
            score = len(q_words & chunk_words)
            scored.append((score, chunk))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [c for _, c in scored[:k]]

    def search(self, question: str, k: int = 3) -> list[dict]:
        """Public search method that returns chunks with scores.
        Used by the eval script."""
        if not self.document_chunks:
            return []

        if self._index is not None and self._index.ntotal > 0:
            try:
                model = self._get_model()
                q_emb = model.encode([question], convert_to_numpy=True)
                q_emb = np.asarray(q_emb, dtype="float32")

                k_actual = min(k, self._index.ntotal)
                distances, indices = self._index.search(q_emb, k_actual)

                results = []
                for rank, (dist, idx) in enumerate(zip(distances[0], indices[0])):
                    if 0 <= idx < len(self.document_chunks):
                        results.append({
                            "rank": rank + 1,
                            "chunk_index": int(idx),
                            "distance": float(dist),
                            "text": self.document_chunks[idx],
                        })
                return results
            except Exception as e:
                logger.warning(f"FAISS search failed: {e}")

        return []

    # ------------------------------------------------------------------
    # Question answering
    # ------------------------------------------------------------------
    def ask_question(self, question: str) -> str:
        """Answer using top-k retrieved chunks as LLM context."""
        if not self.document_chunks:
            return "No document has been uploaded yet. Please upload a discharge summary first."
        try:
            client = self._get_client()
            chunks = self._get_relevant_chunks(question)
            context = "\n\n".join(chunks)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a helpful medical assistant. Answer the patient's question "
                            "using only the context from their discharge summary below. "
                            "Be clear, concise, and supportive.\n\nContext:\n" + context
                        ),
                    },
                    {"role": "user", "content": question},
                ],
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"RAG ask_question error: {e}")
            return "I'm having trouble answering right now. Please try again in a moment."
