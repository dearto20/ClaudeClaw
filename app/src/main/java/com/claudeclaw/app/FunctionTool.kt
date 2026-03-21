package com.claudeclaw.app

import org.json.JSONObject

class FunctionTool(name: String, val definition: JSONObject) : BaseTool(name) {
    override fun definitions() = listOf(definition)
}
