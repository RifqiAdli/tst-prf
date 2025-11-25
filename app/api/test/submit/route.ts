import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId, scheduleId, forced = false } = await request.json()

    // Get session with answers
    const { data: session } = await supabase
      .from("test_sessions")
      .select("*, answers:user_answers(*)")
      .eq("id", sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Get questions
    const { data: scheduleQuestions } = await supabase
      .from("schedule_questions")
      .select("*, question:questions(*)")
      .eq("schedule_id", scheduleId)

    if (!scheduleQuestions) {
      return NextResponse.json({ error: "Questions not found" }, { status: 404 })
    }

    const questions = scheduleQuestions.map((sq) => sq.question).filter(Boolean)
    const answers = session.answers || []

    // Calculate results
    let correctCount = 0
    const categoryScores: Record<string, { correct: number; total: number }> = {}

    questions.forEach((q) => {
      if (!q) return

      const answer = answers.find((a: { question_id: string }) => a.question_id === q.id)
      const categoryName = (q as { category?: { name: string } }).category?.name || "Uncategorized"

      if (!categoryScores[categoryName]) {
        categoryScores[categoryName] = { correct: 0, total: 0 }
      }
      categoryScores[categoryName].total++

      if (answer?.answer) {
        if (q.type === "multiple_choice") {
          const answerValue = (answer.answer as { value: number }).value
          if (answerValue === q.correct_answer) {
            correctCount++
            categoryScores[categoryName].correct++
          }
        } else if (q.type === "multi_select") {
          const answerValues = (answer.answer as { values: number[] }).values || []
          const correctValues = q.correct_answers || []
          const isCorrect =
            answerValues.length === correctValues.length && answerValues.every((v: number) => correctValues.includes(v))
          if (isCorrect) {
            correctCount++
            categoryScores[categoryName].correct++
          }
        }
      }
    })

    const score = questions.length > 0 ? (correctCount / questions.length) * 100 : 0
    const categoryScoresFinal = Object.fromEntries(
      Object.entries(categoryScores).map(([key, val]) => [key, val.total > 0 ? (val.correct / val.total) * 100 : 0]),
    )

    // Update session
    await supabase
      .from("test_sessions")
      .update({
        status: forced ? "force_submitted" : "completed",
        ended_at: new Date().toISOString(),
      })
      .eq("id", sessionId)

    // Update participant
    await supabase
      .from("schedule_participants")
      .update({ status: forced ? "force_submitted" : "completed" })
      .eq("schedule_id", scheduleId)
      .eq("user_id", user.id)

    // Create or update result
    const { data: result } = await supabase
      .from("test_results")
      .upsert(
        {
          session_id: sessionId,
          user_id: user.id,
          schedule_id: scheduleId,
          total_questions: questions.length,
          answered_questions: answers.length,
          correct_answers: correctCount,
          score,
          category_scores: categoryScoresFinal,
          status: forced ? "force_submitted" : "pending",
        },
        {
          onConflict: "session_id",
        },
      )
      .select()
      .single()

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("Submit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
