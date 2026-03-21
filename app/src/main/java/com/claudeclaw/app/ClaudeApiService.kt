package com.claudeclaw.app

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

sealed class StreamEvent {
    data class Text(val text: String) : StreamEvent()
    data class Usage(val inputTokens: Int, val outputTokens: Int) : StreamEvent()
    data class Error(val message: String) : StreamEvent()
    data class Status(val status: String) : StreamEvent()
    data class SkillSelected(val name: String) : StreamEvent()
    data class ToolCall(val name: String, val id: String, val input: JSONObject) : StreamEvent()
    object Done : StreamEvent()
}

class ClaudeApiService(private var apiKey: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(300, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    var model: String = "claude-sonnet-4-6"
    fun updateApiKey(key: String) { apiKey = key }

    fun streamMessage(messages: List<ChatMessage>, registry: SkillRegistry): Flow<StreamEvent> = callbackFlow {
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
                // PHASE 1: Planning — skill selection, no tools
                // ══════════════════════════════════════
                trySend(StreamEvent.Status("Planning..."))

                val phase1Body = JSONObject().apply {
                    put("model", model); put("max_tokens", 1024)
                    put("stream", true)
                    put("system", registry.planningPrompt())
                    put("messages", jsonMessages)
                }

                val planText = StringBuilder()
                var selectedSkill = ""

                val planResponse = apiCall(phase1Body) ?: run {
                    trySend(StreamEvent.Error("API call failed")); trySend(StreamEvent.Done); close(); return@withContext
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
                                if (u != null) { totalIn += u.optInt("input_tokens", 0) }
                            }
                            "message_delta" -> {
                                val u = ev.optJSONObject("usage")
                                if (u != null) { totalOut += u.optInt("output_tokens", 0) }
                            }
                        }
                    } catch (_: Exception) {}
                }
                planReader.close(); planResponse.close()
                trySend(StreamEvent.Usage(totalIn, totalOut))

                // Extract skill from [SKILL:name] tag
                val skillMatch = Regex("\\[SKILL:(\\S+)]").find(planText.toString())
                selectedSkill = skillMatch?.groupValues?.get(1) ?: "rapid-prototype"
                Log.d("ClaudeClaw", "Selected skill: $selectedSkill")
                trySend(StreamEvent.SkillSelected(selectedSkill))

                // ══════════════════════════════════════
                // PHASE 2: Execution — load tools, call them
                // ══════════════════════════════════════
                trySend(StreamEvent.Status("Loading tools..."))

                val tools = registry.toolsForSkill(selectedSkill)
                Log.d("ClaudeClaw", "Loaded ${tools.length()} tools for skill:$selectedSkill")

                // Build conversation for phase 2
                val phase2Messages = JSONArray(jsonMessages.toString())
                // Add the planning response as assistant message (without the [SKILL:] tag)
                val cleanPlan = planText.toString().replace(Regex("\\[SKILL:\\S+]"), "").trim()
                phase2Messages.put(JSONObject().apply {
                    put("role", "assistant"); put("content", cleanPlan)
                })
                // Add a user message to trigger tool execution
                phase2Messages.put(JSONObject().apply {
                    put("role", "user"); put("content", "Go ahead and execute the plan using your tools.")
                })

                // Tool use loop
                val apiMessages = phase2Messages
                while (true) {
                    trySend(StreamEvent.Status("Building..."))

                    val phase2Body = JSONObject().apply {
                        put("model", model); put("max_tokens", 4096)
                        put("stream", true)
                        put("system", registry.executionPrompt(selectedSkill))
                        put("tools", tools as Any)
                        put("messages", apiMessages)
                    }

                    val response = apiCall(phase2Body)
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
                        for ((name, id, _) in toolCalls) {
                            results.put(JSONObject().apply {
                                put("type", "tool_result"); put("tool_use_id", id)
                                put("content", "$name completed")
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

    private fun apiCall(body: JSONObject): okhttp3.Response? {
        for (attempt in 1..3) {
            val req = Request.Builder()
                .url("https://api.anthropic.com/v1/messages")
                .addHeader("x-api-key", apiKey)
                .addHeader("anthropic-version", "2023-06-01")
                .addHeader("content-type", "application/json")
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .build()
            val resp = client.newCall(req).execute()
            if (resp.code == 529 || resp.code == 429) {
                resp.close(); Thread.sleep(attempt * 5000L); continue
            }
            if (!resp.isSuccessful) {
                Log.e("ClaudeClaw", "API ${resp.code}: ${resp.body?.string()?.take(200)}")
                resp.close(); return null
            }
            return resp
        }
        return null
    }

    companion object {
        const val INPUT_COST_PER_MILLION = 3.0
        const val OUTPUT_COST_PER_MILLION = 15.0
        fun calculateCost(i: Int, o: Int) = (i * INPUT_COST_PER_MILLION + o * OUTPUT_COST_PER_MILLION) / 1_000_000.0
    }
}
