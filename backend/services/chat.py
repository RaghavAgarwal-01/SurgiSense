"""
services/chat.py — RAG chat service (crash-safe version)

Uses Groq LLM for both embedding simulation and answering.
Falls back gracefully if anything fails so the app always starts.
"""

import os
import logging

logger = logging.getLogger(__name__)


class MedicalRAGService:
    def __init__(self):
        # Lazy init — nothing that can crash on startup
        self._client = None
        self.document_text = ""   # store raw text for simple retrieval
        self.document_chunks = []

    def _get_client(self):
        if self._client is None:
            from groq import Groq
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                raise RuntimeError("GROQ_API_KEY not set")
            self._client = Groq(api_key=api_key)
        return self._client

    def ingest_document(self, text: str):
        """Store document text for retrieval."""
        if not text or not text.strip():
            return
        self.document_text = text
        # Simple chunking — 500 chars with 50 overlap
        chunk_size, overlap = 500, 50
        chunks, start = [], 0
        while start < len(text):
            chunks.append(text[start:start + chunk_size])
            start += chunk_size - overlap
        self.document_chunks = chunks
        logger.info(f"RAG: stored {len(chunks)} chunks ({len(text)} chars)")

    def _get_relevant_chunks(self, question: str, k: int = 3) -> str:
        """Simple keyword-based retrieval — no embeddings needed."""
        if not self.document_chunks:
            return ""
        q_words = set(question.lower().split())
        scored = []
        for chunk in self.document_chunks:
            chunk_words = set(chunk.lower().split())
            score = len(q_words & chunk_words)
            scored.append((score, chunk))
        scored.sort(key=lambda x: x[0], reverse=True)
        top = [c for _, c in scored[:k]]
        return "\n\n".join(top)

    def ask_question(self, question: str) -> str:
        """Answer using relevant chunks as context."""
        if not self.document_chunks:
            return "No document has been uploaded yet. Please upload a discharge summary first."
        try:
            client = self._get_client()
            context = self._get_relevant_chunks(question)
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
