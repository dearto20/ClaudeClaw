package com.claudeclaw.app

import android.util.Log
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * An agent that extends BaseTool — can be nested in another agent's tools[].
 * Owns the two-phase flow: planning (skill selection) → execution (agentic loop).
 */
class AgentTool(
    name: String,
    val model: String,
    val instructions: String,
    val tools: List<BaseTool>,
    private val apiClient: ClaudeApiClient
) : BaseTool(name) {

    val skills: List<SkillToolSet> get() = tools.filterIsInstance<SkillToolSet>()
    val functionTools: List<FunctionTool> get() = tools.filterIsInstance<FunctionTool>()

    /** When nested as a tool in a parent agent, expose all tool definitions. */
    override fun definitions() = tools.flatMap { it.definitions() }

    /** Run the two-phase agent flow, emitting StreamEvents. */
    fun run(messages: List<ChatMessage>): Flow<StreamEvent> = callbackFlow {
        withContext(Dispatchers.IO) {
            try {
                val jsonMessages = JSONArray()
                for (msg in messages) {
                    jsonMessages.put(JSONObject().apply {
                        put("role", msg.role); put("content", msg.content)
                    })
                }
                var totalIn = 0; var totalOut = 0

                // ══════════════════════════════════════
                // PHASE 1: Planning — all skills in prompt, LLM picks one
                // ══════════════════════════════════════
                trySend(StreamEvent.Status("Planning..."))

                val phase1Body = JSONObject().apply {
                    put("model", model); put("max_tokens", 1024)
                    put("stream", true)
                    put("system", planningPrompt())
                    put("messages", jsonMessages)
                }

                val planText = StringBuilder()

                val planResponse = apiClient.call(phase1Body) ?: run {
                    trySend(StreamEvent.Error("API call failed"))
                    trySend(StreamEvent.Done); close(); return@withContext
                }

                val planReader = BufferedReader(InputStreamReader(planResponse.body!!.byteStream()))
                var line: String?
                while (planReader.readLine().also { line = it } != null) {
                    val l = line ?: continue
                    if (!l.startsWith("data: ")) continue
                    val data = l.removePrefix("data: ").trim()
                    if (data.isEmpty()) continue
                    try {
                        val ev = JSONObject(data)
                        when (ev.optString("type")) {
                            "content_block_delta" -> {
                                val txt = ev.optJSONObject("delta")?.optString("text", "") ?: ""
                                if (txt.isNotEmpty()) {
                                    planText.append(txt)
                                    trySend(StreamEvent.Text(txt))
                                }
                            }
                            "message_start" -> {
                                val u = ev.optJSONObject("message")?.optJSONObject("usage")
                                if (u != null) totalIn += u.optInt("input_tokens", 0)
                            }
                            "message_delta" -> {
                                val u = ev.optJSONObject("usage")
                                if (u != null) totalOut += u.optInt("output_tokens", 0)
                            }
                        }
                    } catch (_: Exception) {}
                }
                planReader.close(); planResponse.close()
                trySend(StreamEvent.Usage(totalIn, totalOut))

                // Extract skill from [SKILL:name] tag
                val skillMatch = Regex("\\[SKILL:(\\S+)]").find(planText.toString())
                val selectedSkillName = skillMatch?.groupValues?.get(1) ?: skills.firstOrNull()?.name ?: ""
                val selectedSkill = skills.find { it.name == selectedSkillName }
                Log.d("ClaudeClaw", "Selected skill: $selectedSkillName")
                trySend(StreamEvent.SkillSelected(selectedSkillName))

                // ══════════════════════════════════════
                // PHASE 2: Execution — scoped tools, agentic loop
                // ══════════════════════════════════════
                trySend(StreamEvent.Status("Loading tools..."))

                val scopedTools = if (selectedSkill != null && selectedSkill.definitions().isNotEmpty()) {
                    selectedSkill.definitions()
                } else {
                    tools.flatMap { it.definitions() }
                }
                val toolsArray = JSONArray().apply { scopedTools.forEach { put(it) } }
                Log.d("ClaudeClaw", "Loaded ${toolsArray.length()} tools for skill:$selectedSkillName")

                // Build conversation for phase 2
                val phase2Messages = JSONArray(jsonMessages.toString())
                val cleanPlan = planText.toString().replace(Regex("\\[SKILL:\\S+]"), "").trim()
                phase2Messages.put(JSONObject().apply {
                    put("role", "assistant"); put("content", cleanPlan)
                })
                phase2Messages.put(JSONObject().apply {
                    put("role", "user"); put("content", "Go ahead and execute the plan using your tools.")
                })

                // Agentic tool use loop
                val apiMessages = phase2Messages
                while (true) {
                    trySend(StreamEvent.Status("Building..."))

                    val phase2Body = JSONObject().apply {
                        put("model", model); put("max_tokens", 4096)
                        put("stream", true)
                        put("system", executionPrompt(selectedSkill))
                        put("tools", toolsArray as Any)
                        put("messages", apiMessages)
                    }

                    val response = apiClient.call(phase2Body)
                    if (response == null) {
                        trySend(StreamEvent.Error("API call failed")); break
                    }

                    val reader = BufferedReader(InputStreamReader(response.body!!.byteStream()))
                    var blockType = ""; var toolName = ""; var toolId = ""
                    var toolJson = StringBuilder(); var stopReason = ""
                    val contentBlocks = JSONArray()
                    val toolCalls = mutableListOf<Triple<String, String, JSONObject>>()

                    while (reader.readLine().also { line = it } != null) {
                        val l = line ?: continue
                        if (!l.startsWith("data: ")) continue
                        val d = l.removePrefix("data: ").trim()
                        if (d.isEmpty()) continue
                        try {
                            val ev = JSONObject(d)
                            when (ev.optString("type")) {
                                "content_block_start" -> {
                                    val cb = ev.optJSONObject("content_block")
                                    blockType = cb?.optString("type", "") ?: ""
                                    if (blockType == "tool_use") {
                                        toolName = cb?.optString("name", "") ?: ""
                                        toolId = cb?.optString("id", "") ?: ""
                                        toolJson = StringBuilder()
                                        trySend(StreamEvent.Status("$toolName..."))
                                    }
                                }
                                "content_block_delta" -> {
                                    val delta = ev.optJSONObject("delta")
                                    when (delta?.optString("type")) {
                                        "text_delta" -> { /* ignore text in phase 2 */ }
                                        "input_json_delta" -> toolJson.append(delta.optString("partial_json", ""))
                                    }
                                }
                                "content_block_stop" -> {
                                    if (blockType == "tool_use") {
                                        val input = try { JSONObject(toolJson.toString()) } catch (_: Exception) { JSONObject() }
                                        contentBlocks.put(JSONObject().apply {
                                            put("type", "tool_use"); put("id", toolId)
                                            put("name", toolName); put("input", input)
                                        })
                                        toolCalls.add(Triple(toolName, toolId, input))
                                        trySend(StreamEvent.ToolCall(toolName, toolId, input))
                                    }
                                    blockType = ""
                                }
                                "message_delta" -> {
                                    stopReason = ev.optJSONObject("delta")?.optString("stop_reason", "") ?: ""
                                    val u = ev.optJSONObject("usage")
                                    if (u != null) totalOut += u.optInt("output_tokens", 0)
                                }
                                "message_start" -> {
                                    val u = ev.optJSONObject("message")?.optJSONObject("usage")
                                    if (u != null) totalIn += u.optInt("input_tokens", 0)
                                }
                                "error" -> trySend(StreamEvent.Error(ev.optJSONObject("error")?.optString("message") ?: "Error"))
                            }
                        } catch (_: Exception) {}
                    }
                    reader.close(); response.close()
                    trySend(StreamEvent.Usage(totalIn, totalOut))

                    if (stopReason == "tool_use" && toolCalls.isNotEmpty()) {
                        apiMessages.put(JSONObject().apply { put("role", "assistant"); put("content", contentBlocks) })
                        val results = JSONArray()
                        for ((tName, id, _) in toolCalls) {
                            results.put(JSONObject().apply {
                                put("type", "tool_result"); put("tool_use_id", id)
                                put("content", "$tName completed")
                            })
                        }
                        apiMessages.put(JSONObject().apply { put("role", "user"); put("content", results) })
                        continue
                    } else {
                        break
                    }
                }

                trySend(StreamEvent.Status("Ready"))
                trySend(StreamEvent.Done)
            } catch (e: Exception) {
                Log.e("ClaudeClaw", "Error", e)
                trySend(StreamEvent.Error(e.message ?: "Failed"))
                trySend(StreamEvent.Done)
            }
        }
        awaitClose {}
    }

    private fun planningPrompt(): String {
        val skillList = skills.joinToString("\n\n") { skill ->
            "### ${skill.name}\n${skill.description}\n\n${skill.instructions}"
        }

        return """$instructions

You have the following skills available:

$skillList

When the user asks you to build something:
1. Choose the most appropriate skill
2. Explain your plan: why this skill fits, your design approach, how you'll structure the app
3. End your response with exactly: [SKILL:skill_name]

Keep planning to 4-6 sentences. Do NOT mention specific tool names — tools are loaded after you select a skill."""
    }

    private fun executionPrompt(skill: SkillToolSet?): String {
        return """$instructions — executing skill:${skill?.name ?: "default"}.

${skill?.instructions ?: "Execute tools as needed."}

The user's request and your plan are in the conversation. Now execute by calling your tools.
Call ALL tools needed. Do NOT output text — only tool calls.
Always call tool:deploy LAST."""
    }
}
