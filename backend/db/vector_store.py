import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

class VectorStore:
    """
    Local Vector Store for IRDAI Regulations using Sentence Transformers and FAISS.
    (Aligned with System Architecture Diagram)
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
        
        # Pre-compute embeddings
        embeddings = self.model.encode(self.documents)
        
        # Initialize FAISS Index
        # all-MiniLM-L6-v2 outputs 384-dimensional vectors
        self.dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(self.dimension)
        
        # Add vectors to FAISS index
        self.index.add(np.array(embeddings).astype('float32'))
        
    def search(self, query: str, top_k: int = 1) -> list:
        # Generate embedding for the query
        query_embedding = self.model.encode([query])
        
        # Search FAISS index
        distances, indices = self.index.search(np.array(query_embedding).astype('float32'), top_k)
        
        # Retrieve documents
        results = []
        for idx in indices[0]:
            if 0 <= idx < len(self.documents):
                results.append(self.documents[idx])
                
        return results

# Keep MockVectorStore class definition mapping to VectorStore for backwards compatibility
MockVectorStore = VectorStore
