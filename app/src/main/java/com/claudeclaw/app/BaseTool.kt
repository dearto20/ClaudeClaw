package com.claudeclaw.app

import org.json.JSONObject

/**
 * Base class for all tools in the ClaudeClaw agent framework.
 * Follows ADK hierarchy: BaseTool → FunctionTool, SkillToolSet, AgentTool.
 */
abstract class BaseTool(val name: String) {
    /** Returns tool definitions to send to the Claude API. */
    abstract fun definitions(): List<JSONObject>
}
