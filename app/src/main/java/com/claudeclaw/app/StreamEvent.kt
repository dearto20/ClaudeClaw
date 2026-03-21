package com.claudeclaw.app

import org.json.JSONObject

sealed class StreamEvent {
    data class Text(val text: String) : StreamEvent()
    data class Usage(val inputTokens: Int, val outputTokens: Int) : StreamEvent()
    data class Error(val message: String) : StreamEvent()
    data class Status(val status: String) : StreamEvent()
    data class SkillSelected(val name: String) : StreamEvent()
    data class ToolCall(val name: String, val id: String, val input: JSONObject) : StreamEvent()
    object Done : StreamEvent()
}
