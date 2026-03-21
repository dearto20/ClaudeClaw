package com.claudeclaw.app

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

// Loads skills from SKILL.md and tools from tools/*.json at runtime.
class SkillRegistry(private val context: Context) {

    data class Skill(
        val name: String,
        val description: String,
        val tools: List<String>,
        val trigger: String,
        val approach: String
    )

    private var _skills: List<Skill> = emptyList()
    private var _tools: Map<String, JSONObject> = emptyMap()

    val skills: List<Skill> get() = _skills

    init {
        loadSkillMd()
        loadTools()
        Log.d("ClaudeClaw", "SKILL.md: ${_skills.size} skills loaded")
        Log.d("ClaudeClaw", "tools/: ${_tools.size} tools loaded")
    }

    private fun loadSkillMd() {
        try {
            val raw = context.assets.open("SKILL.md").bufferedReader().readText()
            _skills = parseSkillMd(raw)
        } catch (e: Exception) {
            Log.e("ClaudeClaw", "Failed to load SKILL.md", e)
        }
    }

    private fun parseSkillMd(raw: String): List<Skill> {
        val result = mutableListOf<Skill>()
        // Split by --- separator
        val sections = raw.split(Regex("\\n---\\n"))

        for (section in sections) {
            val lines = section.trim().lines()
            // Find ## heading
            val heading = lines.find { it.startsWith("## ") } ?: continue
            val name = heading.removePrefix("## ").trim()

            // First non-heading, non-empty line is the description
            val descLine = lines.firstOrNull {
                !it.startsWith("#") && !it.startsWith("-") && it.isNotBlank()
            } ?: ""

            var tools = listOf<String>()
            var trigger = ""
            val approach = StringBuilder()
            var inApproach = false

            for (line in lines) {
                val trimmed = line.trim()
                when {
                    trimmed.startsWith("- tools:") -> {
                        tools = trimmed.removePrefix("- tools:").trim()
                            .split(",").map { it.trim() }.filter { it.isNotEmpty() }
                        inApproach = false
                    }
                    trimmed.startsWith("- trigger:") -> {
                        trigger = trimmed.removePrefix("- trigger:").trim()
                        inApproach = false
                    }
                    trimmed.startsWith("- approach:") -> {
                        inApproach = true
                    }
                    inApproach && trimmed.matches(Regex("\\d+\\..*")) -> {
                        approach.append(trimmed).append("\n")
                    }
                }
            }

            if (tools.isNotEmpty()) {
                result.add(Skill(name, descLine, tools, trigger, approach.toString().trim()))
            }
        }
        return result
    }

    private fun loadTools() {
        val toolFiles = context.assets.list("tools") ?: return
        _tools = toolFiles.filter { it.endsWith(".json") }.mapNotNull { fileName ->
            try {
                val raw = context.assets.open("tools/$fileName").bufferedReader().readText()
                val json = JSONObject(raw)
                json.getString("name") to json
            } catch (e: Exception) {
                Log.e("ClaudeClaw", "Failed to load tool: $fileName", e)
                null
            }
        }.toMap()
    }

    fun planningPrompt(): String {
        val skillList = _skills.joinToString("\n\n") { skill ->
            """• skill:${skill.name} — ${skill.description}
  Tools: ${skill.tools.joinToString(", ")}
  When: ${skill.trigger}"""
        }

        return """You are ClaudeClaw, an AI coding assistant on Android.

Your skills are defined in SKILL.md:

$skillList

When the user asks you to build something:
1. Choose the most appropriate skill
2. Explain your plan: why this skill fits, how you'll use its tools, your design decisions
3. End your response with exactly: [SKILL:skill_name]

Keep planning to 4-6 sentences."""
    }

    fun executionPrompt(skillName: String): String {
        val skill = _skills.find { it.name == skillName } ?: _skills.firstOrNull()
        return """You are ClaudeClaw executing skill:${skill?.name}.

Approach from SKILL.md:
${skill?.approach ?: "Execute tools as needed."}

The user's request and your plan are in the conversation. Now execute by calling your tools.
Call ALL tools needed. Do NOT output text — only tool calls.
Always call tool:deploy LAST."""
    }

    fun toolsForSkill(skillName: String): JSONArray {
        val skill = _skills.find { it.name == skillName } ?: _skills.firstOrNull()
        val arr = JSONArray()
        skill?.tools?.forEach { toolName ->
            _tools[toolName]?.let { arr.put(it) }
        }
        return arr
    }
}
