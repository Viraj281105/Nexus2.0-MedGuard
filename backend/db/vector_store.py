import numpy as np
from sentence_transformers import SentenceTransformer

class MockVectorStore:
    """
    Local Vector Store for IRDAI Regulations using Sentence Transformers.
    """
    def __init__(self):
        # Load small, fast local embedding model
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        
        self.documents = [
            "IRDAI Circular Ref: IRDAI/HLT/REG/CIR/193/07/2020: Insurers must ensure transparent claim settlement and cannot arbitrarily deny claims based on unbundled charges if they are part of the main procedure.",
            "Clause 5.2 (Protection of Policyholders' Interests): Room rent capping must be explicitly stated and proportional deductions should not apply to ICU charges.",
            "CGHS Guidelines 2014: Standard rates for consultation and routine blood tests must not exceed the prescribed upper limits.",
            "Consumables and disposables directly related to the surgery should not be billed separately to the patient if covered under a package rate.",
            "Any denial of a claim must be accompanied by a detailed justification quoting the specific clause of the policy document."
        ]
        
        # Pre-compute embeddings for local RAG
        self.embeddings = self.model.encode(self.documents)
        
    def search(self, query: str, top_k: int = 1) -> list:
        # Generate embedding for the query
        query_embedding = self.model.encode([query])[0]
        
        # Calculate cosine similarity
        similarities = np.dot(self.embeddings, query_embedding) / (np.linalg.norm(self.embeddings, axis=1) * np.linalg.norm(query_embedding))
        
        # Get top-k results
        top_indices = np.argsort(similarities)[::-1][:top_k]
        return [self.documents[i] for i in top_indices]
