"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Lock, Clock, FileQuestion, AlertTriangle, Flag, ChevronLeft, ChevronRight, Send } from "lucide-react"
import { TestTimer } from "@/components/test/test-timer"
import { QuestionRenderer } from "@/components/test/question-renderer"
import { NavigationGrid } from "@/components/test/navigation-grid"
import { AntiCheatMonitor } from "@/components/test/anti-cheat-monitor"
import type { TestSchedule, Question, TestSession, UserAnswer } from "@/types/database.types"

export default function TestPage() {
  const params = useParams()
  const router = useRouter()
  const scheduleId = params.scheduleId as string
  const supabase = createClient()

  // States
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<TestSchedule | null>(null)
  const [session, setSession] = useState<TestSession | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Map<string, UserAnswer>>(new Map())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [token, setToken] = useState("")
  const [tokenError, setTokenError] = useState("")
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [testStarted, setTestStarted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [strikeCount, setStrikeCount] = useState(0)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [warningType, setWarningType] = useState("")

  // Load schedule data
  useEffect(() => {
    async function loadSchedule() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        
        if (!user) {
          router.push("/login")
          return
        }

        console.log("Loading schedule for user:", user.id, "schedule:", scheduleId)

        // Check participation
        const { data: participation, error: partError } = await supabase
          .from("schedule_participants")
          .select("*, schedule:test_schedules(*)")
          .eq("schedule_id", scheduleId)
          .eq("user_id", user.id)
          .single()

        if (partError) {
          console.error("Participation error:", partError)
          setError(`Error loading participation: ${partError.message}`)
          setLoading(false)
          return
        }

        if (!participation?.schedule) {
          console.log("No participation found")
          setError("Anda tidak terdaftar untuk test ini")
          setLoading(false)
          return
        }

        setSchedule(participation.schedule)

        // Check if session exists
        const { data: existingSession, error: sessionError } = await supabase
          .from("test_sessions")
          .select("*")
          .eq("schedule_id", scheduleId)
          .eq("user_id", user.id)
          .maybeSingle()

        if (sessionError) {
          console.error("Session error:", sessionError)
          // Don't fail here, just log and continue
        }

        if (existingSession && existingSession.status === "active") {
          // Resume existing session
          console.log("Resuming existing session")
          await loadSession(existingSession)
        } else if (participation.status === "completed" || participation.status === "force_submitted") {
          // Already completed
          console.log("Test already completed")
          router.push(`/history/${scheduleId}`)
          return
        } else {
          // Need to start new session
          console.log("Need token to start new session")
          setShowTokenModal(true)
        }

        setLoading(false)
      } catch (err) {
        console.error("Unexpected error:", err)
        setError(`Unexpected error: ${err.message}`)
        setLoading(false)
      }
    }

    loadSchedule()
  }, [scheduleId, router])

  const loadSession = async (testSession: TestSession) => {
    try {
      setSession(testSession)
      setStrikeCount(testSession.strike_count || 0)

      // Load questions
      const { data: scheduleQuestions, error: qError } = await supabase
        .from("schedule_questions")
        .select("*, question:questions(*)")
        .eq("schedule_id", scheduleId)
        .order("order_index")

      if (qError) {
        console.error("Questions error:", qError)
        setError(`Error loading questions: ${qError.message}`)
        return
      }

      if (scheduleQuestions) {
        const loadedQuestions = scheduleQuestions
          .map((sq) => sq.question)
          .filter((q): q is Question => q !== null)

        // Apply shuffle order if exists
        if (testSession.question_order && testSession.question_order.length > 0) {
          const orderedQuestions = testSession.question_order
            .map((idx) => loadedQuestions[idx])
            .filter(Boolean)
          setQuestions(orderedQuestions)
        } else {
          setQuestions(loadedQuestions)
        }
      }

      // Load existing answers
      const { data: existingAnswers, error: aError } = await supabase
        .from("user_answers")
        .select("*")
        .eq("session_id", testSession.id)

      if (aError) {
        console.error("Answers error:", aError)
      }

      if (existingAnswers) {
        const answersMap = new Map<string, UserAnswer>()
        existingAnswers.forEach((a) => answersMap.set(a.question_id, a))
        setAnswers(answersMap)
      }

      setCurrentIndex(testSession.current_question_index || 0)
      setTestStarted(true)
    } catch (err) {
      console.error("Load session error:", err)
      setError(`Error loading session: ${err.message}`)
    }
  }

  const handleTokenSubmit = async () => {
    if (!token.trim()) {
      setTokenError("Masukkan token test")
      return
    }

    setLoading(true)
    setTokenError("")

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Validate token
      if (schedule?.token !== token.toUpperCase()) {
        setTokenError("Token tidak valid")
        setLoading(false)
        return
      }

      // Check time window
      const now = new Date()
      const start = new Date(schedule.start_time)
      const end = new Date(schedule.end_time)

      if (now < start) {
        setTokenError("Test belum dimulai")
        setLoading(false)
        return
      }

      if (now > end) {
        setTokenError("Test sudah berakhir")
        setLoading(false)
        return
      }

      // Create session
      const randomSeed = Math.floor(Math.random() * 2147483647)

      const { data: newSession, error } = await supabase
        .from("test_sessions")
        .insert({
          schedule_id: scheduleId,
          user_id: user.id,
          time_remaining_seconds: schedule.duration_minutes * 60,
          random_seed: randomSeed,
          status: "active",
          strike_count: 0,
          current_question_index: 0
        })
        .select()
        .single()

      if (error) {
        console.error("Create session error:", error)
        throw error
      }

      // Update participant status
      await supabase
        .from("schedule_participants")
        .update({ status: "in_progress" })
        .eq("schedule_id", scheduleId)
        .eq("user_id", user.id)

      setShowTokenModal(false)
      await loadSession(newSession)
    } catch (error) {
      console.error("Token submit error:", error)
      setTokenError("Terjadi kesalahan. Silakan coba lagi.")
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = async (answer: unknown) => {
    if (!session || !questions[currentIndex]) return

    const questionId = questions[currentIndex].id

    const { data, error } = await supabase
      .from("user_answers")
      .upsert(
        {
          session_id: session.id,
          question_id: questionId,
          answer: answer as object,
          answered_at: new Date().toISOString(),
        },
        {
          onConflict: "session_id,question_id",
        },
      )
      .select()
      .single()

    if (!error && data) {
      setAnswers((prev) => new Map(prev).set(questionId, data))
    }
  }

  const handleMark = async () => {
    if (!session || !questions[currentIndex]) return

    const questionId = questions[currentIndex].id
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
      // Create answer with just marked flag
      const { data } = await supabase
        .from("user_answers")
        .insert({
          session_id: session.id,
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
  }

  const handleNavigate = async (index: number) => {
    setCurrentIndex(index)

    if (session) {
      await supabase.from("test_sessions").update({ current_question_index: index }).eq("id", session.id)
    }
  }

  const handleSubmit = async () => {
    if (!session) return

    setSubmitting(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Calculate results
      let correctCount = 0
      const categoryScores: Record<string, { correct: number; total: number }> = {}

      questions.forEach((q) => {
        const answer = answers.get(q.id)
        const categoryName = q.category?.name || "Uncategorized"

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
          status: "completed",
          ended_at: new Date().toISOString(),
        })
        .eq("id", session.id)

      // Update participant
      await supabase
        .from("schedule_participants")
        .update({ status: "completed" })
        .eq("schedule_id", scheduleId)
        .eq("user_id", user.id)

      // Create result
      await supabase.from("test_results").insert({
        session_id: session.id,
        user_id: user.id,
        schedule_id: scheduleId,
        total_questions: questions.length,
        answered_questions: answers.size,
        correct_answers: correctCount,
        score,
        category_scores: categoryScoresFinal,
        status: "pending",
      })

      router.push(`/test/${scheduleId}/result`)
    } catch (error) {
      console.error("Submit error:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleTimeUp = useCallback(() => {
    handleSubmit()
  }, [handleSubmit])

  const handleViolation = useCallback(
    async (type: string) => {
      if (!session) return

      const newStrikeCount = strikeCount + 1
      setStrikeCount(newStrikeCount)
      setWarningType(type)
      setShowWarningModal(true)

      // Log activity
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("activity_logs").insert({
          session_id: session.id,
          user_id: user.id,
          schedule_id: scheduleId,
          activity_type: type as never,
          action_taken: newStrikeCount >= (schedule?.max_strikes || 3) ? "terminated" : "strike",
        })
      }

      // Update session strike count
      await supabase.from("test_sessions").update({ strike_count: newStrikeCount }).eq("id", session.id)

      // Auto-submit if max strikes reached
      if (newStrikeCount >= (schedule?.max_strikes || 3)) {
        setShowWarningModal(false)
        await supabase.from("test_sessions").update({ status: "force_submitted" }).eq("id", session.id)

        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()
        if (currentUser) {
          await supabase
            .from("schedule_participants")
            .update({ status: "force_submitted" })
            .eq("schedule_id", scheduleId)
            .eq("user_id", currentUser.id)
        }

        router.push(`/test/${scheduleId}/result?forced=true`)
      }
    },
    [session, strikeCount, schedule, scheduleId, supabase, router],
  )

  // Error state
  if (error) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push("/schedules")} variant="outline" className="w-full">
              Kembali ke Jadwal
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Token Entry Modal
  if (showTokenModal && schedule) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>{schedule.title}</CardTitle>
            <CardDescription>Masukkan token untuk memulai test</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {schedule.duration_minutes} menit
              </span>
              <span className="flex items-center gap-1">
                <FileQuestion className="h-4 w-4" />
                {schedule.question_count} soal
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="token">Token Test</Label>
              <Input
                id="token"
                placeholder="Masukkan token"
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                className="text-center text-lg tracking-widest font-mono uppercase"
                maxLength={10}
                onKeyDown={(e) => e.key === 'Enter' && handleTokenSubmit()}
              />
              {tokenError && <p className="text-sm text-destructive">{tokenError}</p>}
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Setelah memulai, test akan berjalan dalam mode fullscreen. Aktivitas mencurigakan akan dicatat dan dapat
                mengakibatkan test dihentikan.
              </AlertDescription>
            </Alert>

            <Button onClick={handleTokenSubmit} className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Mulai Test
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main Test Interface
  if (testStarted && session && questions.length > 0) {
    const currentQuestion = questions[currentIndex]
    const currentAnswer = answers.get(currentQuestion?.id)

    return (
      <>
        <AntiCheatMonitor enabled={testStarted} onViolation={handleViolation} />

        {/* Warning Modal */}
        <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Aktivitas Mencurigakan Terdeteksi
              </DialogTitle>
              <DialogDescription>Sistem mendeteksi: {warningType.replace(/_/g, " ")}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Anda telah mendapat {strikeCount} dari {schedule?.max_strikes || 3} peringatan maksimal.
              </p>
              <div className="flex gap-2">
                {Array.from({ length: schedule?.max_strikes || 3 }).map((_, i) => (
                  <div key={i} className={`h-2 flex-1 rounded ${i < strikeCount ? "bg-destructive" : "bg-muted"}`} />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowWarningModal(false)}>Lanjutkan Test</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Submit Confirmation */}
        <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Konfirmasi Submit</DialogTitle>
              <DialogDescription>Apakah Anda yakin ingin mengakhiri test?</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground">Dijawab</p>
                  <p className="text-2xl font-bold">
                    {Array.from(answers.values()).filter((a) => a.answer !== null).length}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground">Belum Dijawab</p>
                  <p className="text-2xl font-bold">
                    {questions.length - Array.from(answers.values()).filter((a) => a.answer !== null).length}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
                Kembali
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Ya, Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">{schedule?.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Soal {currentIndex + 1} dari {questions.length}
                </p>
              </div>
              <TestTimer
                initialSeconds={session.time_remaining_seconds || 0}
                onTimeUp={handleTimeUp}
                sessionId={session.id}
              />
            </div>

            {/* Strike Indicator */}
            {strikeCount > 0 && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Peringatan: {strikeCount}/{schedule?.max_strikes || 3}
                </AlertDescription>
              </Alert>
            )}

            {/* Question Card */}
            <Card>
              <CardContent className="pt-6">
                <QuestionRenderer question={currentQuestion} answer={currentAnswer?.answer} onAnswer={handleAnswer} />
              </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => handleNavigate(currentIndex - 1)} disabled={currentIndex === 0}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Sebelumnya
              </Button>

              <Button variant={currentAnswer?.is_marked ? "secondary" : "outline"} onClick={handleMark}>
                <Flag className={`mr-2 h-4 w-4 ${currentAnswer?.is_marked ? "fill-current" : ""}`} />
                {currentAnswer?.is_marked ? "Ditandai" : "Tandai"}
              </Button>

              {currentIndex === questions.length - 1 ? (
                <Button onClick={() => setShowSubmitConfirm(true)}>
                  <Send className="mr-2 h-4 w-4" />
                  Submit
                </Button>
              ) : (
                <Button onClick={() => handleNavigate(currentIndex + 1)}>
                  Selanjutnya
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Navigasi Soal</CardTitle>
              </CardHeader>
              <CardContent>
                <NavigationGrid
                  total={questions.length}
                  current={currentIndex}
                  answers={answers}
                  questions={questions}
                  onNavigate={handleNavigate}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Keterangan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-primary" />
                  <span>Soal Aktif</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-green-500" />
                  <span>Sudah Dijawab</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-orange-500" />
                  <span>Ditandai</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-muted border" />
                  <span>Belum Dijawab</span>
                </div>
              </CardContent>
            </Card>

            <Button className="w-full" variant="destructive" onClick={() => setShowSubmitConfirm(true)}>
              <Send className="mr-2 h-4 w-4" />
              Akhiri Test
            </Button>
          </div>
        </div>
      </>
    )
  }

  return null
}