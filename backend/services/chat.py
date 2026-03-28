import os
import logging
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from groq import Groq

logger = logging.getLogger(__name__)

class MedicalRAGService:
    def __init__(self):
        self.groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self._embedder = None          # lazy — loads on first use
        self.index = None
        self.document_chunks = []

    @property
    def embedder(self):
        if self._embedder is None:
            self._embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        return self._embedder

    def ingest_document(self, text: str):
        """Chops text, embeds it, and stores it in FAISS directly."""
        try:
            chunk_size = 800
            overlap = 100
            self.document_chunks = []
            
            start = 0
            while start < len(text):
                end = start + chunk_size
                self.document_chunks.append(text[start:end])
                start = end - overlap

            if not self.document_chunks:
                return False

            embeddings = self.embedder.encode(self.document_chunks)
            vector_dimension = embeddings.shape[1]

            self.index = faiss.IndexFlatL2(vector_dimension)
            self.index.add(np.array(embeddings).astype('float32'))  # type: ignore
            
            return True
        except Exception as e:
            logger.error(f"RAG Ingestion Error: {str(e)}")
            return False

    def ask_question(self, question: str):
        """Finds the most relevant chunks locally and asks Groq to answer."""
        if not self.index or not self.document_chunks:
            return "Please upload and scan a document first."
        
        try:
            question_vector = self.embedder.encode([question]).astype('float32')
            distances, indices = self.index.search(question_vector, k=3)  # type: ignore
            
            retrieved_context = "\n\n".join([
                self.document_chunks[i] for i in indices[0] if i < len(self.document_chunks)
            ])
            prompt = f"""You are a clinical AI assistant for SurgiSense answering questions about a patient's medical document. 
            Use ONLY the following retrieved context to answer the doctor or patient's question. 
            If the answer is not in the context, explicitly state "The document does not specify." Do not hallucinate.

            CRITICAL INSTRUCTION: You must respond in the EXACT same language the user asked the question in. 
            - If the user asks in English, reply in English.
            - If the user asks in Hindi (Devanagari script), reply in Hindi.
            - If the user asks in Hinglish (Hindi written in English alphabet, e.g., "Mera operation kab hua?"), reply in natural, conversational Hinglish.

            Context:
            {retrieved_context}
            
            Question: {question}
            """

            response = self.groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                temperature=0
            )
            
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"RAG Chat Error: {str(e)}")
            return "An error occurred while generating the answer."