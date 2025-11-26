"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2, Lock, Clock, FileQuestion, AlertTriangle, Flag, ChevronLeft, ChevronRight, Send, Menu, ScrollText, CheckCircle } from "lucide-react"
import { TestTimer } from "@/components/test/test-timer"
import { QuestionRenderer } from "@/components/test/question-renderer"
import { NavigationGrid } from "@/components/test/navigation-grid"
import { AntiCheatMonitor } from "@/components/test/anti-cheat-monitor"
import { TestMessageDisplay } from "@/components/test/test-message-display"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import type { TestSchedule, Question, TestSession, UserAnswer } from "@/types/database.types"

// --- Helper Components (New) ---

// Component Modal Aturan Ujian
const TestRulesModal = ({ schedule, onConfirm, open }) => {
    const defaultRules = [
        "Waktu test akan mulai dihitung segera setelah Anda menekan tombol 'Mulai Ujian'.",
        "Dilarang membuka tab atau aplikasi lain. Pelanggaran akan tercatat sebagai 'Strike'.",
        "Test akan dihentikan paksa jika Anda mencapai batas maksimal Strike.",
        "Pastikan koneksi internet Anda stabil.",
        "Anda dapat menandai soal untuk ditinjau kembali.",
        "Semua jawaban akan disimpan secara otomatis.",
        "Pastikan Anda menekan tombol 'Submit' di akhir ujian."
    ]

    return (
        <Dialog open={open}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-primary"><ScrollText className="w-6 h-6"/> Aturan Ujian: {schedule.title}</DialogTitle>
                    <DialogDescription>
                        Harap baca dan pahami aturan berikut sebelum Anda memulai ujian.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                        {defaultRules.map((rule, index) => (
                            <li key={index} className="leading-relaxed">{rule}</li>
                        ))}
                    </ul>
                    <Alert className="bg-destructive/10 border-destructive">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <AlertTitle className="text-destructive">Peringatan Keras!</AlertTitle>
                        <AlertDescription className="text-sm text-destructive">
                            Anda memiliki **{schedule.max_strikes || 3} kali** kesempatan Strike. Melebihi batas akan mengakibatkan ujian dihentikan paksa.
                        </AlertDescription>
                    </Alert>
                </div>
                <DialogFooter>
                    <Button onClick={onConfirm} className="w-full">
                        <CheckCircle className="mr-2 h-4 w-4" /> Saya Paham, Lanjutkan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// --- Main Component ---

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
  const [showRulesModal, setShowRulesModal] = useState(false) // NEW STATE
  const [testStarted, setTestStarted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [strikeCount, setStrikeCount] = useState(0)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [warningType, setWarningType] = useState("")
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  // Computed
  const answeredCount = useMemo(() => Array.from(answers.values()).filter((a) => a.answer).length, [answers])
  const markedCount = useMemo(() => Array.from(answers.values()).filter((a) => a.is_marked).length, [answers])
  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex])
  const currentAnswer = useMemo(() => answers.get(currentQuestion?.id), [answers, currentQuestion])
  const progress = useMemo(() => questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0, [currentIndex, questions.length])
  const isLastQuestion = currentIndex === questions.length - 1

  // Load schedule data and check existing session
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
          // Update time remaining if admin modifies it
          if (updatedSession.time_remaining_seconds !== session.time_remaining_seconds) {
            setTimeRemaining(updatedSession.time_remaining_seconds)
            toast.info("Timer diperbarui oleh admin")
          }
          // Update strike count
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
        // Handle question randomization via question_order in session
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
    if (!schedule) return

    setTokenError("")
    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Token Validation
      if (schedule.token !== token.toUpperCase()) {
        setTokenError("Token tidak valid")
        return
      }

      // 2. Time Validation
      const now = new Date()
      const start = new Date(schedule.start_time)
      const end = new Date(schedule.end_time)

      if (now < start) { setTokenError("Test belum dimulai"); return }
      if (now > end) { setTokenError("Test sudah berakhir"); return }
      
      // 3. Show Rules Modal
      setShowTokenModal(false)
      setShowRulesModal(true)
      
    } catch (error) {
      setTokenError("Terjadi kesalahan saat validasi.")
    } finally {
      setLoading(false)
    }
  }

  const startNewSession = async () => {
    if (!schedule) return

    setShowRulesModal(false)
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Create new session
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

      // Update participant status
      await supabase.from("schedule_participants").update({ status: "in_progress" }).eq("schedule_id", scheduleId).eq("user_id", user.id)
      
      // Load session data
      await loadSession(newSession)
    } catch (error) {
      console.error("Error starting session:", error)
      setError("Gagal memulai sesi test.")
      setShowTokenModal(true) // Re-show token modal on failure
    } finally {
      setLoading(false)
    }
  }


  // Save answer (Optimistic and API)
  const handleAnswer = async (answer: unknown) => {
    if (!session || !currentQuestion) return
    const questionId = currentQuestion.id

    // Optimistic Update: Update UI immediately
    const optimisticAnswer = {
        id: answers.get(questionId)?.id || "temp", 
        session_id: session.id,
        question_id: questionId,
        answer: answer as object,
        answered_at: new Date().toISOString(),
        is_marked: currentAnswer?.is_marked || false
    } as UserAnswer
    
    setAnswers((prev) => new Map(prev).set(questionId, optimisticAnswer))

    // API Call: Save to database
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

  // Mark question for review (Optimistic and API)
  const handleMark = async () => {
    if (!session || !currentQuestion) return
    const questionId = currentQuestion.id
    const currentAnswerData = answers.get(questionId)
    const newMarkStatus = !currentAnswerData?.is_marked

    // Optimistic update
    const optimisticMarkedAnswer = {
        id: currentAnswerData?.id || "temp", 
        session_id: session.id,
        question_id: questionId,
        answer: currentAnswerData?.answer || null,
        answered_at: currentAnswerData?.answered_at || null,
        is_marked: newMarkStatus
    } as UserAnswer
    
    setAnswers(prev => new Map(prev).set(questionId, optimisticMarkedAnswer))

    // API Call: Save mark status
    const { data } = await supabase
      .from("user_answers")
      .upsert(
        { 
          session_id: session.id, 
          question_id: questionId, 
          is_marked: newMarkStatus, 
          answer: currentAnswerData?.answer || null,
          answered_at: currentAnswerData?.answered_at || null,
        },
        { onConflict: "session_id,question_id" }
      )
      .select()
      .single()

    if (data) setAnswers((prev) => new Map(prev).set(questionId, data))
  }

  // Navigate to question index
  const handleNavigate = async (index: number) => {
    if (index < 0 || index >= questions.length || index === currentIndex) return
    setCurrentIndex(index)
    // Update session current index in DB for recovery
    if (session) {
      await supabase.from("test_sessions").update({ current_question_index: index }).eq("id", session.id)
    }
  }

  // Handle Swipe Gesture for question navigation
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

  // Final Submission and scoring
  const handleSubmit = async () => {
    if (!session) return
    setShowSubmitConfirm(false)
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let correctCount = 0
      const categoryScores: Record<string, { correct: number; total: number }> = {}

      // Simple Scoring Logic (only for multiple_choice for now)
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

      // Update Session and Participant Status
      await supabase.from("test_sessions").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", session.id)
      await supabase.from("schedule_participants").update({ status: "completed" }).eq("schedule_id", scheduleId).eq("user_id", user.id)
      
      // Insert Test Result
      await supabase.from("test_results").insert({
        session_id: session.id, user_id: user.id, schedule_id: scheduleId, total_questions: questions.length,
        answered_questions: answers.size, correct_answers: correctCount, score, category_scores: categoryScoresFinal, status: "pending"
      })

      // Redirect to result page
      router.push(`/test/${scheduleId}/result`)
    } catch (error) {
      console.error("Submit error:", error)
      toast.error("Gagal submit test. Coba lagi.")
    } finally {
      setSubmitting(false)
    }
  }

  // Anti-Cheat Violation Handler
  const handleViolation = useCallback(async (type: string) => {
    if (!session || !schedule) return
    const maxStrikes = schedule.max_strikes || 3
    const newStrikeCount = strikeCount + 1

    setStrikeCount(newStrikeCount)
    setWarningType(type)
    setShowWarningModal(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("activity_logs").insert({
          session_id: session.id, user_id: user.id, schedule_id: scheduleId, activity_type: type as never,
          action_taken: newStrikeCount >= maxStrikes ? "terminated" : "strike"
        })
      }
      await supabase.from("test_sessions").update({ strike_count: newStrikeCount }).eq("id", session.id)

      // Force Submission
      if (newStrikeCount >= maxStrikes) {
        setShowWarningModal(false)
        toast.error("Batas Strike tercapai. Ujian dihentikan paksa.")
        await supabase.from("test_sessions").update({ status: "force_submitted" }).eq("id", session.id)
        router.push(`/test/${scheduleId}/result?forced=true`)
      }
    } catch (error) {
      console.error("Violation logging error:", error)
    }
  }, [session, strikeCount, schedule, scheduleId, supabase, router])

  // --- Render Logic ---

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error) return <div className="max-w-md mx-auto mt-12"><Card><CardContent className="pt-6 text-center text-destructive">{error}</CardContent></Card></div>

  // Rules Modal (NEW)
  if (showRulesModal && schedule) {
    return <TestRulesModal schedule={schedule} onConfirm={startNewSession} open={showRulesModal} />
  }
  
  // Token Entry Modal
  if (showTokenModal && schedule) {
    return (
      <div className="max-w-md mx-auto mt-12 p-4">
        <Card className="border-2 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{schedule.title}</CardTitle>
            <CardDescription>Masukkan token yang diberikan untuk memulai ujian.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                 <div className="bg-primary/10 p-3 rounded-lg text-center border border-primary/20">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <span className="text-sm font-medium block">Durasi</span>
                    <span className="font-bold text-lg">{schedule.duration_minutes} Menit</span>
                 </div>
                 <div className="bg-primary/10 p-3 rounded-lg text-center border border-primary/20">
                    <FileQuestion className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <span className="text-sm font-medium block">Total Soal</span>
                    <span className="font-bold text-lg">{schedule.question_count} Soal</span>
                 </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="token" className="text-center block text-lg font-semibold">TOKEN TEST</Label>
              <Input
                id="token" placeholder="XXXXXX" value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                className="text-center text-3xl tracking-[0.5em] font-mono uppercase h-16 border-2 focus:border-primary"
                maxLength={10} onKeyDown={(e) => e.key === 'Enter' && handleTokenSubmit()}
              />
              {tokenError && <Alert className="mt-2" variant="destructive"><AlertDescription>{tokenError}</AlertDescription></Alert>}
            </div>
            <Button onClick={handleTokenSubmit} className="w-full h-12 text-lg" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Validasi & Lihat Aturan"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main Test Interface
  if (testStarted && session && questions.length > 0) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        {/* Anti-Cheat & Messaging */}
        <AntiCheatMonitor enabled={testStarted} onViolation={handleViolation} />
        <TestMessageDisplay sessionId={session.id} supabase={supabase} />

        {/* Top Bar - Sticky */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b shadow-sm">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Mobile Menu Trigger */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="lg:hidden">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                            <div className="py-4">
                                <h3 className="font-bold text-lg mb-4 text-primary">Navigasi Soal</h3>
                                <NavigationGrid
                                    total={questions.length} current={currentIndex}
                                    answers={answers} questions={questions}
                                    onNavigate={handleNavigate}
                                />
                                <Button variant="destructive" className="w-full mt-6" onClick={() => {setShowSubmitConfirm(true);}}>
                                    Akhiri Test Sekarang
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                    
                    <div className="hidden md:block">
                        <h1 className="font-bold truncate max-w-[200px] text-lg">{schedule?.title}</h1>
                    </div>
                </div>

                {/* Timer */}
                <div className="font-mono text-lg font-bold bg-primary text-primary-foreground px-3 py-1 rounded-md">
                     <TestTimer
                        initialSeconds={timeRemaining !== null ? timeRemaining : session.time_remaining_seconds || 0}
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
                    <span>**Soal {currentIndex + 1}** dari {questions.length}</span>
                    <div className="flex gap-4">
                        {currentAnswer?.is_marked && (
                            <span className="flex items-center text-orange-500 gap-1 font-medium animate-pulse">
                                <Flag className="h-3 w-3 fill-orange-500" /> Ditandai
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
                            key={currentIndex}
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
                            <Card className="border-2 shadow-lg">
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
                        className="flex-1 md:flex-none border-primary text-primary hover:bg-primary/10"
                    >
                        <ChevronLeft className="mr-2 h-4 w-4" /> Sebelumnya
                     </Button>

                     <Button 
                        variant={currentAnswer?.is_marked ? "secondary" : "ghost"} 
                        size="icon"
                        onClick={handleMark}
                        className={`rounded-full h-12 w-12 border ${currentAnswer?.is_marked ? "border-orange-500 bg-orange-500/10" : ""}`}
                    >
                        <Flag className={`h-5 w-5 ${currentAnswer?.is_marked ? "fill-orange-500 text-orange-500" : "text-muted-foreground"}`} />
                     </Button>

                     {isLastQuestion ? (
                        <Button size="lg" onClick={() => setShowSubmitConfirm(true)} className="flex-1 md:flex-none bg-green-600 hover:bg-green-700">
                             Submit <Send className="ml-2 h-4 w-4" />
                        </Button>
                     ) : (
                        <Button size="lg" onClick={() => handleNavigate(currentIndex + 1)} className="flex-1 md:flex-none">
                            Selanjutnya <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                     )}
                </div>
                 
                 <p className="text-center text-xs text-muted-foreground md:hidden">
                    (Geser kiri/kanan pada kartu soal untuk navigasi cepat)
                 </p>
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden lg:block space-y-6 sticky top-24 self-start">
                <Card>
                    <CardHeader><CardTitle className="text-sm">Navigasi Soal</CardTitle></CardHeader>
                    <CardContent className="pt-0">
                        <NavigationGrid
                            total={questions.length} current={currentIndex}
                            answers={answers} questions={questions}
                            onNavigate={handleNavigate}
                        />
                        <div className="mt-4 flex flex-col gap-2 text-sm">
                            <p className="text-green-600 font-medium">Dijawab: {answeredCount}</p>
                            <p className="text-orange-500 font-medium">Ditandai: {markedCount}</p>
                            <p className="text-destructive font-medium">Kosong: {questions.length - answeredCount}</p>
                        </div>
                    </CardContent>
                </Card>
                <Button variant="destructive" className="w-full h-12" onClick={() => setShowSubmitConfirm(true)}>
                    Akhiri Test Sekarang
                </Button>
            </div>
        </div>

        {/* Modals & Alerts */}
        <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5"/> Peringatan Keamanan</DialogTitle>
              <DialogDescription className="text-base font-semibold">Aktivitas Mencurigakan Terdeteksi: <span className="text-destructive font-bold">{warningType}</span></DialogDescription>
            </DialogHeader>
            <Alert variant="destructive">
              <AlertDescription>Ini adalah **Strike ke-{strikeCount}**. Anda memiliki **{((schedule?.max_strikes || 3) - strikeCount)}** sisa Strike sebelum ujian Anda dihentikan paksa.</AlertDescription>
            </Alert>
            <div className="flex gap-1 h-2 my-2">{Array.from({ length: schedule?.max_strikes || 3 }).map((_, i) => (<div key={i} className={`flex-1 rounded ${i < strikeCount ? "bg-destructive" : "bg-muted"}`} />))}</div>
            <DialogFooter><Button onClick={() => setShowWarningModal(false)}>Lanjutkan Ujian</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
          <DialogContent>
            <DialogHeader><DialogTitle>Konfirmasi Submit Ujian</DialogTitle><DialogDescription>Anda akan mengakhiri dan mengirimkan jawaban Anda. Pastikan Anda telah meninjau semua soal.</DialogDescription></DialogHeader>
            <div className="grid grid-cols-3 gap-4 text-center py-4">
                <div className="bg-green-100 p-4 rounded-lg"><p className="text-xs text-muted-foreground">Terjawab</p><p className="text-2xl font-bold text-green-700">{answeredCount}</p></div>
                <div className="bg-orange-100 p-4 rounded-lg"><p className="text-xs text-muted-foreground">Ditandai</p><p className="text-2xl font-bold text-orange-700">{markedCount}</p></div>
                <div className="bg-red-100 p-4 rounded-lg"><p className="text-xs text-muted-foreground">Kosong</p><p className="text-2xl font-bold text-red-700">{questions.length - answeredCount}</p></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>Batal</Button><Button onClick={handleSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700">{submitting && <Loader2 className="animate-spin mr-2" />} Ya, Submit Sekarang</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return null
}