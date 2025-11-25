"use client"

import { useCallback, useRef } from "react"

interface UseAntiCheatOptions {
  sessionId: string
  scheduleId: string
  maxStrikes: number
  onTerminate: () => void
}

export function useAntiCheat({ sessionId, scheduleId, maxStrikes, onTerminate }: UseAntiCheatOptions) {
  const strikeCountRef = useRef(0)

  const logViolation = useCallback(
    async (activityType: string, metadata?: Record<string, unknown>) => {
      try {
        const response = await fetch("/api/test/log-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            scheduleId,
            activityType,
            metadata,
          }),
        })

        const data = await response.json()

        if (data.success) {
          strikeCountRef.current = data.strikeCount

          if (data.terminated) {
            onTerminate()
          }

          return {
            strikeCount: data.strikeCount,
            terminated: data.terminated,
          }
        }
      } catch (error) {
        console.error("Failed to log violation:", error)
      }

      return { strikeCount: strikeCountRef.current, terminated: false }
    },
    [sessionId, scheduleId, onTerminate],
  )

  const getStrikeCount = useCallback(() => strikeCountRef.current, [])

  return {
    logViolation,
    getStrikeCount,
    maxStrikes,
  }
}
