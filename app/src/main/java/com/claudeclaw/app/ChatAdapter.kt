package com.claudeclaw.app

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.claudeclaw.app.databinding.ItemMessageBinding

class ChatAdapter(private val messages: List<ChatMessage>) :
    RecyclerView.Adapter<ChatAdapter.MessageViewHolder>() {

    inner class MessageViewHolder(val binding: ItemMessageBinding) :
        RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MessageViewHolder {
        val binding = ItemMessageBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return MessageViewHolder(binding)
    }

    override fun onBindViewHolder(holder: MessageViewHolder, position: Int) {
        val message = messages[position]

        when (message.type) {
            MessageType.SYSTEM -> {
                holder.binding.tvRole.text = "\u25B6 deploy"
                holder.binding.tvRole.setTextColor(Color.parseColor("#FF3FB950"))
                holder.binding.tvContent.text = message.content
                holder.binding.tvContent.setTextColor(Color.parseColor("#FF8B949E"))
                holder.binding.tvContent.textSize = 12f
                holder.binding.root.setBackgroundColor(Color.parseColor("#0D3FB950"))
            }
            MessageType.CHAT -> {
                val isUser = message.role == "user"
                if (isUser) {
                    holder.binding.tvRole.text = "> you"
                    holder.binding.tvRole.setTextColor(Color.parseColor("#FF58A6FF"))
                    holder.binding.tvContent.text = message.content
                    holder.binding.tvContent.setTextColor(Color.WHITE)
                    holder.binding.tvContent.textSize = 14f
                } else {
                    holder.binding.tvRole.text = "  claudeclaw"
                    holder.binding.tvRole.setTextColor(Color.parseColor("#FF8B949E"))
                    // Hide HTML code blocks in display, show summary
                    val displayText = formatDisplay(message.content)
                    holder.binding.tvContent.text = displayText
                    holder.binding.tvContent.setTextColor(Color.parseColor("#FFC9D1D9"))
                    holder.binding.tvContent.textSize = 14f
                }
                holder.binding.root.setBackgroundColor(Color.TRANSPARENT)
            }
        }
    }

    private fun formatDisplay(text: String): String {
        // Collapse large HTML code blocks to a summary
        val htmlPattern = Regex("```html\\s*\\n([\\s\\S]*?)```", RegexOption.DOT_MATCHES_ALL)
        return htmlPattern.replace(text) { match ->
            val html = match.groupValues[1]
            val lines = html.lines().size
            val kb = String.format("%.1f", html.length / 1024.0)
            "[HTML App: ${kb}KB, ${lines} lines]"
        }
    }

    override fun getItemCount() = messages.size
}
