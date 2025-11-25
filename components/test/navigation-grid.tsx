"use client"

import { cn } from "@/lib/utils"
import type { Question, UserAnswer } from "@/types/database.types"

interface NavigationGridProps {
  total: number
  current: number
  answers: Map<string, UserAnswer>
  questions: Question[]
  onNavigate: (index: number) => void
}

export function NavigationGrid({ total, current, answers, questions, onNavigate }: NavigationGridProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: total }).map((_, index) => {
        const question = questions[index]
        const answer = question ? answers.get(question.id) : null
        const isAnswered = answer?.answer !== null && answer?.answer !== undefined
        const isMarked = answer?.is_marked
        const isCurrent = index === current

        return (
          <button
            key={index}
            onClick={() => onNavigate(index)}
            className={cn(
              "w-full aspect-square rounded-lg text-sm font-medium transition-all",
              isCurrent
                ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                : isMarked
                  ? "bg-orange-500 text-white hover:bg-orange-600"
                  : isAnswered
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-muted hover:bg-muted/80 border",
            )}
          >
            {index + 1}
          </button>
        )
      })}
    </div>
  )
}
