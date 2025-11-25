"use client"

import { useState, useCallback, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TestSession, UserAnswer, Question } from "@/types/database.types"

interface UseTestSessionOptions {
  sessionId: string
  onTimeUp?: () => void
}

export function useTestSession({ sessionId, onTimeUp }: UseTestSessionOptions) {
  const [session, setSession] = useState<TestSession | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadSession = useCallback(async () => {
    const { data } = await supabase.from("test_sessions").select("*").eq("id", sessionId).single()

    if (data) {
      setSession(data)
    }
    setLoading(false)
  }, [sessionId, supabase])

  const updateSession = useCallback(
    async (updates: Partial<TestSession>) => {
      const response = await fetch("/api/test/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, updates }),
      })

      if (response.ok) {
        setSession((prev) => (prev ? { ...prev, ...updates } : null))
      }
    },
    [sessionId],
  )

  const updateTimeRemaining = useCallback(
    async (seconds: number) => {
      if (seconds <= 0 && onTimeUp) {
        onTimeUp()
        return
      }
      await updateSession({ time_remaining_seconds: seconds })
    },
    [updateSession, onTimeUp],
  )

  useEffect(() => {
    loadSession()
  }, [loadSession])

  return {
    session,
    loading,
    updateSession,
    updateTimeRemaining,
    refresh: loadSession,
  }
}

interface UseAnswersOptions {
  sessionId: string
  questions: Question[]
}

export function useAnswers({ sessionId, questions }: UseAnswersOptions) {
  const [answers, setAnswers] = useState<Map<string, UserAnswer>>(new Map())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadAnswers = useCallback(async () => {
    const { data } = await supabase.from("user_answers").select("*").eq("session_id", sessionId)

    if (data) {
      const answersMap = new Map<string, UserAnswer>()
      data.forEach((a) => answersMap.set(a.question_id, a))
      setAnswers(answersMap)
    }
    setLoading(false)
  }, [sessionId, supabase])

  const saveAnswer = useCallback(
    async (questionId: string, answer: unknown) => {
      const { data, error } = await supabase
        .from("user_answers")
        .upsert(
          {
            session_id: sessionId,
            question_id: questionId,
            answer: answer as object,
            answered_at: new Date().toISOString(),
          },
          { onConflict: "session_id,question_id" },
        )
        .select()
        .single()

      if (!error && data) {
        setAnswers((prev) => new Map(prev).set(questionId, data))
      }
      return { data, error }
    },
    [sessionId, supabase],
  )

  const toggleMark = useCallback(
    async (questionId: string) => {
      const currentAnswer = answers.get(questionId)

      if (currentAnswer) {
        const { data } = await supabase
          .from("user_answers")
          .update({ is_marked: !currentAnswer.is_marked })
          .eq("id", currentAnswer.id)
          .select()
          .single()

        if (data) {
          setAnswers((prev) => new Map(prev).set(questionId, data))
        }
      } else {
        const { data } = await supabase
          .from("user_answers")
          .insert({
            session_id: sessionId,
            question_id: questionId,
            answer: null,
            is_marked: true,
          })
          .select()
          .single()

        if (data) {
          setAnswers((prev) => new Map(prev).set(questionId, data))
        }
      }
    },
    [sessionId, answers, supabase],
  )

  const getStats = useCallback(() => {
    const answered = Array.from(answers.values()).filter((a) => a.answer !== null).length
    const marked = Array.from(answers.values()).filter((a) => a.is_marked).length
    const total = questions.length

    return {
      answered,
      unanswered: total - answered,
      marked,
      total,
      progress: total > 0 ? (answered / total) * 100 : 0,
    }
  }, [answers, questions])

  useEffect(() => {
    loadAnswers()
  }, [loadAnswers])

  return {
    answers,
    loading,
    saveAnswer,
    toggleMark,
    getStats,
    refresh: loadAnswers,
  }
}
