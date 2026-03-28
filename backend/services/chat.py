import os
import logging
import numpy as np
import faiss
from groq import Groq

logger = logging.getLogger(__name__)

GROQ_KEY = os.getenv("GROQ_API_KEY")


class MedicalRAGService:
    def __init__(self):
        self.client = Groq(api_key=GROQ_KEY)
        self.index = None
        self.document_chunks = []

    def _embed(self, texts: list[str]) -> np.ndarray:
        """Call Groq embedding endpoint."""
        response = self.client.embeddings.create(
            model="nomic-embed-text-v1_5",
            input=texts,
        )
        vectors = [item.embedding for item in response.data]
        return np.array(vectors, dtype="float32")

    def ingest_document(self, text: str):
        """Chunk text and build FAISS index."""
        if not text or not text.strip():
            return
        # Split into ~500-char chunks with 50-char overlap
        chunk_size, overlap = 500, 50
        chunks = []
        start = 0
        while start < len(text):
            chunks.append(text[start:start + chunk_size])
            start += chunk_size - overlap

        self.document_chunks = chunks
        embeddings = self._embed(chunks)
        dim = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dim)
        self.index.add(embeddings)
        logger.info(f"RAG: indexed {len(chunks)} chunks (dim={dim})")

    def ask_question(self, question: str) -> str:
        """Retrieve top-3 chunks and answer via Groq."""
        if self.index is None or not self.document_chunks:
            return "No document has been uploaded yet. Please upload a discharge summary first."

        q_vec = self._embed([question])
        _, indices = self.index.search(q_vec, k=min(3, len(self.document_chunks)))
        context = "\n\n".join(
            self.document_chunks[i] for i in indices[0] if i < len(self.document_chunks)
        )

        response = self.client.chat.completions.create(
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