"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Maximize, AlertTriangle } from "lucide-react"

interface FullscreenPromptProps {
  onEnterFullscreen: () => void
}

export function FullscreenPrompt({ onEnterFullscreen }: FullscreenPromptProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen()
      onEnterFullscreen()
    } catch (error) {
      console.error("Fullscreen request failed:", error)
      // Proceed anyway if fullscreen fails
      onEnterFullscreen()
    }
  }

  if (isFullscreen) return null

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Maximize className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Mode Fullscreen Diperlukan</CardTitle>
          <CardDescription>Test harus dijalankan dalam mode fullscreen untuk mencegah kecurangan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 text-sm">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-500">Perhatian</p>
              <p className="text-muted-foreground">
                Keluar dari mode fullscreen selama test akan dicatat sebagai aktivitas mencurigakan
              </p>
            </div>
          </div>
          <Button onClick={enterFullscreen} className="w-full" size="lg">
            <Maximize className="mr-2 h-4 w-4" />
            Masuk Mode Fullscreen
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
