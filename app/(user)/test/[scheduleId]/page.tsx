"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Loader2, Lock, Clock, FileQuestion, AlertTriangle, Flag, ChevronLeft, ChevronRight, Send, CheckCircle2, ShieldAlert } from "lucide-react"
import { TestTimer } from "@/components/test/test-timer"
import { QuestionRenderer } from "@/components/test/question-renderer"
import { NavigationGrid } from "@/components/test/navigation-grid"
import { AntiCheatMonitor } from "@/components/test/anti-cheat-monitor"
import { TestMessageDisplay } from "@/components/test/test-message-display"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import type { TestSchedule, Question, TestSession, UserAnswer } from "@/types/database.types"

export default function TestPage() {
  const params = useParams()
  const router = useRouter()
  const scheduleId = params.scheduleId as string
  const supabase = createClient()
  const navScrollRef = useRef<HTMLDivElement>(null)

  // States
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<TestSchedule | null>(null)
  const [session, setSession] = useState<TestSession | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Map<string, UserAnswer>>(new Map())
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Auth States
  const [token, setToken] = useState("")
  const [tokenError, setTokenError] = useState("")
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [showRulesModal, setShowRulesModal] = useState(false) // NEW: State for Rules
  const [isStarting, setIsStarting] = useState(false)

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

        // Check if session already exists
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
          // If no active session, show Token Input
          setShowTokenModal(true)
        }
        setLoading(false)
      } catch (err) {
        setError(`Unexpected error: ${(err as Error).message}`)
        setLoading(false)
      }
    }
    loadSchedule()
  }, [scheduleId, router, supabase])

  // ... (Realtime subscription logic remains same - omitted for brevity) ... 
  // Pastikan tetap menggunakan logic realtime yang sama seperti kode awal kamu

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
      setShowRulesModal(false) // Ensure rules are closed if rejoining
      setShowTokenModal(false)
    } catch (err) {
      setError(`Error loading session: ${(err as Error).message}`)
    }
  }

  // Step 1: Validate Token (Client Side Check)
  const handleValidateToken = () => {
    if (!token.trim()) { setTokenError("Masukkan token test"); return }
    
    if (schedule?.token !== token.toUpperCase()) {
      setTokenError("Token tidak valid")
      return
    }

    const now = new Date()
    const start = new Date(schedule.start_time)
    const end = new Date(schedule.end_time)

    if (now < start) { setTokenError("Test belum dimulai"); return }
    if (now > end) { setTokenError("Test sudah berakhir"); return }

    // Token valid, show Rules
    setTokenError("")
    setShowTokenModal(false)
    setShowRulesModal(true)
  }

  // Step 2: Create Session after agreeing to rules
  const handleStartTest = async () => {
    setIsStarting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !schedule) return

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
      
      await loadSession(newSession)
    } catch (error) {
      toast.error("Gagal memulai ujian. Silakan coba lagi.")
      setShowRulesModal(false)
      setShowTokenModal(true)
    } finally {
      setIsStarting(false)
    }
  }

  // ... (handleAnswer, handleMark, handleNavigate, onDragEnd, handleSubmit, handleViolation logics remain same) ...
  // Gunakan fungsi yang sama dari kodemu sebelumnya untuk logic ini
  const handleAnswer = async (answer: unknown) => {
    if (!session || !questions[currentIndex]) return
    const questionId = questions[currentIndex].id
    const optimisticAnswer = {
        id: "temp", 
        session_id: session.id,
        question_id: questionId,
        answer: answer as object,
        answered_at: new Date().toISOString(),
        is_marked: answers.get(questionId)?.is_marked || false
    } as UserAnswer
    setAnswers((prev) => new Map(prev).set(questionId, optimisticAnswer))
    const { data } = await supabase.from("user_answers").upsert(
        { session_id: session.id, question_id: questionId, answer: answer as object, answered_at: new Date().toISOString() },
        { onConflict: "session_id,question_id" }
      ).select().single()
    if (data) setAnswers((prev) => new Map(prev).set(questionId, data))
  }

  const handleMark = async () => {
    if (!session || !questions[currentIndex]) return
    const questionId = questions[currentIndex].id
    const currentAnswer = answers.get(questionId)
    const newMarkStatus = !currentAnswer?.is_marked
    if (currentAnswer) setAnswers(prev => new Map(prev).set(questionId, { ...currentAnswer, is_marked: newMarkStatus }))
    const { data } = await supabase.from("user_answers").upsert(
        { session_id: session.id, question_id: questionId, is_marked: newMarkStatus, answer: currentAnswer?.answer || null },
        { onConflict: "session_id,question_id" }
      ).select().single()
    if (data) setAnswers((prev) => new Map(prev).set(questionId, data))
  }

  const handleNavigate = async (index: number) => {
    if (index < 0 || index >= questions.length) return
    setCurrentIndex(index)
    
    // Auto scroll horizontal nav to center active element
    if (navScrollRef.current) {
        const btn = navScrollRef.current.children[index] as HTMLElement
        if (btn) {
            navScrollRef.current.scrollTo({
                left: btn.offsetLeft - (navScrollRef.current.clientWidth / 2) + (btn.clientWidth / 2),
                behavior: 'smooth'
            })
        }
    }

    if (session) {
      await supabase.from("test_sessions").update({ current_question_index: index }).eq("id", session.id)
    }
  }
  
  const onDragEnd = (event: any, info: any) => {
    const offset = info.offset.x
    const velocity = info.velocity.x
    if (offset < -100 || velocity < -500) { if (currentIndex < questions.length - 1) handleNavigate(currentIndex + 1) } 
    else if (offset > 100 || velocity > 500) { if (currentIndex > 0) handleNavigate(currentIndex - 1) }
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
    } catch (error) { console.error(error) } finally { setSubmitting(false) }
  }

  const handleViolation = useCallback(async (type: string) => {
      // Sama seperti sebelumnya
      if (!session) return
      const newStrikeCount = strikeCount + 1
      setStrikeCount(newStrikeCount)
      setWarningType(type)
      setShowWarningModal(true)
      await supabase.from("test_sessions").update({ strike_count: newStrikeCount }).eq("id", session.id)
      if (newStrikeCount >= (schedule?.max_strikes || 3)) {
         setShowWarningModal(false)
         await supabase.from("test_sessions").update({ status: "force_submitted" }).eq("id", session.id)
         router.push(`/test/${scheduleId}/result?forced=true`)
      }
  }, [session, strikeCount, schedule, scheduleId, supabase, router])


  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error) return <div className="max-w-md mx-auto mt-12"><Card><CardContent className="pt-6 text-center text-destructive">{error}</CardContent></Card></div>

  // ------------------------------------------------------------------
  // UI 1: TOKEN INPUT
  // ------------------------------------------------------------------
  if (showTokenModal && schedule) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="max-w-md w-full border-2 shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{schedule.title}</CardTitle>
            <p className="text-muted-foreground text-sm mt-2">Silakan masukkan token untuk melanjutkan</p>
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
            <div className="space-y-3">
              <Input
                id="token" placeholder="TOKEN" value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                className="text-center text-3xl tracking-[0.5em] font-mono uppercase h-16 font-bold"
                maxLength={10} onKeyDown={(e) => e.key === 'Enter' && handleValidateToken()}
              />
              {tokenError && <p className="text-sm text-destructive text-center font-medium animate-pulse">{tokenError}</p>}
            </div>
            <Button onClick={handleValidateToken} className="w-full h-12 text-lg font-semibold shadow-md">
               Validasi Token
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // UI 2: RULES / TATA TERTIB (Baru)
  // ------------------------------------------------------------------
  if (showRulesModal && schedule) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
             <Card className="max-w-lg w-full border-2 shadow-lg animate-in fade-in zoom-in-95 duration-300">
                <CardHeader className="border-b bg-muted/30">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <ShieldAlert className="text-orange-500" />
                        Tata Tertib Ujian
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <div className="space-y-3 text-sm text-muted-foreground">
                        <div className="flex gap-3">
                            <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                            <p>Waktu akan berjalan otomatis setelah tombol "Mulai" ditekan.</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                            <p>Dilarang keluar dari mode layar penuh atau berpindah tab. Sistem Anti-Cheat aktif.</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                            <p>Jika terdeteksi melakukan pelanggaran lebih dari {schedule.max_strikes} kali, ujian akan dihentikan otomatis.</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">4</div>
                            <p>Pastikan koneksi internet stabil sebelum memulai.</p>
                        </div>
                    </div>
                </CardContent>
                <CardHeader className="pt-0 border-t bg-muted/30 p-6">
                    <Button onClick={handleStartTest} className="w-full h-12 text-lg" disabled={isStarting}>
                        {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Saya Mengerti & Mulai Ujian"}
                    </Button>
                </CardHeader>
             </Card>
        </div>
    )
  }

  // ------------------------------------------------------------------
  // UI 3: MAIN TEST INTERFACE
  // ------------------------------------------------------------------
  if (testStarted && session && questions.length > 0) {
    const currentQuestion = questions[currentIndex]
    const currentAnswer = answers.get(currentQuestion?.id)
    const progress = ((currentIndex + 1) / questions.length) * 100

    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <AntiCheatMonitor enabled={testStarted} onViolation={handleViolation} />
        <TestMessageDisplay sessionId={session.id} supabase={supabase} />

        {/* --- HEADER STICKY --- */}
        <div className="sticky top-0 z-40 bg-background border-b shadow-sm">
            {/* Top Bar: Title & Timer */}
            <div className="container mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
                <h1 className="font-bold text-sm md:text-lg truncate max-w-[150px] md:max-w-md">{schedule?.title}</h1>
                <div className="font-mono text-base md:text-lg font-bold bg-primary/10 text-primary px-3 py-1 rounded-md flex items-center gap-2">
                     <Clock className="w-4 h-4" />
                     <TestTimer
                        initialSeconds={timeRemaining || session.time_remaining_seconds || 0}
                        onTimeUp={handleSubmit} sessionId={session.id} key={timeRemaining}
                    />
                </div>
            </div>

            {/* PROGRESS BAR */}
            <Progress value={progress} className="h-1 rounded-none bg-muted" />

            {/* --- NEW: MOBILE HORIZONTAL NAVIGATION --- */}
            <div className="lg:hidden border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div 
                    ref={navScrollRef}
                    className="flex overflow-x-auto gap-2 p-2 px-4 no-scrollbar scroll-smooth"
                >
                    {questions.map((q, idx) => {
                         const isAnswered = answers.get(q.id)?.answer;
                         const isMarked = answers.get(q.id)?.is_marked;
                         const isCurrent = idx === currentIndex;
                         
                         return (
                            <button
                                key={q.id}
                                onClick={() => handleNavigate(idx)}
                                className={cn(
                                    "flex-shrink-0 w-9 h-9 text-xs font-semibold rounded-md border flex items-center justify-center transition-all",
                                    isCurrent 
                                        ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary ring-offset-2" 
                                        : "bg-background hover:bg-muted",
                                    isAnswered && !isCurrent ? "bg-green-100 text-green-700 border-green-200" : "",
                                    isMarked && !isCurrent ? "bg-orange-100 text-orange-700 border-orange-200" : ""
                                )}
                            >
                                {idx + 1}
                                {isMarked && <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-orange-500 -mr-0.5 -mt-0.5" />}
                            </button>
                         )
                    })}
                </div>
            </div>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="container mx-auto px-4 py-4 md:py-6 grid lg:grid-cols-[1fr_320px] gap-6 lg:gap-8 items-start">
            
            {/* Question Area */}
            <div className="w-full space-y-4 md:space-y-6">
                
                {/* Info Bar (Desktop only mostly) */}
                <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                    <span className="hidden md:inline">Soal No. {currentIndex + 1}</span>
                    <div className="flex gap-3 ml-auto">
                        {currentAnswer?.is_marked && (
                            <span className="flex items-center text-orange-600 gap-1 font-medium bg-orange-50 px-2 py-0.5 rounded text-xs md:text-sm border border-orange-100">
                                <Flag className="h-3 w-3 fill-current" /> Ditandai
                            </span>
                        )}
                        {currentAnswer?.answer && (
                            <span className="flex items-center text-green-600 gap-1 font-medium bg-green-50 px-2 py-0.5 rounded text-xs md:text-sm border border-green-100">
                                <CheckCircle2 className="h-3 w-3" /> Terjawab
                            </span>
                        )}
                    </div>
                </div>

                {/* Animated Question Card */}
                <div className="relative min-h-[300px] md:min-h-[400px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.1}
                            onDragEnd={onDragEnd}
                            className="touch-pan-y"
                        >
                            <Card className="border shadow-sm">
                                <CardContent className="p-4 md:p-8">
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

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between gap-3 bg-background/50 backdrop-blur-sm p-2 sticky bottom-0 md:static md:bg-transparent md:p-0">
                     <Button 
                        variant="outline" size="lg" 
                        onClick={() => handleNavigate(currentIndex - 1)} 
                        disabled={currentIndex === 0}
                        className="flex-1 md:flex-none h-10 md:h-11"
                    >
                        <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                     </Button>

                     <Button 
                        variant={currentAnswer?.is_marked ? "default" : "secondary"} 
                        size="icon"
                        onClick={handleMark}
                        className={cn(
                            "rounded-full h-10 w-10 md:h-12 md:w-12 shadow-sm border", 
                            currentAnswer?.is_marked ? "bg-orange-500 hover:bg-orange-600 text-white" : ""
                        )}
                    >
                        <Flag className={cn("h-4 w-4 md:h-5 md:w-5", currentAnswer?.is_marked ? "fill-current" : "")} />
                     </Button>

                     {currentIndex === questions.length - 1 ? (
                        <Button size="lg" onClick={() => setShowSubmitConfirm(true)} className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white h-10 md:h-11">
                             Selesai <Send className="ml-2 h-4 w-4" />
                        </Button>
                     ) : (
                        <Button size="lg" onClick={() => handleNavigate(currentIndex + 1)} className="flex-1 md:flex-none h-10 md:h-11">
                            Next <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                     )}
                </div>
                
                <p className="text-center text-[10px] text-muted-foreground md:hidden pb-4">
                   Geser kartu untuk navigasi cepat
                </p>
            </div>

            {/* Desktop Sidebar (Navigation Grid) */}
            <div className="hidden lg:block space-y-6 sticky top-24">
                <Card className="border shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Navigasi Soal</CardTitle></CardHeader>
                    <CardContent>
                        <NavigationGrid
                            total={questions.length} current={currentIndex}
                            answers={answers} questions={questions}
                            onNavigate={handleNavigate}
                        />
                    </CardContent>
                </Card>
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-4">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-100 border border-green-200 rounded"/> Terjawab</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-100 border border-orange-200 rounded"/> Ragu-ragu</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-primary text-white rounded flex items-center justify-center text-[8px] font-bold">1</div> Sekarang</div>
                    </div>
                    <Button variant="destructive" className="w-full shadow-sm" onClick={() => setShowSubmitConfirm(true)}>
                        Akhiri Ujian
                    </Button>
                </div>
            </div>
        </div>

        {/* Modals (Warning & Confirm Submit) - Same as before */}
        <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle /> Peringatan Keamanan</DialogTitle>
              <DialogDescription>Sistem mendeteksi aktivitas mencurigakan: <span className="font-bold text-foreground">{warningType}</span></DialogDescription>
            </DialogHeader>
            <div className="bg-muted p-3 rounded text-sm text-center">
                Pelanggaran: <span className="font-bold text-destructive">{strikeCount}</span> / {schedule?.max_strikes || 3}
            </div>
            <DialogFooter><Button onClick={() => setShowWarningModal(false)}>Lanjutkan Mengerjakan</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Konfirmasi Selesai</DialogTitle><DialogDescription>Apakah Anda yakin ingin mengakhiri ujian ini?</DialogDescription></DialogHeader>
            <div className="grid grid-cols-2 gap-4 text-center py-4">
                <div className="bg-green-50 border border-green-100 p-4 rounded-lg"><p className="text-xs text-green-600 font-medium uppercase mb-1">Terjawab</p><p className="text-3xl font-bold text-green-700">{Array.from(answers.values()).filter((a) => a.answer).length}</p></div>
                <div className="bg-red-50 border border-red-100 p-4 rounded-lg"><p className="text-xs text-red-600 font-medium uppercase mb-1">Belum Dijawab</p><p className="text-3xl font-bold text-red-700">{questions.length - Array.from(answers.values()).filter((a) => a.answer).length}</p></div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>Kembali Cek Soal</Button>
                <Button onClick={handleSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white">
                    {submitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />} Ya, Kumpulkan Jawaban
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return null
}