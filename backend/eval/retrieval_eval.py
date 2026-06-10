#!/usr/bin/env python3
"""
eval/retrieval_eval.py — Retrieval Precision@3 evaluation for SurgiSense RAG

Runs 10 medical queries against the FAISS index, prints top-3 retrieved
chunks per query, asks for a relevance score (0-3), and reports Precision@3.

Usage:
    cd backend
    python eval/retrieval_eval.py
"""

import os
import sys

# Ensure the backend root is on the path so we can import services
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from services.chat import MedicalRAGService

# ---------------------------------------------------------------------------
# Evaluation queries — post-surgical recovery domain
# ---------------------------------------------------------------------------
EVAL_QUERIES = [
    "What medications should I take after surgery?",
    "How do I care for my surgical wound at home?",
    "What are the signs of a wound infection?",
    "When can I resume normal physical activity after surgery?",
    "What should I eat during post-operative recovery?",
    "How often should I check my blood pressure after surgery?",
    "What are the side effects of anesthesia?",
    "When should I schedule a follow-up appointment?",
    "How do I manage post-surgical pain without opioids?",
    "What are the warning signs that I should go to the ER?",
]


def main():
    rag = MedicalRAGService()

    if not rag.document_chunks:
        print("=" * 60)
        print("ERROR: No chunks in the FAISS index.")
        print("Run 'python ingest_pdfs.py' first to build the index.")
        print("=" * 60)
        sys.exit(1)

    index_size = rag._index.ntotal if rag._index else 0
    print("=" * 60)
    print(f"  SurgiSense RAG — Retrieval Precision@3 Evaluation")
    print(f"  Index size: {index_size} vectors | Chunks: {len(rag.document_chunks)}")
    print("=" * 60)
    print()
    print("For each query you will see the top-3 retrieved chunks.")
    print("Rate each chunk's relevance to the query:")
    print("  0 = Not relevant at all")
    print("  1 = Marginally relevant")
    print("  2 = Relevant")
    print("  3 = Highly relevant")
    print()

    total_relevant = 0
    total_retrieved = 0

    for qi, query in enumerate(EVAL_QUERIES, 1):
        print("-" * 60)
        print(f"Query {qi}/{len(EVAL_QUERIES)}: {query}")
        print("-" * 60)

        results = rag.search(query, k=3)

        if not results:
            print("  [No results returned]\n")
            total_retrieved += 3
            continue

        query_score = 0
        for r in results:
            total_retrieved += 1
            snippet = r["text"][:200].replace("\n", " ")
            print(f"\n  Rank {r['rank']} (dist={r['distance']:.4f}, chunk #{r['chunk_index']}):")
            print(f"  \"{snippet}...\"")

            while True:
                try:
                    score = int(input(f"  Relevance [0-3]: ").strip())
                    if 0 <= score <= 3:
                        break
                except (ValueError, EOFError):
                    pass
                print("  Please enter 0, 1, 2, or 3.")

            if score >= 2:
                total_relevant += 1
            query_score += score

        print(f"\n  → Query score: {query_score}/{len(results) * 3}")

    # --- Final report ---
    precision = total_relevant / total_retrieved if total_retrieved > 0 else 0.0
    print()
    print("=" * 60)
    print(f"  RESULTS")
    print(f"  Queries evaluated:   {len(EVAL_QUERIES)}")
    print(f"  Total chunks scored: {total_retrieved}")
    print(f"  Relevant (score≥2):  {total_relevant}")
    print(f"  Precision@3:         {precision:.4f}")
    print("=" * 60)


if __name__ == "__main__":
    main()
