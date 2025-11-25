import type { Question, UserAnswer } from "@/types/database.types"

export function calculateScore(
  questions: Question[],
  answers: Map<string, UserAnswer>,
): {
  score: number
  correctCount: number
  categoryScores: Record<string, number>
} {
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
      let isCorrect = false

      switch (q.type) {
        case "multiple_choice": {
          const answerValue = (answer.answer as { value: number }).value
          isCorrect = answerValue === q.correct_answer
          break
        }
        case "multi_select": {
          const answerValues = (answer.answer as { values: number[] }).values || []
          const correctValues = q.correct_answers || []
          isCorrect =
            answerValues.length === correctValues.length && answerValues.every((v) => correctValues.includes(v))
          break
        }
        case "matching": {
          const answerPairs = (answer.answer as { pairs: Record<string, string> }).pairs || {}
          const correctPairs = q.matching_pairs || []
          isCorrect = correctPairs.every((pair) => answerPairs[pair.left] === pair.right)
          break
        }
      }

      if (isCorrect) {
        correctCount++
        categoryScores[categoryName].correct++
      }
    }
  })

  const score = questions.length > 0 ? (correctCount / questions.length) * 100 : 0
  const categoryScoresFinal = Object.fromEntries(
    Object.entries(categoryScores).map(([key, val]) => [key, val.total > 0 ? (val.correct / val.total) * 100 : 0]),
  )

  return {
    score,
    correctCount,
    categoryScores: categoryScoresFinal,
  }
}

export function shuffleArray<T>(array: T[], seed: number): T[] {
  const shuffled = [...array]
  let currentIndex = shuffled.length
  let randomSeed = seed

  // Simple seeded random
  const seededRandom = () => {
    randomSeed = (randomSeed * 9301 + 49297) % 233280
    return randomSeed / 233280
  }

  while (currentIndex !== 0) {
    const randomIndex = Math.floor(seededRandom() * currentIndex)
    currentIndex--
    ;[shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]]
  }

  return shuffled
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function generateToken(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let token = ""
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

export function getActivityLabel(type: string): string {
  const labels: Record<string, string> = {
    tab_switch: "Tab Switch",
    screen_blur: "Layar Blur",
    fullscreen_exit: "Keluar Fullscreen",
    print_screen: "Print Screen",
    devtools: "DevTools",
    copy_paste: "Copy/Paste",
    mouse_leave: "Mouse Keluar",
    right_click: "Klik Kanan",
    window_resize: "Resize Window",
  }
  return labels[type] || type
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    invited: "Diundang",
    in_progress: "Mengerjakan",
    completed: "Selesai",
    force_submitted: "Dihentikan",
    missed: "Terlewat",
  }
  return labels[status] || status
}
