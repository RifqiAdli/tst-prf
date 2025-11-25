import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

type ActivityType =
  | "tab_switch"
  | "screen_blur"
  | "fullscreen_exit"
  | "print_screen"
  | "devtools"
  | "copy_paste"
  | "mouse_leave"
  | "right_click"
  | "window_resize"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId, scheduleId, activityType, metadata } = await request.json()

    // Validate session
    const { data: session } = await supabase
      .from("test_sessions")
      .select("*, schedule:test_schedules(max_strikes)")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single()

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const newStrikeCount = session.strike_count + 1
    const maxStrikes = session.schedule?.max_strikes || 3
    const shouldTerminate = newStrikeCount >= maxStrikes

    // Log activity
    await supabase.from("activity_logs").insert({
      session_id: sessionId,
      user_id: user.id,
      schedule_id: scheduleId,
      activity_type: activityType as ActivityType,
      action_taken: shouldTerminate ? "terminated" : "strike",
      metadata: metadata || {},
    })

    // Update session strike count
    await supabase
      .from("test_sessions")
      .update({
        strike_count: newStrikeCount,
        ...(shouldTerminate ? { status: "force_submitted", ended_at: new Date().toISOString() } : {}),
      })
      .eq("id", sessionId)

    // If terminated, update participant status
    if (shouldTerminate) {
      await supabase
        .from("schedule_participants")
        .update({ status: "force_submitted" })
        .eq("schedule_id", scheduleId)
        .eq("user_id", user.id)
    }

    return NextResponse.json({
      success: true,
      strikeCount: newStrikeCount,
      terminated: shouldTerminate,
    })
  } catch (error) {
    console.error("Log activity error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
