package com.claudeclaw.app

data class ChatMessage(
    val role: String,
    var content: String,
    val isStreaming: Boolean = false,
    val type: MessageType = MessageType.CHAT
)

enum class MessageType {
    CHAT,
    SYSTEM
}
