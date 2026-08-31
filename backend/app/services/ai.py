import os
import json
import logging
import requests
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("uvicorn.error")

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

from app.core.config import settings

class AIProvider:
    """Modular AI provider abstraction.

    Reads configuration from app settings (or environment variables).
    Supports Gemini and OpenAI, with explicit error propagation when real AI fails.
    """

    def __init__(self) -> None:
        raw_provider = settings.AI_PROVIDER or os.getenv("AI_PROVIDER", "mock")
        self.provider_name = raw_provider.lower()
        self.api_key = settings.AI_API_KEY or os.getenv("AI_API_KEY")

        if self.provider_name in ("openai", "gemini"):
            if not self.api_key:
                logger.warning(
                    f"AI provider is set to '{self.provider_name}' but AI_API_KEY is not configured."
                )
        elif self.provider_name != "mock":
            logger.warning(
                f"AI provider '{self.provider_name}' is not recognized. Falling back to mock provider."
            )
            self.provider_name = "mock"

    # --------------------- Question Generation ---------------------
    def generate_question(self, setup: Dict[str, Any], history: List[Dict[str, Any]]) -> QuestionDTO:
        """Generate a new interview question. Used dynamically for legacy flows or single questions."""
        if self.provider_name == "mock":
            q_number = len(history) + 1
            role = setup.get("job_role", "Software Developer")
            return QuestionDTO(
                text=f"Mock question {q_number} for role {role}. Explain a key concept related to this role.",
                metadata={"mock": True, "question_number": q_number},
            )
        
        # Call batch generator to get a single question if history is used
        questions = self.generate_questions_batch(setup, len(history) + 1)
        return QuestionDTO(
            text=questions[-1],
            metadata={"ai": True, "provider": self.provider_name}
        )

    def generate_questions_batch(self, setup: Dict[str, Any], count: int, resume_text: Optional[str] = None, job_description: Optional[str] = None) -> List[str]:
        """Generate a list of N questions in one batch, optionally using resume and/or job description for personalization."""
        if self.provider_name == "mock":
            return self._generate_mock_questions(setup, count)
        # Build prompt with optional context
        context_parts = []
        if resume_text:
            # Truncate to reasonable length to avoid huge prompts
            truncated_resume = resume_text[:2000]
            context_parts.append(f"Resume Summary:\n{truncated_resume}")
        if job_description:
            context_parts.append(f"Job Description:\n{job_description}")
        context_section = "\n\n".join(context_parts) + ("\n\n" if context_parts else "")
        prompt = (
            f"Generate a list of exactly {count} interview questions for a candidate.\n"
            f"Role: {setup.get('job_role')}\n"
            f"Type: {setup.get('interview_type')}\n"
            f"Experience Level: {setup.get('experience_level')}\n"
            f"Difficulty: {setup.get('difficulty')}\n"
            f"Requirements:\n"
            f"1. Generate exactly {count} questions.\n"
            f"2. Return response as a JSON object with a single key 'questions' containing a list of strings.\n"
            f"Example:\n{{\"questions\": [\"Question 1?\", \"Question 2?\"]}}\n"
        )
        # Append optional context
        if context_section:
            prompt = context_section + prompt
        
        if self.provider_name in ("gemini", "openai") and not self.api_key:
            raise AIConfigError(f"AI provider is set to '{self.provider_name}' but AI_API_KEY is not configured in backend/.env.")
        
        try:
            if self.provider_name == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.api_key}"
                headers = {"Content-Type": "application/json"}
                body = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"responseMimeType": "application/json"}
                }
                res = requests.post(url, json=body, headers=headers, timeout=15)
                res.raise_for_status()
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                questions = parsed.get("questions", [])
                if len(questions) == count:
                    return questions
                logger.warning("Gemini returned %d questions instead of %d. Adjusting count.", len(questions), count)
                if len(questions) > count:
                    return questions[:count]
                elif len(questions) > 0:
                    while len(questions) < count:
                        questions.append(f"Follow-up question about {setup.get('job_role')}.")
                    return questions
            elif self.provider_name == "openai":
                url = "https://api.openai.com/v1/chat/completions"
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}"
                }
                body = {
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": "You are a professional technical recruiter. Return JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"}
                }
                res = requests.post(url, json=body, headers=headers, timeout=15)
                res.raise_for_status()
                data = res.json()
                text = data["choices"][0]["message"]["content"]
                parsed = json.loads(text)
                questions = parsed.get("questions", [])
                if len(questions) == count:
                    return questions
                if len(questions) > count:
                    return questions[:count]
                elif len(questions) > 0:
                    while len(questions) < count:
                        questions.append(f"Follow-up question about {setup.get('job_role')}.")
                    return questions
        except Exception as e:
            logger.error(
                "AI question generation failed: %s. Falling back to mock generation.",
                str(e),
                exc_info=True,
            )
            return self._generate_mock_questions(setup, count)

    def _generate_mock_questions(self, setup: Dict[str, Any], count: int) -> List[str]:
        role = setup.get("job_role", "Software Developer")
        diff = setup.get("difficulty", "Medium")
        level = setup.get("experience_level", "Intermediate")
        itype = setup.get("interview_type", "Technical")
        
        # Separate mock templates for technical and HR interview types
        technical_templates = [
            f"Explain the lifecycle of a request in a typical {role} system.",
            f"What are the best practices for structuring code in a {level} {role} project?",
            f"How do you handle performance bottleneck issues in a {diff} scenario as a {role}?",
            f"Describe a challenging technical problem you solved recently.",
            f"How do you approach writing clean, testable code for {role}?",
            f"Explain how you design database schemas for a scalable application.",
            f"What is your approach to handling error propagation and logging in a production app?",
            f"How do you manage state and caching efficiently in a modern web architecture?",
            f"Discuss the pros and cons of microservices vs monolithic architectures.",
            f"How do you ensure security compliance and prevent common vulnerabilities in your work?",
            f"Explain your process for code reviews and collaboration with other engineers.",
            f"How do you keep up with new technology and decide when to adopt a new framework?",
            f"What is your preference: SQL vs NoSQL databases, and when would you choose one over the other?",
            f"Describe how you troubleshoot a memory leak in a running environment.",
            f"How do you manage CI/CD pipelines and deployment strategies for {role}?"
        ]
        hr_templates = [
            f"Tell me about a time you faced a conflict at work and how you resolved it.",
            f"How do you handle tight deadlines and prioritize tasks?",
            f"Describe a situation where you had to give constructive feedback to a teammate.",
            f"What motivates you in your professional life?",
            f"How do you approach work-life balance and stress management?",
            f"Give an example of a time you displayed leadership without formal authority.",
            f"Explain how you adapt to changes in project requirements.",
            f"What are your long-term career goals and how does this role fit?",
            f"Describe a failure you experienced and what you learned from it.",
            f"How do you build relationships and collaborate across departments?"
        ]
        # Choose template list based on interview_type (itype)
        if itype == "HR":
            mock_templates = hr_templates
        elif itype == "Mixed":
            # Mix half technical, half HR (rounded up)
            half = (len(technical_templates) + len(hr_templates)) // 2
            mock_templates = technical_templates[:half] + hr_templates[: len(hr_templates) - (half - len(technical_templates))]
        else:  # Technical or default
            mock_templates = technical_templates

        questions = []
        for i in range(count):
            template = mock_templates[i % len(mock_templates)]
            questions.append(f"[Mock Q{i+1}] {template}")
        return questions

    # --------------------- Answer Evaluation ---------------------
    def evaluate_answer(self, question: str, answer: str, history: List[Dict[str, Any]]) -> EvaluationDTO:
        """Evaluate a user's answer."""
        if self.provider_name == "mock":
            return self._mock_evaluation(answer)

        prompt = (
            f"Evaluate the candidate's answer to the interview question below.\n"
            f"Question: {question}\n"
            f"Answer: {answer}\n\n"
            f"Return response as a JSON object matching this schema:\n"
            f"{{\n"
            f"  \"score\": 7, // integer 0 to 10\n"
            f"  \"correctness\": 0.8, // float 0 to 1\n"
            f"  \"relevance\": 0.9, // float 0 to 1\n"
            f"  \"technical_depth\": 0.7, // float 0 to 1\n"
            f"  \"communication_quality\": 0.8, // float 0 to 1\n"
            f"  \"strengths\": [\"Clear communication\", \"Understands core concept\"],\n"
            f"  \"weaknesses\": [\"Could explain edge cases\"],\n"
            f"  \"feedback\": \"Your overall feedback here.\"\n"
            f"}}\n"
        )

        try:
            if self.provider_name == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.api_key}"
                headers = {"Content-Type": "application/json"}
                body = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json"
                    }
                }
                res = requests.post(url, json=body, headers=headers, timeout=15)
                res.raise_for_status()
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                return EvaluationDTO(**parsed)

            elif self.provider_name == "openai":
                url = "https://api.openai.com/v1/chat/completions"
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}"
                }
                body = {
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": "You are a professional technical interviewer. Evaluate the candidate's answer and return JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"}
                }
                res = requests.post(url, json=body, headers=headers, timeout=15)
                res.raise_for_status()
                data = res.json()
                text = data["choices"][0]["message"]["content"]
                parsed = json.loads(text)
                return EvaluationDTO(**parsed)

        except Exception as e:
            logger.error("AI answer evaluation failed: %s. Falling back to mock evaluation.", str(e), exc_info=True)

        return self._mock_evaluation(answer)

    def _mock_evaluation(self, answer: str) -> EvaluationDTO:
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

