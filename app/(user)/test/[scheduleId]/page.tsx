"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2, Lock, Clock, FileQuestion, AlertTriangle, Flag, ChevronLeft, ChevronRight, Send, Menu } from "lucide-react"
import { TestTimer } from "@/components/test/test-timer"
import { QuestionRenderer } from "@/components/test/question-renderer"
import { NavigationGrid } from "@/components/test/navigation-grid"
import { AntiCheatMonitor } from "@/components/test/anti-cheat-monitor"
import { TestMessageDisplay } from "@/components/test/test-message-display"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
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
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  // Load schedule data
  useEffect(() => {
    async function loadSchedule() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push("/login")
          return
        }

        const { data: participation, error: partError } = await supabase
          .from("schedule_participants")
          .select("*, schedule:test_schedules(*)")
          .eq("schedule_id", scheduleId)
          .eq("user_id", user.id)
          .single()

        if (partError || !participation?.schedule) {
          setError("Anda tidak terdaftar untuk test ini")
          setLoading(false)
          return
        }

        setSchedule(participation.schedule)

        const { data: existingSession } = await supabase
          .from("test_sessions")
          .select("*")
          .eq("schedule_id", scheduleId)
          .eq("user_id", user.id)
          .maybeSingle()

        if (existingSession && existingSession.status === "active") {
          await loadSession(existingSession)
        } else if (participation.status === "completed" || participation.status === "force_submitted") {
          router.push(`/history/${scheduleId}`)
          return
        } else {
          setShowTokenModal(true)
        }
        setLoading(false)
      } catch (err) {
        setError(`Unexpected error: ${err.message}`)
        setLoading(false)
      }
    }
    loadSchedule()
  }, [scheduleId, router])

  // REALTIME: Subscribe to session changes
  useEffect(() => {
    if (!session?.id) return
    const channel = supabase
      .channel(`test_session_${session.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "test_sessions", filter: `id=eq.${session.id}` },
        async (payload) => {
          const updatedSession = payload.new as TestSession
          if (updatedSession.status === "force_submitted" && session.status === "active") {
            toast.error("Test dihentikan paksa oleh admin")
            setTimeout(() => router.push(`/test/${scheduleId}/result?forced=true`), 1000)
            return
          }
          if (updatedSession.time_remaining_seconds !== session.time_remaining_seconds) {
            setTimeRemaining(updatedSession.time_remaining_seconds)
            toast.info("Timer diperbarui oleh admin")
          }
          if (updatedSession.strike_count !== session.strike_count) {
            setStrikeCount(updatedSession.strike_count || 0)
          }
          setSession(updatedSession)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session?.id, router, scheduleId])

  const loadSession = async (testSession: TestSession) => {
    try {
      setSession(testSession)
      setStrikeCount(testSession.strike_count || 0)
      setTimeRemaining(testSession.time_remaining_seconds)

      const { data: scheduleQuestions } = await supabase
        .from("schedule_questions")
        .select("*, question:questions(*)")
        .eq("schedule_id", scheduleId)
        .order("order_index")

      if (scheduleQuestions) {
        const loadedQuestions = scheduleQuestions.map((sq) => sq.question).filter((q): q is Question => q !== null)
        if (testSession.question_order?.length > 0) {
          const orderedQuestions = testSession.question_order.map((idx) => loadedQuestions[idx]).filter(Boolean)
          setQuestions(orderedQuestions)
        } else {
          setQuestions(loadedQuestions)
        }
      }

      const { data: existingAnswers } = await supabase
        .from("user_answers")
        .select("*")
        .eq("session_id", testSession.id)

      if (existingAnswers) {
        const answersMap = new Map<string, UserAnswer>()
        existingAnswers.forEach((a) => answersMap.set(a.question_id, a))
        setAnswers(answersMap)
      }

      setCurrentIndex(testSession.current_question_index || 0)
      setTestStarted(true)
    } catch (err) {
      setError(`Error loading session: ${err.message}`)
    }
  }

  const handleTokenSubmit = async () => {
    if (!token.trim()) { setTokenError("Masukkan token test"); return }
    setLoading(true)
    setTokenError("")

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (schedule?.token !== token.toUpperCase()) {
        setTokenError("Token tidak valid")
        setLoading(false)
        return
      }

      const now = new Date()
      const start = new Date(schedule.start_time)
      const end = new Date(schedule.end_time)

      if (now < start) { setTokenError("Test belum dimulai"); setLoading(false); return }
      if (now > end) { setTokenError("Test sudah berakhir"); setLoading(false); return }

      const randomSeed = Math.floor(Math.random() * 2147483647)
      const { data: newSession, error } = await supabase
        .from("test_sessions")
        .insert({
          schedule_id: scheduleId,
          user_id: user.id,
          time_remaining_seconds: schedule.duration_minutes * 60,
          random_seed: randomSeed,
          status: "active",
          current_question_index: 0
        })
        .select()
        .single()

      if (error) throw error

      await supabase.from("schedule_participants").update({ status: "in_progress" }).eq("schedule_id", scheduleId).eq("user_id", user.id)
      
      setShowTokenModal(false)
      await loadSession(newSession)
    } catch (error) {
      setTokenError("Terjadi kesalahan.")
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = async (answer: unknown) => {
    if (!session || !questions[currentIndex]) return
    const questionId = questions[currentIndex].id

    // Optimistic Update
    const optimisticAnswer = {
        id: "temp", 
        session_id: session.id,
        question_id: questionId,
        answer: answer as object,
        answered_at: new Date().toISOString(),
        is_marked: answers.get(questionId)?.is_marked || false
    } as UserAnswer
    
    setAnswers((prev) => new Map(prev).set(questionId, optimisticAnswer))

    const { data } = await supabase
      .from("user_answers")
      .upsert(
        { session_id: session.id, question_id: questionId, answer: answer as object, answered_at: new Date().toISOString() },
        { onConflict: "session_id,question_id" }
      )
      .select()
      .single()

    if (data) setAnswers((prev) => new Map(prev).set(questionId, data))
  }

  const handleMark = async () => {
    if (!session || !questions[currentIndex]) return
    const questionId = questions[currentIndex].id
    const currentAnswer = answers.get(questionId)
    const newMarkStatus = !currentAnswer?.is_marked

    // Optimistic update
    if (currentAnswer) {
         setAnswers(prev => new Map(prev).set(questionId, { ...currentAnswer, is_marked: newMarkStatus }))
    }

    const { data } = await supabase
      .from("user_answers")
      .upsert(
        { session_id: session.id, question_id: questionId, is_marked: newMarkStatus, answer: currentAnswer?.answer || null },
        { onConflict: "session_id,question_id" }
      )
      .select()
      .single()

    if (data) setAnswers((prev) => new Map(prev).set(questionId, data))
  }

  const handleNavigate = async (index: number) => {
    if (index < 0 || index >= questions.length) return
    setCurrentIndex(index)
    if (session) {
      await supabase.from("test_sessions").update({ current_question_index: index }).eq("id", session.id)
    }
  }

  // Handle Swipe Gesture
  const onDragEnd = (event: any, info: any) => {
    const offset = info.offset.x
    const velocity = info.velocity.x

    if (offset < -100 || velocity < -500) {
      // Swipe Left -> Next
      if (currentIndex < questions.length - 1) handleNavigate(currentIndex + 1)
    } else if (offset > 100 || velocity > 500) {
      // Swipe Right -> Prev
      if (currentIndex > 0) handleNavigate(currentIndex - 1)
    }
  }

  const handleSubmit = async () => {
    if (!session) return
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let correctCount = 0
      const categoryScores: Record<string, { correct: number; total: number }> = {}

      questions.forEach((q) => {
        const answer = answers.get(q.id)
        const categoryName = q.category?.name || "Uncategorized"
        if (!categoryScores[categoryName]) categoryScores[categoryName] = { correct: 0, total: 0 }
        categoryScores[categoryName].total++

        if (answer?.answer && q.type === "multiple_choice") {
          const answerValue = (answer.answer as { value: number }).value
          if (answerValue === q.correct_answer) {
            correctCount++
            categoryScores[categoryName].correct++
          }
        }
      })

      const score = questions.length > 0 ? (correctCount / questions.length) * 100 : 0
      const categoryScoresFinal = Object.fromEntries(
        Object.entries(categoryScores).map(([key, val]) => [key, val.total > 0 ? (val.correct / val.total) * 100 : 0])
      )

      await supabase.from("test_sessions").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", session.id)
      await supabase.from("schedule_participants").update({ status: "completed" }).eq("schedule_id", scheduleId).eq("user_id", user.id)
      await supabase.from("test_results").insert({
        session_id: session.id, user_id: user.id, schedule_id: scheduleId, total_questions: questions.length,
        answered_questions: answers.size, correct_answers: correctCount, score, category_scores: categoryScoresFinal, status: "pending"
      })

      router.push(`/test/${scheduleId}/result`)
    } catch (error) {
      console.error("Submit error:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleViolation = useCallback(async (type: string) => {
    if (!session) return
    const newStrikeCount = strikeCount + 1
    setStrikeCount(newStrikeCount)
    setWarningType(type)
    setShowWarningModal(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from("activity_logs").insert({
        session_id: session.id, user_id: user.id, schedule_id: scheduleId, activity_type: type as never,
        action_taken: newStrikeCount >= (schedule?.max_strikes || 3) ? "terminated" : "strike"
      })
    }
    await supabase.from("test_sessions").update({ strike_count: newStrikeCount }).eq("id", session.id)

    if (newStrikeCount >= (schedule?.max_strikes || 3)) {
      setShowWarningModal(false)
      await supabase.from("test_sessions").update({ status: "force_submitted" }).eq("id", session.id)
      router.push(`/test/${scheduleId}/result?forced=true`)
    }
  }, [session, strikeCount, schedule, scheduleId, supabase, router])

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error) return <div className="max-w-md mx-auto mt-12"><Card><CardContent className="pt-6 text-center text-destructive">{error}</CardContent></Card></div>

  // Token Entry
  if (showTokenModal && schedule) {
    return (
      <div className="max-w-md mx-auto mt-12 p-4">
        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{schedule.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                 <div className="bg-muted p-3 rounded-lg text-center">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <span className="font-semibold">{schedule.duration_minutes} Menit</span>
                 </div>
                 <div className="bg-muted p-3 rounded-lg text-center">
                    <FileQuestion className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <span className="font-semibold">{schedule.question_count} Soal</span>
                 </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="token" className="text-center block">Masukkan Token Test</Label>
              <Input
                id="token" placeholder="TOKEN" value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                className="text-center text-2xl tracking-[0.5em] font-mono uppercase h-14"
                maxLength={10} onKeyDown={(e) => e.key === 'Enter' && handleTokenSubmit()}
              />
              {tokenError && <p className="text-sm text-destructive text-center">{tokenError}</p>}
            </div>
            <Button onClick={handleTokenSubmit} className="w-full h-12 text-lg" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Mulai Test"}
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
    const progress = ((currentIndex + 1) / questions.length) * 100

    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <AntiCheatMonitor enabled={testStarted} onViolation={handleViolation} />
        <TestMessageDisplay sessionId={session.id} supabase={supabase} />

        {/* Top Bar - Sticky */}
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Mobile Menu */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="lg:hidden">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                            <div className="py-4">
                                <h3 className="font-semibold mb-4">Navigasi Soal</h3>
                                <NavigationGrid
                                    total={questions.length} current={currentIndex}
                                    answers={answers} questions={questions}
                                    onNavigate={(idx) => { handleNavigate(idx); }} // Close sheet logic here if needed
                                />
                            </div>
                        </SheetContent>
                    </Sheet>
                    
                    <div className="hidden md:block">
                        <h1 className="font-bold truncate max-w-[200px]">{schedule?.title}</h1>
                    </div>
                </div>

                {/* Timer */}
                <div className="font-mono text-lg font-bold bg-primary/10 text-primary px-3 py-1 rounded-md">
                     <TestTimer
                        initialSeconds={timeRemaining || session.time_remaining_seconds || 0}
                        onTimeUp={handleSubmit} sessionId={session.id} key={timeRemaining}
                    />
                </div>
            </div>
            {/* Progress Line */}
            <Progress value={progress} className="h-1 rounded-none" />
        </div>

        <div className="container mx-auto px-4 py-6 grid lg:grid-cols-[1fr_300px] gap-8">
            {/* Main Question Area */}
            <div className="max-w-3xl mx-auto w-full space-y-6">
                
                {/* Header Info */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Soal {currentIndex + 1} dari {questions.length}</span>
                    <div className="flex gap-2">
                        {currentAnswer?.is_marked && (
                            <span className="flex items-center text-orange-500 gap-1 font-medium">
                                <Flag className="h-3 w-3 fill-current" /> Ditandai
                            </span>
                        )}
                        {currentAnswer?.answer && (
                            <span className="flex items-center text-green-600 gap-1 font-medium">
                                <div className="w-2 h-2 rounded-full bg-green-600" /> Dijawab
                            </span>
                        )}
                    </div>
                </div>

                {/* Animated Question Card with Swipe */}
                <div className="relative min-h-[400px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex} // CRITICAL FIX: Ensures component remounts on question change
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.2}
                            onDragEnd={onDragEnd}
                            className="touch-pan-y"
                        >
                            <Card className="border-2 shadow-sm">
                                <CardContent className="p-6 md:p-8">
                                    <QuestionRenderer 
                                        question={currentQuestion} 
                                        answer={currentAnswer?.answer} 
                                        onAnswer={handleAnswer} 
                                    />
                                </CardContent>
                            </Card>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Navigation Controls */}
                <div className="flex items-center justify-between gap-4">
                     <Button 
                        variant="outline" size="lg" 
                        onClick={() => handleNavigate(currentIndex - 1)} 
                        disabled={currentIndex === 0}
                        className="flex-1 md:flex-none"
                    >
                        <ChevronLeft className="mr-2 h-4 w-4" /> Prev
                     </Button>

                     <Button 
                        variant={currentAnswer?.is_marked ? "secondary" : "ghost"} 
                        size="icon"
                        onClick={handleMark}
                        className="rounded-full h-12 w-12 border"
                    >
                        <Flag className={`h-5 w-5 ${currentAnswer?.is_marked ? "fill-orange-500 text-orange-500" : "text-muted-foreground"}`} />
                     </Button>

                     {currentIndex === questions.length - 1 ? (
                        <Button size="lg" onClick={() => setShowSubmitConfirm(true)} className="flex-1 md:flex-none bg-green-600 hover:bg-green-700">
                             Submit <Send className="ml-2 h-4 w-4" />
                        </Button>
                     ) : (
                        <Button size="lg" onClick={() => handleNavigate(currentIndex + 1)} className="flex-1 md:flex-none">
                            Next <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                     )}
                </div>
                 
                 <p className="text-center text-xs text-muted-foreground md:hidden">
                    Geser kiri/kanan pada kartu soal untuk navigasi
                 </p>
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden lg:block space-y-6">
                <Card>
                    <CardHeader><CardTitle className="text-sm">Navigasi Soal</CardTitle></CardHeader>
                    <CardContent>
                        <NavigationGrid
                            total={questions.length} current={currentIndex}
                            answers={answers} questions={questions}
                            onNavigate={handleNavigate}
                        />
                    </CardContent>
                </Card>
                <Button variant="destructive" className="w-full" onClick={() => setShowSubmitConfirm(true)}>
                    Akhiri Test Sekarang
                </Button>
            </div>
        </div>

        {/* Modals & Alerts */}
        <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle /> Peringatan Keamanan</DialogTitle>
              <DialogDescription>Aktivitas mencurigakan: {warningType}</DialogDescription>
            </DialogHeader>
            <div className="flex gap-1 h-2 my-2">{Array.from({ length: schedule?.max_strikes || 3 }).map((_, i) => (<div key={i} className={`flex-1 rounded ${i < strikeCount ? "bg-destructive" : "bg-muted"}`} />))}</div>
            <DialogFooter><Button onClick={() => setShowWarningModal(false)}>Lanjutkan</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
          <DialogContent>
            <DialogHeader><DialogTitle>Konfirmasi Submit</DialogTitle><DialogDescription>Yakin ingin mengakhiri test?</DialogDescription></DialogHeader>
            <div className="grid grid-cols-2 gap-4 text-center py-4">
                <div className="bg-muted p-4 rounded-lg"><p className="text-xs text-muted-foreground">Terjawab</p><p className="text-2xl font-bold text-green-600">{Array.from(answers.values()).filter((a) => a.answer).length}</p></div>
                <div className="bg-muted p-4 rounded-lg"><p className="text-xs text-muted-foreground">Kosong</p><p className="text-2xl font-bold text-destructive">{questions.length - Array.from(answers.values()).filter((a) => a.answer).length}</p></div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setShowSubmitConfirm(false)}>Batal</Button><Button onClick={handleSubmit} disabled={submitting}>{submitting && <Loader2 className="animate-spin mr-2" />} Ya, Submit</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return null
}