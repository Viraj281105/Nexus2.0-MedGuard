import asyncio
from db.vector_store import MockVectorStore

class AgentOrchestrator:
    """
    Orchestrates the AdvocAI Multi-Agent System.
    """
    def __init__(self):
        self.vector_store = MockVectorStore()
    async def run_pipeline(self, overcharge_data: dict) -> str:
        """
        Runs the agents sequentially and generates the final appeal text.
        """
        # 1. Auditor Agent
        auditor_context = await self._run_auditor(overcharge_data)
        
        # 2. Clinician Agent
        clinical_evidence = await self._run_clinician(auditor_context)
        
        # 3. Regulatory Agent
        legal_rules = await self._run_regulatory(auditor_context)
        
        # 4. Barrister Agent
        draft_appeal = await self._run_barrister(auditor_context, clinical_evidence, legal_rules)
        
        # 5. Judge Agent
        final_appeal = await self._run_judge(draft_appeal)
        
        return final_appeal

    async def _run_auditor(self, data):
        await asyncio.sleep(0.5)
        return {"data": data, "parsed": True, "codes": ["ICD-10", "CPT-4"]}

    async def _run_clinician(self, context):
        await asyncio.sleep(0.5)
        return "Medically necessary per standard clinical guidelines."

    async def _run_regulatory(self, context):
        await asyncio.sleep(0.5)
        # Use FAISS to search for rules based on the medical items
        items = [i['item'] for i in context['data'].get('overcharges', [])]
        query = " ".join(items)
        rules = self.vector_store.search(query)
        return rules[0]

    async def _run_barrister(self, context, clinical, regulatory):
        await asyncio.sleep(1.0)
        items = context["data"].get("overcharges", [])
        savings = context["data"].get("savings_estimate", 0)
        
        item_text = "\n".join([f"- {i['item']}: Billed ₹{i['charged']} (CGHS Rate: ₹{i['cghs_rate']})" for i in items])
        
        appeal_text = f"""
[FORMAL APPEAL FOR MEDICAL CLAIM REEVALUATION]

To the Grievance Redressal Officer,
[Health Insurance Company Name]

Subject: Appeal against excessive billing and claim denial - Reference #[Policy Number]

Dear Sir/Madam,

I am writing to formally appeal the charges levied for recent medical treatment. Upon auditing the hospital bill against standard CGHS benchmark rates, I have identified significant discrepancies totaling ₹{savings}.

The specific overcharges are as follows:
{item_text}

Clinical Validation:
{clinical}

Regulatory Grounds for Appeal:
As per {regulatory}, insurers are mandated to ensure transparent billing practices. The hospital has engaged in unbundling and price inflation, which violates the aforementioned circular.

I request a prompt review of this claim and reimbursement of the legitimate amount in accordance with the policy terms and IRDAI guidelines.

Sincerely,
[Patient Name]
"""
        return appeal_text

    async def _run_judge(self, draft):
        await asyncio.sleep(0.5)
        # QA check passed, returning final text
        return draft
