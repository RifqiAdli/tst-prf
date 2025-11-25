"use client"

import { useState, useEffect } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Question } from "@/types/database.types"

interface QuestionRendererProps {
  question: Question
  answer: unknown
  onAnswer: (answer: unknown) => void
}

export function QuestionRenderer({ question, answer, onAnswer }: QuestionRendererProps) {
  const [localAnswer, setLocalAnswer] = useState<unknown>(answer)

  useEffect(() => {
    setLocalAnswer(answer)
  }, [answer, question.id])

  if (question.type === "multiple_choice") {
    const selectedValue = (localAnswer as { value: number } | null)?.value?.toString()

    return (
      <div className="space-y-6">
        <div className="text-lg font-medium leading-relaxed">{question.question}</div>
        {question.image_url && (
          <img
            src={question.image_url || "/placeholder.svg"}
            alt="Question illustration"
            className="max-w-full rounded-lg"
          />
        )}
        <RadioGroup
          value={selectedValue}
          onValueChange={(value) => {
            const newAnswer = { value: Number.parseInt(value) }
            setLocalAnswer(newAnswer)
            onAnswer(newAnswer)
          }}
          className="space-y-3"
        >
          {question.options?.map((option, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <RadioGroupItem value={index.toString()} id={`option-${index}`} />
              <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    )
  }

  if (question.type === "multiple_select") {
    const selectedValues = (localAnswer as { values: number[] } | null)?.values || []

    const handleCheckChange = (index: number, checked: boolean) => {
      const newValues = checked ? [...selectedValues, index] : selectedValues.filter((v) => v !== index)
      const newAnswer = { values: newValues.sort() }
      setLocalAnswer(newAnswer)
      onAnswer(newAnswer)
    }

    return (
      <div className="space-y-6">
        <div className="text-lg font-medium leading-relaxed">{question.question}</div>
        <p className="text-sm text-muted-foreground">Pilih satu atau lebih jawaban yang benar</p>
        {question.image_url && (
          <img
            src={question.image_url || "/placeholder.svg"}
            alt="Question illustration"
            className="max-w-full rounded-lg"
          />
        )}
        <div className="space-y-3">
          {question.options?.map((option, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <Checkbox
                id={`option-${index}`}
                checked={selectedValues.includes(index)}
                onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
              />
              <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                {option}
              </Label>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (question.type === "matching") {
    const pairs = (localAnswer as Record<string, string> | null) || {}

    const handlePairChange = (leftIndex: string, rightValue: string) => {
      const newPairs = { ...pairs, [leftIndex]: rightValue }
      setLocalAnswer(newPairs)
      onAnswer(newPairs)
    }

    return (
      <div className="space-y-6">
        <div className="text-lg font-medium leading-relaxed">{question.question}</div>
        <p className="text-sm text-muted-foreground">
          Cocokkan item di sebelah kiri dengan pasangannya di sebelah kanan
        </p>
        <div className="space-y-4">
          {question.left_items?.map((leftItem, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="flex-1 p-3 rounded-lg bg-muted text-sm">{leftItem}</div>
              <div className="w-8 text-center text-muted-foreground">→</div>
              <Select
                value={pairs[index.toString()] || ""}
                onValueChange={(value) => handlePairChange(index.toString(), value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Pilih pasangan..." />
                </SelectTrigger>
                <SelectContent>
                  {question.right_items?.map((rightItem, rightIndex) => (
                    <SelectItem key={rightIndex} value={rightIndex.toString()}>
                      {rightItem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return <div>Tipe soal tidak dikenali</div>
}
