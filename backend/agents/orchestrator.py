import asyncio
import os
from db.vector_store import MockVectorStore

try:
    from groq import AsyncGroq
except ImportError:
    AsyncGroq = None

class AgentOrchestrator:
    """
    Orchestrates the AdvocAI Multi-Agent System using Groq API.
    """
    def __init__(self):
        self.vector_store = MockVectorStore()
        api_key = os.environ.get("GROQ_API_KEY", "gsk_dummy_key")
        self.client = AsyncGroq(api_key=api_key) if AsyncGroq else None
        self.model = "llama3-8b-8192"

    async def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        if not self.client or self.client.api_key == "gsk_dummy_key":
            await asyncio.sleep(0.5)
            return f"[Mock LLM Response - Set GROQ_API_KEY in backend terminal to enable real AI]\nPrompt: {user_prompt[:50]}..."
            
        try:
            chat_completion = await self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model=self.model,
                temperature=0.2,
                max_tokens=1024,
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            return f"[LLM Error: {e}]"

    async def generate_appeal(self, overcharge_data: dict) -> str:
        """
        Runs the agents sequentially and generates the final appeal text.
        """
        # 1. Auditor Agent
        auditor_output = await self._run_auditor(overcharge_data)
        
        # 2. Clinician Agent
        clinical_output = await self._run_clinician(overcharge_data, auditor_output)
        
        # 3. Regulatory Agent
        regulatory_output = await self._run_regulatory(overcharge_data)
        
        # 4. Barrister Agent
        draft = await self._run_barrister(overcharge_data, clinical_output, regulatory_output)
        
        # 5. Judge Agent
        final_appeal = await self._run_judge(draft)
        
        return final_appeal

    async def _run_auditor(self, context):
        items = "\n".join([f"- {i['item']}: Charged {i['charged']}, CGHS {i['cghs_rate']}" for i in context.get('overcharges', [])])
        system = "You are an expert Medical Billing Auditor. Summarize the financial discrepancies clearly."
        user = f"Review the following overcharges and calculate the total financial impact:\n{items}"
        return await self._call_llm(system, user)

    async def _run_clinician(self, context, auditor_output):
        items = "\n".join([i['item'] for i in context.get('overcharges', [])])
        system = "You are a Chief Medical Officer. Defend the medical necessity of the procedures."
        user = f"Provide a brief medical justification for these procedures, assuming they were necessary for a standard recovery:\n{items}"
        return await self._call_llm(system, user)

    async def _run_regulatory(self, context):
        items = [i['item'] for i in context.get('overcharges', [])]
        query = " ".join(items)
        rules = self.vector_store.search(query, top_k=2)
        rules_text = "\n".join(rules)
        system = "You are a Regulatory Expert. Connect medical billing rules to the case."
        user = f"Based on the following IRDAI/CGHS rules, write a short paragraph arguing that the insurer violated them:\nRules:\n{rules_text}"
        return await self._call_llm(system, user)

    async def _run_barrister(self, context, clinical, regulatory):
        system = "You are a ruthless Insurance Barrister. Draft a formal appeal letter."
        user = f"Draft a formal, professional insurance appeal letter addressed to 'Grievance Redressal Officer'.\nInclude the clinical justification:\n{clinical}\nAnd the regulatory stance:\n{regulatory}\nMake it sound legally threatening but polite."
        return await self._call_llm(system, user)

    async def _run_judge(self, draft):
        system = "You are a Senior Judge. Review the letter for tone and finalize it."
        user = f"Review the following appeal letter. Fix any formatting issues, ensure it sounds professional, and output ONLY the final letter text:\n\n{draft}"
        return await self._call_llm(system, user)
