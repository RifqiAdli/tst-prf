import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId, updates } = await request.json()

    // Validate session belongs to user
    const { data: session } = await supabase.from("test_sessions").select("user_id").eq("id", sessionId).single()

    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Only allow specific fields to be updated
    const allowedFields = ["current_question_index", "time_remaining_seconds", "strike_count"]

    const sanitizedUpdates: Record<string, unknown> = {}
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        sanitizedUpdates[key] = updates[key]
      }
    }

    const { error } = await supabase.from("test_sessions").update(sanitizedUpdates).eq("id", sessionId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Session update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
