"use client"

import { useEffect, useRef, useCallback } from "react"

interface AntiCheatMonitorProps {
  enabled: boolean
  onViolation: (type: string) => void
}

export function AntiCheatMonitor({ enabled, onViolation }: AntiCheatMonitorProps) {
  const lastBlurRef = useRef<number>(0)

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      onViolation("tab_switch")
    }
  }, [onViolation])

  const handleBlur = useCallback(() => {
    const now = Date.now()
    // Debounce blur events
    if (now - lastBlurRef.current > 1000) {
      lastBlurRef.current = now
      onViolation("screen_blur")
    }
  }, [onViolation])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Detect Print Screen
      if (e.key === "PrintScreen") {
        e.preventDefault()
        onViolation("print_screen")
      }

      // Detect DevTools shortcuts
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C"))) {
        e.preventDefault()
        onViolation("devtools")
      }

      // Detect copy/paste
      if (e.ctrlKey && (e.key === "c" || e.key === "v" || e.key === "x")) {
        e.preventDefault()
        onViolation("copy_paste")
      }
    },
    [onViolation],
  )

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      onViolation("right_click")
    },
    [onViolation],
  )

  const handleFullscreenChange = useCallback(() => {
    if (!document.fullscreenElement) {
      onViolation("fullscreen_exit")
    }
  }, [onViolation])

  useEffect(() => {
    if (!enabled) return

    // Add event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("blur", handleBlur)
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    // Request fullscreen on start
    const requestFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen()
        }
      } catch {
        // Fullscreen not supported or denied
      }
    }
    requestFullscreen()

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("blur", handleBlur)
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [enabled, handleVisibilityChange, handleBlur, handleKeyDown, handleContextMenu, handleFullscreenChange])

  return null
}
