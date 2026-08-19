import os
from typing import List, Dict, Any
from pydantic import BaseModel, Field

class AIConfigError(Exception):
    """Raised when AI provider is not properly configured."""
    pass

class QuestionDTO(BaseModel):
    text: str = Field(..., description="The interview question text")
    metadata: Dict[str, Any] = Field(default_factory=dict)

class AnswerDTO(BaseModel):
    question_id: int = Field(..., description="ID of the question being answered")
    answer: str = Field(..., description="User's answer text")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EvaluationDTO(BaseModel):
    score: int = Field(..., ge=0, le=10, description="Overall score out of 10")
    correctness: float = Field(..., ge=0, le=1, description="Correctness ratio")
    relevance: float = Field(..., ge=0, le=1, description="Relevance ratio")
    technical_depth: float = Field(..., ge=0, le=1, description="Technical depth ratio")
    communication_quality: float = Field(..., ge=0, le=1, description="Communication quality ratio")
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    feedback: str = Field(..., description="Human‑readable feedback string")

class AIProvider:
    """Modular AI provider abstraction.

    The provider reads the environment variable ``AI_PROVIDER`` to decide which concrete implementation
    to use.  At the moment only a ``mock`` provider is available for development/testing.  When a real
    provider (e.g. OpenAI, Anthropic) is configured, its implementation can be added without changing the
    interview engine.
    """

    def __init__(self) -> None:
        self.provider_name = os.getenv("AI_PROVIDER", "mock").lower()
        self.api_key = os.getenv("AI_API_KEY")
        if self.provider_name == "mock":
            # Mock provider does not need an API key.
            pass
        else:
            # For any non‑mock provider we require an API key.
            if not self.api_key:
                raise AIConfigError(
                    f"AI provider is set to '{self.provider_name}' but AI_API_KEY is not configured. "
                    "Please set AI_API_KEY in the environment."
                )
            # Real provider initialization would happen here.
            raise NotImplementedError(
                f"AI provider '{self.provider_name}' is not implemented yet."
            )

    # --------------------- Question Generation ---------------------
    def generate_question(self, setup: Dict[str, Any], history: List[Dict[str, Any]]) -> QuestionDTO:
        """Generate a new interview question.

        * ``setup`` – the interview configuration (role, difficulty, etc.).
        * ``history`` – a list of previous ``{'question': str, 'answer': str, 'evaluation': dict}`` entries.
        """
        if self.provider_name == "mock":
            q_number = len(history) + 1
            role = setup.get("job_role", "Software Developer")
            return QuestionDTO(
                text=f"Mock question {q_number} for role {role}. Explain a key concept related to this role.",
                metadata={"mock": True, "question_number": q_number},
            )
        raise NotImplementedError("generate_question is not implemented for provider {self.provider_name}")

    # --------------------- Answer Evaluation ---------------------
    def evaluate_answer(self, question: str, answer: str, history: List[Dict[str, Any]]) -> EvaluationDTO:
        """Evaluate a user's answer.

        Returns a fully validated ``EvaluationDTO``.  The mock provider returns a deterministic, simple
        evaluation that can be used while no real LLM is configured.
        """
        if self.provider_name == "mock":
            base_score = min(10, max(0, len(answer.split()) // 5))
            return EvaluationDTO(
                score=base_score,
                correctness=0.5,
                relevance=0.5,
                technical_depth=0.5,
                communication_quality=0.5,
                strengths=["Clear language"],
                weaknesses=["Needs more depth"],
                feedback="Good start, elaborate more on technical details.",
            )
        raise NotImplementedError("evaluate_answer is not implemented for provider {self.provider_name}")
