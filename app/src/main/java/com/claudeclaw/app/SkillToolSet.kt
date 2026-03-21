package com.claudeclaw.app

import org.json.JSONObject

/**
 * A tool set loaded from a SKILL.md file. Provides multiple FunctionTool
 * definitions scoped to this skill, plus instructions that guide the LLM
 * during execution.
 *
 * Loaded from .claude/skills/<name>/SKILL.md at runtime.
 */
class SkillToolSet(
    name: String,
    val description: String,
    val instructions: String,
    val tools: List<FunctionTool>
) : BaseTool(name) {
    override fun definitions() = tools.flatMap { it.definitions() }
}
