"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Clock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface TestTimerProps {
  initialSeconds: number
  onTimeUp: () => void
  sessionId: string
}

export function TestTimer({ initialSeconds, onTimeUp, sessionId }: TestTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds)
  const supabase = createClient()
  const lastSaveRef = useRef(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [onTimeUp])

  // Save time remaining every 30 seconds
  useEffect(() => {
    const saveInterval = setInterval(async () => {
      const now = Date.now()
      if (now - lastSaveRef.current >= 30000) {
        lastSaveRef.current = now
        await supabase.from("test_sessions").update({ time_remaining_seconds: seconds }).eq("id", sessionId)
      }
    }, 30000)

    return () => clearInterval(saveInterval)
  }, [seconds, sessionId, supabase])

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const isLow = seconds < 300 // Less than 5 minutes
  const isCritical = seconds < 60 // Less than 1 minute

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg",
        isCritical
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : isLow
            ? "bg-orange-500/10 text-orange-600"
            : "bg-primary/10 text-primary",
      )}
    >
      {isCritical ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
      <span>
        {hours > 0 && `${hours.toString().padStart(2, "0")}:`}
        {minutes.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
      </span>
    </div>
  )
}
