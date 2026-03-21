package com.claudeclaw.app

import android.content.Context
import java.io.File

sealed class ToolResult {
    data class Text(val text: String) : ToolResult()
    data class ShowMiniApp(val name: String, val path: String) : ToolResult()
    data class DeployMiniApp(val name: String, val path: String) : ToolResult()
}

class ToolExecutor(private val context: Context) {

    private val workspaceDir: File
        get() = File(context.filesDir, "workspace").also { it.mkdirs() }

    private val miniAppsDir: File
        get() = File(context.filesDir, "miniapps").also { it.mkdirs() }

    fun execute(toolName: String, input: Map<String, Any?>): ToolResult {
        return try {
            when (toolName) {
                "write_file" -> writeFile(
                    input["path"] as String,
                    input["content"] as String
                )
                "read_file" -> readFile(input["path"] as String)
                "list_files" -> listFiles(input["directory"] as? String ?: ".")
                "run_miniapp" -> runMiniApp(
                    input["name"] as String,
                    input["html"] as String
                )
                "deploy_miniapp" -> deployMiniApp(
                    input["name"] as String,
                    input["html"] as String
                )
                else -> ToolResult.Text("Unknown tool: $toolName")
            }
        } catch (e: Exception) {
            ToolResult.Text("Error: ${e.message}")
        }
    }

    private fun writeFile(path: String, content: String): ToolResult {
        val file = File(workspaceDir, path)
        file.parentFile?.mkdirs()
        file.writeText(content)
        return ToolResult.Text("Written: $path (${content.length} chars)")
    }

    private fun readFile(path: String): ToolResult {
        val file = File(workspaceDir, path)
        if (!file.exists()) return ToolResult.Text("File not found: $path")
        val content = file.readText()
        return ToolResult.Text(if (content.length > 8000) content.take(8000) + "\n...(truncated)" else content)
    }

    private fun listFiles(directory: String): ToolResult {
        val dir = File(workspaceDir, directory)
        if (!dir.exists()) return ToolResult.Text("Directory not found: $directory")
        val files = dir.walkTopDown().take(100).map {
            it.relativeTo(workspaceDir).path
        }.joinToString("\n")
        return ToolResult.Text(files.ifEmpty { "(empty)" })
    }

    private fun runMiniApp(name: String, html: String): ToolResult {
        val file = File(miniAppsDir, "${name.lowercase().replace(" ", "_")}.html")
        file.writeText(html)
        return ToolResult.ShowMiniApp(name, file.absolutePath)
    }

    private fun deployMiniApp(name: String, html: String): ToolResult {
        val file = File(miniAppsDir, "${name.lowercase().replace(" ", "_")}.html")
        file.writeText(html)
        return ToolResult.DeployMiniApp(name, file.absolutePath)
    }

    fun getMiniAppPath(name: String): String? {
        val file = File(miniAppsDir, "${name.lowercase().replace(" ", "_")}.html")
        return if (file.exists()) file.absolutePath else null
    }

    fun listMiniApps(): List<String> {
        return miniAppsDir.listFiles()?.filter { it.extension == "html" }
            ?.map { it.nameWithoutExtension.replace("_", " ") } ?: emptyList()
    }
}
