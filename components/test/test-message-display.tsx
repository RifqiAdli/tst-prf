"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, MessageSquare, Megaphone } from "lucide-react"
import { toast } from "sonner"

type TestMessage = {
  id: string
  session_id: string
  sender_id: string
  sender_name: string
  message: string
  is_global: boolean
  is_read: boolean
  created_at: string
}

type Props = {
  sessionId: string
  supabase: any
}

export function TestMessageDisplay({ sessionId, supabase }: Props) {
  const [messages, setMessages] = useState<TestMessage[]>([])
  const [dismissedMessages, setDismissedMessages] = useState<Set<string>>(new Set())

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("test_messages")
      .select("*")
      .eq("session_id", sessionId)
      .eq("is_read", false)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching messages:", error)
      return
    }

    if (data) {
      // Filter out dismissed messages
      const newMessages = data.filter((msg: TestMessage) => !dismissedMessages.has(msg.id))
      
      // Show toast for new messages
      newMessages.forEach((msg: TestMessage) => {
        if (!messages.find((m) => m.id === msg.id)) {
          toast.info(msg.is_global ? "Pesan broadcast dari admin" : "Pesan dari admin", {
            description: msg.message.substring(0, 50) + (msg.message.length > 50 ? "..." : ""),
          })
        }
      })

      setMessages(newMessages)
    }
  }

  const markAsRead = async (messageId: string) => {
    await supabase.from("test_messages").update({ is_read: true }).eq("id", messageId)
  }

  const handleDismiss = async (messageId: string) => {
    setDismissedMessages((prev) => new Set(prev).add(messageId))
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
    await markAsRead(messageId)
  }

  useEffect(() => {
    // Initial fetch
    fetchMessages()

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "test_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          console.log("🔔 New message received:", payload)
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, supabase])

  if (messages.length === 0) {
    return null
  }

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3 max-w-md">
      {messages.map((msg) => (
        <Card key={msg.id} className="shadow-lg border-2 animate-in slide-in-from-right-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {msg.is_global ? (
                  <>
                    <Megaphone className="h-4 w-4 text-blue-600" />
                    <span className="text-blue-600">Broadcast Message</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Pesan Personal</span>
                  </>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleDismiss(msg.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Alert className={msg.is_global ? "border-blue-500 bg-blue-50" : "border-green-500 bg-green-50"}>
              <AlertTitle className="text-sm font-semibold">
                Dari: {msg.sender_name}
              </AlertTitle>
              <AlertDescription className="text-sm mt-1 whitespace-pre-wrap">
                {msg.message}
              </AlertDescription>
            </Alert>
            <p className="text-xs text-muted-foreground text-right">
              {new Date(msg.created_at).toLocaleTimeString("id-ID")}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}