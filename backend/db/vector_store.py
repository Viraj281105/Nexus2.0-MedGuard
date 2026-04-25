class MockVectorStore:
    """
    Mock FAISS Vector Store for IRDAI Regulations.
    In production, we would use embeddings (e.g. OpenAI text-embedding-ada-002)
    and store them in FAISS or Pinecone.
    """
    def __init__(self):
        pass
        
    def search(self, query: str, top_k: int = 1) -> list:
        # Mock returning some IRDAI regulation text
        return [
            "IRDAI Circular Ref: IRDAI/HLT/REG/CIR/193/07/2020: Insurers must ensure transparent claim settlement and cannot arbitrarily deny claims based on unbundled charges if they are part of the main procedure."
        ]
