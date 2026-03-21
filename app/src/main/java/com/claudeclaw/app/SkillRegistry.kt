package com.claudeclaw.app

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.File

/**
 * Factory that discovers FunctionTools and SkillToolSets, then assembles
 * them into an AgentTool. Mimics Claude Agent SDK's auto-discovery from
 * .claude/skills/<name>/SKILL.md.
 *
 * Skills are read from internal storage (filesDir/skills/) so new skills
 * can be installed at runtime without rebuilding.
 */
class SkillRegistry(private val context: Context) {

    val skillsDir: File get() = File(context.filesDir, "skills")

    init {
        seedBundledSkills()
    }

    /** Build the main AgentTool with all discovered tools and skills. */
    fun createAgent(apiClient: ClaudeApiClient, model: String = "claude-sonnet-4-6"): AgentTool {
        val functionTools = loadFunctionTools()
        val skills = loadSkillToolSets(functionTools)

        Log.d("ClaudeClaw", "skills/: ${skills.size} skills loaded")
        Log.d("ClaudeClaw", "tools/: ${functionTools.size} tools loaded")

        return AgentTool(
            name = "claudeclaw",
            model = model,
            instructions = "You are ClaudeClaw, an AI coding assistant on Android.",
            tools = skills, // skills contain scoped FunctionTools
            apiClient = apiClient
        )
    }

    /** Install a new skill at runtime (e.g. downloaded from a remote source). */
    fun installSkill(name: String, content: String): Boolean {
        return try {
            val dir = File(skillsDir, name)
            dir.mkdirs()
            File(dir, "SKILL.md").writeText(content)
            Log.d("ClaudeClaw", "Installed skill: $name")
            true
        } catch (e: Exception) {
            Log.e("ClaudeClaw", "Failed to install skill: $name", e)
            false
        }
    }

    // Copy bundled assets/skills/ to filesDir/skills/ (skip existing)
    private fun seedBundledSkills() {
        val assetDirs = context.assets.list("skills") ?: return
        for (dir in assetDirs) {
            val target = File(skillsDir, "$dir/SKILL.md")
            if (target.exists()) continue
            try {
                target.parentFile?.mkdirs()
                context.assets.open("skills/$dir/SKILL.md").use { input ->
                    target.outputStream().use { output -> input.copyTo(output) }
                }
                Log.d("ClaudeClaw", "Seeded skill: $dir")
            } catch (e: Exception) {
                Log.e("ClaudeClaw", "Failed to seed skill: $dir", e)
            }
        }
    }

    // Load all FunctionTools from assets/tools/*.json
    private fun loadFunctionTools(): Map<String, FunctionTool> {
        val toolFiles = context.assets.list("tools") ?: return emptyMap()
        return toolFiles.filter { it.endsWith(".json") }.mapNotNull { fileName ->
            try {
                val raw = context.assets.open("tools/$fileName").bufferedReader().readText()
                val json = JSONObject(raw)
                val name = json.getString("name")
                name to FunctionTool(name, json)
            } catch (e: Exception) {
                Log.e("ClaudeClaw", "Failed to load tool: $fileName", e)
                null
            }
        }.toMap()
    }

    // Load all SkillToolSets from filesDir/skills/*/SKILL.md
    private fun loadSkillToolSets(allTools: Map<String, FunctionTool>): List<SkillToolSet> {
        if (!skillsDir.exists()) return emptyList()
        return skillsDir.listFiles()?.filter { it.isDirectory }?.mapNotNull { dir ->
            val file = File(dir, "SKILL.md")
            if (!file.exists()) return@mapNotNull null
            try {
                parseSkillMd(file.readText(), allTools)
            } catch (e: Exception) {
                Log.e("ClaudeClaw", "Failed to load skill: ${dir.name}", e)
                null
            }
        } ?: emptyList()
    }

    private fun parseSkillMd(raw: String, allTools: Map<String, FunctionTool>): SkillToolSet? {
        if (!raw.startsWith("---")) return null
        val endIdx = raw.indexOf("---", 3)
        if (endIdx < 0) return null

        val frontmatter = raw.substring(3, endIdx).trim()
        val body = raw.substring(endIdx + 3).trim()

        var name = ""
        var description = ""
        for (line in frontmatter.lines()) {
            val trimmed = line.trim()
            when {
                trimmed.startsWith("name:") -> name = trimmed.removePrefix("name:").trim()
                trimmed.startsWith("description:") -> description = trimmed.removePrefix("description:").trim()
            }
        }
        if (name.isEmpty()) return null

        // Extract tool names from ## Tools section, resolve to FunctionTool instances
        val toolNames = mutableListOf<String>()
        val toolsMatch = Regex("## Tools\\s*\\n(.+)", RegexOption.MULTILINE).find(body)
        if (toolsMatch != null) {
            toolNames.addAll(
                toolsMatch.groupValues[1].split(",").map { it.trim() }.filter { it.isNotEmpty() }
            )
        }

        val scopedTools = if (toolNames.isNotEmpty()) {
            toolNames.mapNotNull { allTools[it] }
        } else {
            allTools.values.toList() // fallback: all tools
        }

        return SkillToolSet(name, description, body, scopedTools)
    }
}
