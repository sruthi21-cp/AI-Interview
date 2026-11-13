import os
from typing import List, Dict, Any, Optional

try:
    from fastapi import HTTPException, status
except ImportError:
    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            self.status_code = status_code
            self.detail = detail
    class status:
        HTTP_404_NOT_FOUND = 404
from datetime import datetime

from app.models.interview_session import InterviewSession
from app.schemas.interview import InterviewSessionResponse, InterviewSessionCreate
from app.services.ai import AIProvider
from sqlalchemy.orm import Session


import json

from app.services.knowledge.retriever import LocalKnowledgeRetriever
from app.services.adaptive_engine import AdaptiveDecisionEngine, AdaptiveDecision

class InterviewEngine:
    def __init__(self):
        # Initialize AI provider (mock or real based on env)
        self.provider = AIProvider()
        self.decision_engine = AdaptiveDecisionEngine()

    def _get_session(self, db: Session, session_id: int) -> InterviewSession:
        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")
        return session

    def create_session(
        self,
        db: Session,
        session_in: InterviewSessionCreate,
        user_id: int,
        resume_text: Optional[str] = None,
        job_description: Optional[str] = None,
        resume_profile: Optional[Dict[str, Any]] = None,
    ) -> InterviewSession:
        # Determine candidate skills for knowledge retrieval
        effective_skills = list(session_in.selected_skills or session_in.resume_skills or [])

        # Parse resume profile if resume_text provided, or use provided profile
        resume_profile_dict = dict(resume_profile) if resume_profile else {}
        if not resume_profile_dict and resume_text and resume_text.strip():
            try:
                from app.services.resume_parser import ResumeParserService
                parser = ResumeParserService(self.provider)
                parsed = parser.parse_resume_text(resume_text)
                resume_profile_dict = parsed.get("profile") or {}
                if not session_in.resume_skills and parsed.get("extracted_skills"):
                    session_in.resume_skills = parsed["extracted_skills"]
                    if not effective_skills:
                        effective_skills = list(session_in.resume_skills)
            except Exception as parse_err:
                pass

        # Retrieve curated topic records for grounding
        retriever = LocalKnowledgeRetriever()
        retrieved_topics = retriever.retrieve(
            selected_skills=effective_skills,
            difficulty=session_in.difficulty,
            experience_level=session_in.experience_level,
            max_topics=min(session_in.question_count * 3, 24)
        )
        retrieved_dicts = [r.to_dict() for r in retrieved_topics]
        source_refs = retriever.get_source_references(effective_skills)

        # Initialize adaptive state
        adaptive_state_dict = self.decision_engine.initialize_state(
            initial_difficulty=session_in.difficulty,
            selected_skills=session_in.selected_skills,
            resume_skills=session_in.resume_skills,
            available_topics=retrieved_dicts,
        )

        # Determine decision for Q1 (baseline)
        initial_decision = self.decision_engine.determine_next_question(
            interview_state=adaptive_state_dict,
            latest_evaluation=None,
            resume_context=resume_profile_dict,
            selected_skills=effective_skills,
            available_topics=retrieved_dicts,
        )

        # Generate initial adaptive Question 1
        q1 = self.provider.generate_adaptive_next_question(
            setup={
                "job_role": session_in.job_role,
                "interview_type": session_in.interview_type,
                "experience_level": session_in.experience_level,
                "difficulty": session_in.difficulty,
                "interview_language": session_in.interview_language or "English",
                "selected_skills": session_in.selected_skills or [],
                "resume_skills": session_in.resume_skills or [],
            },
            questions_asked=[],
            evaluations=[],
            adaptive_state=adaptive_state_dict,
            resume_profile=resume_profile_dict,
            retrieved_knowledge=retrieved_dicts,
            decision=initial_decision,
        )

        if not q1:
            setup = {
                "job_role": session_in.job_role,
                "interview_type": session_in.interview_type,
                "experience_level": session_in.experience_level,
                "difficulty": session_in.difficulty,
                "question_count": 1,
                "interview_language": session_in.interview_language or "English",
                "resume_skills": session_in.resume_skills or [],
                "selected_skills": session_in.selected_skills or [],
            }
            q_batch = self.provider.generate_questions_batch(
                setup, 1, resume_text=resume_text, job_description=job_description, retrieved_knowledge=retrieved_dicts
            )
            q1 = q_batch[0] if q_batch else "Can you describe a challenging project you worked on recently?"

        questions_list = [q1]
        adaptive_state_dict.setdefault("questions_asked", []).append(q1)
        adaptive_state_dict.setdefault("conversation_history", []).append({"question": q1})

        # Create interview session record and set status to in_progress
        new_session = InterviewSession(
            user_id=user_id,
            job_role=session_in.job_role,
            interview_type=session_in.interview_type,
            experience_level=session_in.experience_level,
            difficulty=session_in.difficulty,
            question_count=session_in.question_count,
            job_description=job_description,
            interview_language=session_in.interview_language or "English",
            resume_skills=json.dumps(session_in.resume_skills or []),
            selected_skills=json.dumps(session_in.selected_skills or []),
            resume_profile=json.dumps(resume_profile_dict),
            adaptive_state=json.dumps(adaptive_state_dict),
            source_context=json.dumps(source_refs),
            status="in_progress",
            questions=json.dumps(questions_list),
            evaluations='[]',
            answered_count=0,
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return new_session

    def get_next_question(self, db: Session, session_id: int) -> Dict[str, Any]:
        session = self._get_session(db, session_id)
        questions_list = json.loads(session.questions or '[]')
        idx = session.answered_count or 0

        if idx >= session.question_count:
            return {
                "question_id": None,
                "text": "No more questions. The interview is complete.",
                "metadata": {"complete": True, "total_questions": session.question_count}
            }

        # If question for this index has not been generated yet, generate dynamically
        if idx >= len(questions_list):
            adaptive_state_dict = json.loads(session.adaptive_state or '{}')
            resume_profile_dict = json.loads(session.resume_profile or '{}')
            evals = json.loads(session.evaluations or '[]')
            
            selected_skills = json.loads(session.selected_skills or '[]')
            resume_skills = json.loads(session.resume_skills or '[]')
            effective_skills = selected_skills or resume_skills or []
            
            retriever = LocalKnowledgeRetriever()
            retrieved_topics = retriever.retrieve(
                selected_skills=effective_skills,
                difficulty=adaptive_state_dict.get("current_difficulty", session.difficulty),
                experience_level=session.experience_level
            )
            retrieved_dicts = [r.to_dict() for r in retrieved_topics]

            latest_eval = evals[-1] if evals else None
            decision = self.decision_engine.determine_next_question(
                interview_state=adaptive_state_dict,
                latest_evaluation=latest_eval,
                resume_context=resume_profile_dict,
                selected_skills=effective_skills,
                available_topics=retrieved_dicts,
            )

            next_q = self.provider.generate_adaptive_next_question(
                setup={
                    "job_role": session.job_role,
                    "interview_type": session.interview_type,
                    "experience_level": session.experience_level,
                    "difficulty": decision.difficulty or adaptive_state_dict.get("current_difficulty", session.difficulty),
                    "interview_language": session.interview_language or "English",
                    "selected_skills": selected_skills,
                    "resume_skills": resume_skills,
                },
                questions_asked=questions_list,
                evaluations=evals,
                adaptive_state=adaptive_state_dict,
                resume_profile=resume_profile_dict,
                retrieved_knowledge=retrieved_dicts,
                decision=decision,
            )

            # Deduplication check
            candidate_q = next_q
            if candidate_q in questions_list or self.decision_engine.is_semantically_duplicate(candidate_q, questions_list):
                fallbacks = [
                    f"In {decision.next_skill} ({decision.next_topic}), how do you optimize for production performance and handle edge cases?",
                    f"Let's explore another aspect of {decision.next_skill} ({decision.next_topic}): how do you test and debug issues in production?",
                    f"When working with {decision.next_skill} ({decision.next_topic}), what architecture patterns prevent memory leaks and performance bottlenecks?",
                ]
                for fb in fallbacks:
                    if fb not in questions_list and not self.decision_engine.is_semantically_duplicate(fb, questions_list):
                        candidate_q = fb
                        break
            next_q = candidate_q

            questions_list.append(next_q)
            session.questions = json.dumps(questions_list)
            conv_history = adaptive_state_dict.setdefault("conversation_history", [])
            conv_history.append({"question": next_q})
            adaptive_state_dict.setdefault("questions_asked", []).append(next_q)
            session.adaptive_state = json.dumps(adaptive_state_dict)
            db.add(session)
            db.commit()

        question_text = questions_list[idx]
        adaptive_state_dict = json.loads(session.adaptive_state or '{}')
        selected_skills = json.loads(session.selected_skills or '[]')
        resume_skills = json.loads(session.resume_skills or '[]')
        focus_skills = selected_skills or resume_skills or []
        detected_topic, _ = self.decision_engine.classify_question_topic(question_text, candidate_skills=focus_skills)

        return {
            "question_id": idx + 1,
            "text": question_text,
            "metadata": {
                "question_number": idx + 1,
                "total_questions": session.question_count,
                "current_difficulty": adaptive_state_dict.get("current_difficulty", session.difficulty),
                "topic": detected_topic,
                "adaptive": True,
            },
        }

    def submit_answer(self, db: Session, session_id: int, answer: str) -> Dict[str, Any]:
        session = self._get_session(db, session_id)
        questions_list = json.loads(session.questions or '[]')
        idx = session.answered_count or 0

        if idx >= session.question_count:
            raise HTTPException(status_code=400, detail="All questions have already been answered.")

        if idx >= len(questions_list):
            raise HTTPException(status_code=400, detail="Current question was not found in session.")

        question_text = questions_list[idx]

        # Fetch trusted technical knowledge context for evaluation grounding
        selected_skills = json.loads(session.selected_skills or '[]')
        resume_skills = json.loads(session.resume_skills or '[]')
        effective_skills = selected_skills or resume_skills or [session.job_role]

        retriever = LocalKnowledgeRetriever()
        retrieved_topics = retriever.retrieve(
            selected_skills=effective_skills,
            difficulty=session.difficulty,
            experience_level=session.experience_level
        )
        retrieved_dicts = [r.to_dict() for r in retrieved_topics]

        # Evaluate answer using the AI provider with trusted knowledge context
        evaluation_dto = self.provider.evaluate_answer(
            question_text,
            answer,
            [],
            experience_level=session.experience_level,
            job_role=session.job_role,
            difficulty=session.difficulty,
            retrieved_knowledge=retrieved_dicts,
        )

        # Relevance gate: if relevance < 0.4, score cannot exceed 2.0
        final_score = min(float(evaluation_dto.score), 2.0) if evaluation_dto.relevance < 0.4 else float(evaluation_dto.score)

        eval_dict = {
            "question": question_text,
            "answer": answer,
            "score": final_score,
            "feedback": evaluation_dto.feedback,
            "correctness": evaluation_dto.correctness,
            "relevance": evaluation_dto.relevance,
            "technical_depth": evaluation_dto.technical_depth,
            "communication_quality": evaluation_dto.communication_quality,
            "conceptual_understanding": evaluation_dto.conceptual_understanding,
            "explanation_clarity": evaluation_dto.explanation_clarity,
            "problem_solving": evaluation_dto.problem_solving,
            "practical_examples": evaluation_dto.practical_examples,
            "answer_summary": evaluation_dto.answer_summary,
            "correct_points": evaluation_dto.correct_points,
            "incorrect_statements": evaluation_dto.incorrect_statements,
            "missing_concepts": evaluation_dto.missing_concepts,
            "knowledge_gaps": evaluation_dto.knowledge_gaps,
            "expected_answer": evaluation_dto.expected_answer,
            "scoring_rationale": evaluation_dto.scoring_rationale,
            "strengths": evaluation_dto.strengths,
            "weaknesses": evaluation_dto.weaknesses,
        }

        # Update adaptive state
        adaptive_state_dict = json.loads(session.adaptive_state or '{}')
        conv_history = adaptive_state_dict.setdefault("conversation_history", [])
        if conv_history and conv_history[-1].get("question") == question_text:
            conv_history[-1]["answer"] = answer
            conv_history[-1]["score"] = final_score
        else:
            conv_history.append({"question": question_text, "answer": answer, "score": final_score})

        # Classify topic and skill using AdaptiveDecisionEngine
        selected_skills = json.loads(session.selected_skills or '[]')
        resume_skills = json.loads(session.resume_skills or '[]')
        all_skills = selected_skills or resume_skills or []

        detected_topic, detected_skill = self.decision_engine.classify_question_topic(
            question=question_text,
            answer=answer,
            candidate_skills=all_skills,
            weaknesses=evaluation_dto.weaknesses,
            job_role=session.job_role,
        )

        # Update fine-grained state and difficulty via decision engine
        adaptive_state_dict = self.decision_engine.update_adaptive_state(
            state=adaptive_state_dict,
            question=question_text,
            answer=answer,
            evaluation=eval_dict,
            detected_topic=detected_topic,
            detected_skill=detected_skill,
        )
        curr_diff = adaptive_state_dict.get("current_difficulty", session.difficulty or "Medium")

        # Persist evaluation
        existing_evals = json.loads(session.evaluations or '[]')
        existing_evals.append(eval_dict)
        session.evaluations = json.dumps(existing_evals)

        # Increment answered count
        session.answered_count = idx + 1

        # If more questions remain, generate next adaptive question using decision engine
        if session.answered_count < session.question_count:
            try:
                resume_profile_dict = json.loads(session.resume_profile or '{}')
                retriever = LocalKnowledgeRetriever()
                retrieved_topics = retriever.retrieve(
                    selected_skills=all_skills,
                    difficulty=curr_diff,
                    experience_level=session.experience_level
                )
                retrieved_dicts = [r.to_dict() for r in retrieved_topics]

                next_decision = self.decision_engine.determine_next_question(
                    interview_state=adaptive_state_dict,
                    latest_evaluation=eval_dict,
                    resume_context=resume_profile_dict,
                    selected_skills=all_skills,
                    available_topics=retrieved_dicts,
                )

                next_q = self.provider.generate_adaptive_next_question(
                    setup={
                        "job_role": session.job_role,
                        "interview_type": session.interview_type,
                        "experience_level": session.experience_level,
                        "difficulty": next_decision.difficulty or curr_diff,
                        "interview_language": session.interview_language or "English",
                        "selected_skills": selected_skills,
                        "resume_skills": resume_skills,
                    },
                    questions_asked=questions_list,
                    evaluations=existing_evals,
                    adaptive_state=adaptive_state_dict,
                    resume_profile=resume_profile_dict,
                    retrieved_knowledge=retrieved_dicts,
                    decision=next_decision,
                )

                # Deduplication validation
                candidate_q = next_q
                if candidate_q in questions_list or self.decision_engine.is_semantically_duplicate(candidate_q, questions_list):
                    skill_name = getattr(next_decision, 'next_skill', None) or (selected_skills[0] if selected_skills else session.job_role) or "software engineering"
                    topic_name = getattr(next_decision, 'next_topic', None) or "production best practices"
                    fallbacks = [
                        f"In {skill_name} ({topic_name}), how do you optimize for production performance and handle edge cases?",
                        f"Let's explore another aspect of {skill_name} ({topic_name}): how do you test and debug issues in production?",
                        f"When working with {skill_name} ({topic_name}), what architecture patterns prevent memory leaks and performance bottlenecks?",
                    ]
                    for fb in fallbacks:
                        if fb not in questions_list and not self.decision_engine.is_semantically_duplicate(fb, questions_list):
                            candidate_q = fb
                            break
                next_q = candidate_q

                questions_list.append(next_q)
                conv_history.append({"question": next_q})
                adaptive_state_dict.setdefault("questions_asked", []).append(next_q)
                session.questions = json.dumps(questions_list)
            except Exception as ad_err:
                logger.warning("Adaptive next-question generation failed; using deterministic fallback question: %s", ad_err)
                fallback_skill = (all_skills[session.answered_count % len(all_skills)]) if all_skills else (session.job_role or "Software Engineering")
                fallback_q = f"In {fallback_skill}, how do you approach error handling, debugging, and edge-case validation in production systems?"
                if fallback_q in questions_list:
                    fallback_q = f"What are the key trade-offs and performance considerations when implementing architecture solutions with {fallback_skill}?"
                next_q = fallback_q
                questions_list.append(next_q)
                conv_history.append({"question": next_q})
                adaptive_state_dict.setdefault("questions_asked", []).append(next_q)
                session.questions = json.dumps(questions_list)

        # If all questions answered, mark session completed
        if session.answered_count >= session.question_count:
            session.status = "completed"
            session.completed_at = datetime.utcnow()

        session.adaptive_state = json.dumps(adaptive_state_dict)

        try:
            db.add(session)
            db.commit()
        except Exception as db_err:
            db.rollback()
            logger.error("Failed to commit answer evaluation to database: %s", db_err, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database commit failed while saving your answer: {str(db_err)}"
            )

        return eval_dict

    def get_aggregated_evaluation(self, db: Session, session_id: int) -> Dict[str, Any]:
        """Aggregate all per-question evaluations into a final summary."""
        session = self._get_session(db, session_id)
        evals = json.loads(session.evaluations or '[]')

        if not evals:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No evaluations found for this interview session."
            )

        count = len(evals)

        avg_score = round(sum(e.get("score", 0) for e in evals) / count, 1)
        avg_correctness = round(sum(e.get("correctness", 0) for e in evals) / count, 3)
        avg_relevance = round(sum(e.get("relevance", 0) for e in evals) / count, 3)
        avg_technical_depth = round(sum(e.get("technical_depth", 0) for e in evals) / count, 3)
        avg_communication = round(sum(e.get("communication_quality", 0) for e in evals) / count, 3)
        avg_conceptual = round(sum(e.get("conceptual_understanding", e.get("correctness", 0)) for e in evals) / count, 3)
        avg_clarity = round(sum(e.get("explanation_clarity", e.get("communication_quality", 0)) for e in evals) / count, 3)

        # Collect all unique strengths, weaknesses, and deep feedback items
        all_strengths = []
        all_weaknesses = []
        all_correct_points = []
        all_incorrect_statements = []
        all_missing_concepts = []
        all_knowledge_gaps = []
        all_feedback = []

        for e in evals:
            all_strengths.extend(e.get("strengths", []))
            all_weaknesses.extend(e.get("weaknesses", []))
            all_correct_points.extend(e.get("correct_points", []))
            all_incorrect_statements.extend(e.get("incorrect_statements", []))
            all_missing_concepts.extend(e.get("missing_concepts", []))
            all_knowledge_gaps.extend(e.get("knowledge_gaps", []))
            if e.get("feedback"):
                all_feedback.append(e["feedback"])

        unique_strengths = list(dict.fromkeys(all_strengths))
        unique_weaknesses = list(dict.fromkeys(all_weaknesses))
        unique_correct = list(dict.fromkeys(all_correct_points))
        unique_incorrect = list(dict.fromkeys(all_incorrect_statements))
        unique_missing = list(dict.fromkeys(all_missing_concepts))
        unique_gaps = list(dict.fromkeys(all_knowledge_gaps))

        adaptive_state = json.loads(session.adaptive_state or '{}')
        strong_topics = adaptive_state.get("strong_topics", [])
        weak_topics = adaptive_state.get("weak_topics", [])

        return {
            "session_id": session.id,
            "job_role": session.job_role,
            "interview_type": session.interview_type,
            "difficulty": session.difficulty,
            "question_count": session.question_count,
            "answered_count": session.answered_count or count,
            "status": session.status,
            "overall_score": avg_score,
            "overall_correctness": avg_correctness,
            "overall_relevance": avg_relevance,
            "overall_technical_depth": avg_technical_depth,
            "overall_communication_quality": avg_communication,
            "overall_conceptual_understanding": avg_conceptual,
            "overall_explanation_clarity": avg_clarity,
            "strengths": unique_strengths,
            "weaknesses": unique_weaknesses,
            "correct_points": unique_correct,
            "incorrect_statements": unique_incorrect,
            "missing_concepts": unique_missing,
            "knowledge_gaps": unique_gaps,
            "strong_topics": strong_topics,
            "weak_topics": weak_topics,
            "feedback": " | ".join(all_feedback) if all_feedback else "No feedback available.",
            "per_question_evaluations": evals,
        }

    def get_user_analytics(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Compute analytics across all interview sessions for a specific user.
        Returns a dict with overall statistics, verified strengths, verified weaknesses,
        prioritized concepts to improve, per-question evaluations, and recent sessions.
        """
        # Fetch all sessions strictly for this user (user isolation)
        sessions = db.query(InterviewSession).filter(InterviewSession.user_id == user_id).order_by(InterviewSession.created_at.desc()).all()
        total = len(sessions)
        completed_sessions = [s for s in sessions if s.status == "completed"]
        in_progress = len([s for s in sessions if s.status == "in_progress"])

        scores = []
        correctness = []
        relevance = []
        technical = []
        communication = []
        strengths = []
        weaknesses = []
        trend = []
        recent = []

        # Topic aggregation for verified strengths, weaknesses, and improvement roadmap
        topic_aggregates: Dict[str, Dict[str, Any]] = {}
        all_evaluations_list: List[Dict[str, Any]] = []

        for sess in completed_sessions:
            agg = self.get_aggregated_evaluation(db, sess.id)
            overall = agg.get("overall_score", 0)
            scores.append(overall)
            correctness.append(agg.get("overall_correctness", 0))
            relevance.append(agg.get("overall_relevance", 0))
            technical.append(agg.get("overall_technical_depth", 0))
            communication.append(agg.get("overall_communication_quality", 0))
            strengths.extend(agg.get("strengths", []))
            weaknesses.extend(agg.get("weaknesses", []))
            trend.append({"date": sess.created_at.isoformat(), "score": overall})
            recent.append({
                "id": sess.id,
                "job_role": sess.job_role,
                "interview_type": sess.interview_type,
                "difficulty": sess.difficulty,
                "score": overall,
                "status": sess.status,
                "date": sess.created_at.isoformat(),
            })

            evals = agg.get("per_question_evaluations", [])
            for e in evals:
                q_text = e.get("question", "")
                a_text = e.get("answer", "")
                score_val = float(e.get("score", 0.0))

                # Identify topic from question and answer
                detected_topic, detected_skill = self.decision_engine.classify_question_topic(
                    question=q_text,
                    answer=a_text,
                    job_role=sess.job_role,
                )

                if detected_topic not in topic_aggregates:
                    topic_aggregates[detected_topic] = {
                        "topic": detected_topic,
                        "skill": detected_skill or sess.job_role or "Technical",
                        "scores": [],
                        "correct_points": [],
                        "incorrect_statements": [],
                        "missing_concepts": [],
                        "knowledge_gaps": [],
                        "expected_answers": [],
                        "sample_answers": [],
                        "questions": [],
                    }

                topic_aggregates[detected_topic]["scores"].append(score_val)
                topic_aggregates[detected_topic]["correct_points"].extend(e.get("correct_points", []))
                topic_aggregates[detected_topic]["incorrect_statements"].extend(e.get("incorrect_statements", []))
                topic_aggregates[detected_topic]["missing_concepts"].extend(e.get("missing_concepts", []))
                topic_aggregates[detected_topic]["knowledge_gaps"].extend(e.get("knowledge_gaps", []))
                if e.get("expected_answer"):
                    topic_aggregates[detected_topic]["expected_answers"].append(e["expected_answer"])
                topic_aggregates[detected_topic]["sample_answers"].append(a_text)
                topic_aggregates[detected_topic]["questions"].append(q_text)

                all_evaluations_list.append({
                    "session_id": sess.id,
                    "job_role": sess.job_role,
                    "difficulty": sess.difficulty,
                    "question": q_text,
                    "answer": a_text,
                    "score": score_val,
                    "answer_summary": e.get("answer_summary") or e.get("feedback", ""),
                    "correct_points": e.get("correct_points", []),
                    "incorrect_statements": e.get("incorrect_statements", []),
                    "missing_concepts": e.get("missing_concepts", []),
                    "knowledge_gaps": e.get("knowledge_gaps", []),
                    "expected_answer": e.get("expected_answer", ""),
                    "scoring_rationale": e.get("scoring_rationale", ""),
                    "feedback": e.get("feedback", ""),
                    "topic": detected_topic,
                    "skill": detected_skill,
                })

        trend.sort(key=lambda x: x["date"])
        recent = recent[:5]

        avg_score = round(sum(scores) / len(scores), 1) if scores else None
        best_score = max(scores) if scores else None
        latest_score = scores[0] if scores else None
        avg_correctness = round(sum(correctness) / len(correctness), 3) if correctness else None
        avg_relevance = round(sum(relevance) / len(relevance), 3) if relevance else None
        avg_technical = round(sum(technical) / len(technical), 3) if technical else None
        avg_communication = round(sum(communication) / len(communication), 3) if communication else None

        unique_strengths = list(dict.fromkeys(strengths))
        unique_weaknesses = list(dict.fromkeys(weaknesses))

        # Build Verified Strengths (strictly evaluated questions with avg score >= 7.0)
        verified_strengths = []
        verified_weaknesses = []
        concepts_to_improve = []

        for top, d in topic_aggregates.items():
            top_scores = d["scores"]
            top_avg = round(sum(top_scores) / len(top_scores), 1)
            count_eval = len(top_scores)

            # Verified Strength Rule: Must be evaluated with average score >= 7.0
            if top_avg >= 7.0:
                cp_list = list(dict.fromkeys(d["correct_points"]))
                what_done = cp_list[0] if cp_list else f"Demonstrated sound understanding of {top}"
                # Answer evidence excerpt
                sample_ans = d["sample_answers"][0] if d["sample_answers"] else ""
                evidence_text = f"Candidate answered: \"{sample_ans[:140]}...\"" if len(sample_ans) > 140 else f"Candidate answered: \"{sample_ans}\""
                verified_strengths.append({
                    "concept": top,
                    "skill": d["skill"],
                    "score": top_avg,
                    "evaluations_count": count_eval,
                    "what_done_correctly": what_done,
                    "evidence": evidence_text if sample_ans else "Demonstrated accurate technical definitions and constraints.",
                })

            # Verified Weakness Rule: Average score < 6.5 or explicit knowledge gaps/contradictions
            if top_avg < 6.5 or len(d["incorrect_statements"]) > 0 or len(d["knowledge_gaps"]) > 0:
                inc_list = list(dict.fromkeys(d["incorrect_statements"]))
                gaps_list = list(dict.fromkeys(d["knowledge_gaps"]))
                miss_list = list(dict.fromkeys(d["missing_concepts"]))

                misunderstood = inc_list[0] if inc_list else (gaps_list[0] if gaps_list else (miss_list[0] if miss_list else "Incomplete coverage of core concepts"))
                why_weak = f"Score averaged {top_avg}/10 across {count_eval} question(s) with identified gaps in {top}."
                if inc_list:
                    why_weak = f"Factually incorrect statement detected: {inc_list[0]}"

                sample_q = d["questions"][0] if d["questions"] else top
                sample_a = d["sample_answers"][0] if d["sample_answers"] else ""
                demonstrated = f"On '{sample_q[:80]}', candidate stated: \"{sample_a[:120]}...\"" if sample_a else f"Demonstrated in question on {sample_q[:80]}."
                correct_exp = d["expected_answers"][0] if d["expected_answers"] else f"Review official technical specifications for {top} and ensure accurate definitions."

                verified_weaknesses.append({
                    "topic": top,
                    "skill": d["skill"],
                    "score": top_avg,
                    "evaluations_count": count_eval,
                    "why_weak": why_weak,
                    "misunderstood_or_missed": misunderstood,
                    "demonstrated_answer": demonstrated,
                    "correct_explanation": correct_exp,
                    "recommended_practice": f"Practice 2-3 focused mock questions on {top} with attention to edge cases and trade-offs.",
                })

                # Add to Concepts to Improve roadmap with priority
                if top_avg <= 4.5 or len(inc_list) > 0:
                    priority = "High"
                    reason = f"Fundamental misunderstanding or low score ({top_avg}/10) directly affecting interview readiness."
                elif top_avg <= 6.5:
                    priority = "Medium"
                    reason = f"Moderate score ({top_avg}/10) showing partial understanding but missing depth or key edge cases."
                else:
                    priority = "Low"
                    reason = f"Good baseline ({top_avg}/10), but minor gaps observed in comprehensive explanation."

                concepts_to_improve.append({
                    "topic": top,
                    "priority": priority,
                    "reason": reason,
                    "learning_objective": f"Master {top} core mechanisms, architectural trade-offs, and best practices.",
                    "practice_questions": [
                        f"How does {top} work under the hood and what are its key performance trade-offs?",
                        f"Explain a production scenario where {top} could fail or cause bottlenecks.",
                    ],
                    "expected_outcome": f"Able to deliver clear, accurate, and in-depth responses on {top} in senior-level interviews.",
                })

        # Sort strengths by score desc; weaknesses by score asc; concepts by priority (High -> Medium -> Low)
        verified_strengths.sort(key=lambda x: x["score"], reverse=True)
        verified_weaknesses.sort(key=lambda x: x["score"])
        priority_order = {"High": 1, "Medium": 2, "Low": 3}
        concepts_to_improve.sort(key=lambda x: priority_order.get(x["priority"], 4))

        # Performance Comparison between first completed and latest completed session
        performance_comparison = None
        if len(scores) >= 2:
            first_score = scores[-1]
            last_score = scores[0]
            delta = round(last_score - first_score, 1)
            sign = "+" if delta > 0 else ""
            summary_text = (
                f"You improved by {sign}{delta} points from your initial session ({first_score}/10) to your latest session ({last_score}/10)."
                if delta > 0
                else (
                    f"Your performance has remained consistent around {last_score}/10."
                    if delta == 0
                    else f"Your latest score ({last_score}/10) was lower than your initial session ({first_score}/10). Review the identified growth areas."
                )
            )
            performance_comparison = {
                "first_session_score": first_score,
                "latest_session_score": last_score,
                "score_delta": delta,
                "improved_topics": [s["concept"] for s in verified_strengths[:3]],
                "regressed_or_stagnant_topics": [w["topic"] for w in verified_weaknesses[:3]],
                "summary": summary_text,
            }
        elif len(scores) == 1:
            performance_comparison = {
                "first_session_score": scores[0],
                "latest_session_score": scores[0],
                "score_delta": 0.0,
                "improved_topics": [],
                "regressed_or_stagnant_topics": [],
                "summary": f"Baseline established at {scores[0]}/10. Complete more sessions to track improvement over time.",
            }

        return {
            "total_interviews": total,
            "completed_interviews": len(completed_sessions),
            "in_progress_interviews": in_progress,
            "average_score": avg_score,
            "best_score": best_score,
            "latest_score": latest_score,
            "average_correctness": avg_correctness,
            "average_relevance": avg_relevance,
            "average_technical_depth": avg_technical,
            "average_communication_quality": avg_communication,
            "strengths": unique_strengths,
            "weaknesses": unique_weaknesses,
            "verified_strengths": verified_strengths,
            "verified_weaknesses": verified_weaknesses,
            "concepts_to_improve": concepts_to_improve,
            "performance_comparison": performance_comparison,
            "recent_evaluations": all_evaluations_list[:8],
            "trend": trend,
            "recent_interviews": recent,
        }

