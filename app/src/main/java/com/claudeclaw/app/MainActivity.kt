package com.claudeclaw.app

import android.app.AlertDialog
import android.content.Intent
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.claudeclaw.app.databinding.ActivityMainBinding
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import android.util.Log
import org.json.JSONObject
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val messages = mutableListOf<ChatMessage>()
    private val conversationHistory = mutableListOf<ChatMessage>()
    private lateinit var adapter: ChatAdapter
    private var apiClient: ClaudeApiClient? = null
    private val appBuilder = AppBuilder()
    private lateinit var skillRegistry: SkillRegistry
    private var agent: AgentTool? = null
    private var streamJob: Job? = null
    private var totalInputTokens = 0
    private var totalOutputTokens = 0
    private var totalCost = 0.0
    private val prefs by lazy { getSharedPreferences("claudeclaw", MODE_PRIVATE) }

    // Accumulated config from tool calls
    private var buildConfig = JSONObject()
    private val toolLog = mutableListOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        skillRegistry = SkillRegistry(this)
        setupRecyclerView(); setupClickListeners(); loadApiKey()
        updateStatus("Ready", 0xFF3FB950.toInt())
        requestNotificationPermission()
    }

    private fun setupRecyclerView() {
        adapter = ChatAdapter(messages)
        binding.rvChat.layoutManager = LinearLayoutManager(this).apply { stackFromEnd = true }
        binding.rvChat.adapter = adapter
    }

    private fun setupClickListeners() {
        binding.btnSend.setOnClickListener {
            val text = binding.etMessage.text.toString().trim()
            if (text.isEmpty()) return@setOnClickListener
            if (agent == null) { showApiKeyDialog(); return@setOnClickListener }
            sendMessage(text)
        }
        binding.btnSettings.setOnClickListener { showApiKeyDialog() }
    }

    private fun loadApiKey() {
        val key = prefs.getString("api_key", null)
        if (!key.isNullOrEmpty()) {
            apiClient = ClaudeApiClient(key)
            agent = skillRegistry.createAgent(apiClient!!)
        } else {
            showApiKeyDialog()
        }
    }

    private fun showApiKeyDialog() {
        val input = EditText(this).apply {
            hint = "sk-ant-..."; setText(prefs.getString("api_key", ""))
            setTextColor(0xFFFFFFFF.toInt()); setHintTextColor(0xFF484F58.toInt())
            setBackgroundColor(0xFF21262D.toInt()); setPadding(40, 30, 40, 30)
        }
        val c = LinearLayout(this).apply {
            setPadding(50, 20, 50, 0)
            addView(input, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }
        AlertDialog.Builder(this, com.google.android.material.R.style.ThemeOverlay_Material3_MaterialAlertDialog)
            .setTitle("API Key").setView(c)
            .setPositiveButton("Save") { _, _ ->
                val k = input.text.toString().trim()
                if (k.isNotEmpty()) {
                    prefs.edit().putString("api_key", k).apply()
                    apiClient = ClaudeApiClient(k)
                    agent = skillRegistry.createAgent(apiClient!!)
                }
            }.setNegativeButton("Cancel", null).show()
    }

    private fun sendMessage(text: String) {
        val currentAgent = agent ?: return
        binding.etMessage.setText("")
        messages.add(ChatMessage(role = "user", content = text))
        adapter.notifyItemInserted(messages.size - 1); scrollToBottom()
        conversationHistory.add(ChatMessage(role = "user", content = text))

        messages.add(ChatMessage(role = "assistant", content = ""))
        val idx = messages.size - 1
        adapter.notifyItemInserted(idx)
        updateStatus("Thinking...", 0xFFEAA700.toInt())

        // Reset build state
        buildConfig = JSONObject()
        toolLog.clear()
        var appName = ""

        streamJob?.cancel()
        streamJob = lifecycleScope.launch {
            try {
                val planText = StringBuilder()
                var lastUpdate = 0L

                currentAgent.run(conversationHistory).collect { event ->
                    when (event) {
                        is StreamEvent.Text -> {
                            planText.append(event.text)
                            val now = System.currentTimeMillis()
                            if (now - lastUpdate > 300) {
                                lastUpdate = now
                                val display = planText.toString().replace(Regex("\\[SKILL:\\S+]"), "").trim()
                                messages[idx] = messages[idx].copy(content = buildDisplay(StringBuilder(display)))
                                adapter.notifyItemChanged(idx, "t")
                                scrollToBottom()
                            }
                        }
                        is StreamEvent.SkillSelected -> {
                            activeSkill = event.name
                            val display = planText.toString().replace(Regex("\\[SKILL:\\S+]"), "").trim()
                            messages[idx] = messages[idx].copy(content = buildDisplay(StringBuilder(display)))
                            adapter.notifyItemChanged(idx, "t"); scrollToBottom()
                        }
                        is StreamEvent.ToolCall -> {
                            val desc = describeToolCall(event.name, event.input)
                            toolLog.add(desc)
                            processToolCall(event.name, event.input)
                            if (event.name == "layout") appName = event.input.optString("name", "App")

                            kotlinx.coroutines.delay(200)

                            val display = planText.toString().replace(Regex("\\[SKILL:\\S+]"), "").trim()
                            messages[idx] = messages[idx].copy(content = buildDisplay(StringBuilder(display)))
                            adapter.notifyItemChanged(idx, "t")
                            scrollToBottom()
                            updateStatus("${event.name}...", 0xFF58A6FF.toInt())

                            if (event.name == "deploy") {
                                appName = event.input.optString("name", appName)
                                if (!buildConfig.has("name")) buildConfig.put("name", appName)
                                Log.d("ClaudeClaw", "DEPLOYING: $buildConfig")
                                val html = appBuilder.build(buildConfig)
                                val kb = String.format("%.1f", html.length / 1024.0)
                                toolLog.add("  ✓ Built $appName ($kb KB)")
                                messages[idx] = messages[idx].copy(content = buildDisplay(StringBuilder(display)))
                                adapter.notifyItemChanged(idx); scrollToBottom()
                                val deployName = appName; val deployHtml = html
                                binding.rvChat.postDelayed({ saveAndDeploy(deployName, deployHtml) }, 3000)
                            }
                        }
                        is StreamEvent.Status -> {
                            val color = when {
                                event.status.contains("Ready") -> 0xFF3FB950.toInt()
                                event.status.contains("Think") || event.status.contains("Plan") -> 0xFFEAA700.toInt()
                                event.status.contains("Retry") -> 0xFFFF9800.toInt()
                                else -> 0xFF58A6FF.toInt()
                            }
                            updateStatus(event.status, color)
                        }
                        is StreamEvent.Usage -> {
                            totalInputTokens += event.inputTokens
                            totalOutputTokens += event.outputTokens
                            totalCost = ClaudeApiClient.calculateCost(totalInputTokens, totalOutputTokens)
                            updateCostDisplay()
                        }
                        is StreamEvent.Error -> {
                            toolLog.add("✗ Error: ${event.message}")
                            messages[idx] = messages[idx].copy(content = buildDisplay(planText))
                            adapter.notifyItemChanged(idx)
                        }
                        StreamEvent.Done -> {
                            messages[idx] = messages[idx].copy(content = buildDisplay(planText))
                            adapter.notifyItemChanged(idx)
                            conversationHistory.add(ChatMessage(role = "assistant", content = planText.toString()))
                            updateStatus("Ready", 0xFF3FB950.toInt())
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("ClaudeClaw", "Error", e)
                messages[idx] = messages[idx].copy(content = "Error: ${e.message}")
                adapter.notifyItemChanged(idx)
                updateStatus("Ready", 0xFF3FB950.toInt())
            }
        }
    }

    private fun buildDisplay(planText: StringBuilder): String {
        val plan = planText.toString().trim()
        if (toolLog.isEmpty() && plan.isNotEmpty()) return plan
        if (toolLog.isEmpty()) return ""

        val sb = StringBuilder()
        if (plan.isNotEmpty()) {
            sb.append(plan)
            sb.append("\n\n")
        }
        sb.append(toolLog.joinToString("\n"))
        return sb.toString()
    }

    private var activeSkill = ""

    private fun describeToolCall(name: String, input: JSONObject): String {
        val prefix = if (toolLog.isEmpty()) {
            if (activeSkill.isEmpty()) activeSkill = "rapid-prototype"
            "▶ skill:$activeSkill\n"
        } else ""

        val page = input.optString("page", "")
        val title = input.optString("title", "")
        val variant = input.optString("variant", "")
        val connector = if (name == "deploy") "└─" else "├─"

        return prefix + "  $connector tool:$name" + when (name) {
            "design" -> {
                val accent = input.optJSONObject("palette")?.optString("accent", "") ?: ""
                " — $accent dark theme"
            }
            "layout" -> {
                val n = input.optString("name", "")
                val items = input.optJSONArray("nav_items")
                val tabs = if (items != null) (0 until items.length()).map { items.getString(it) }.joinToString(" · ") else ""
                " — $n [$tabs]"
            }
            "compose_form" -> " — $page → $title ($variant)"
            "compose_tracker" -> " — $page → $title ($variant)"
            "compose_interactive" -> " — $page → $title ($variant)"
            "compose_display" -> " — $page → $title"
            "persist" -> " — ${input.optString("strategy", "")}"
            "deploy" -> " — ${input.optString("name", "")}"
            else -> ""
        }
    }

    private fun processToolCall(name: String, input: JSONObject) {
        Log.d("ClaudeClaw", "TOOL: $name input=$input")
        when (name) {
            "design" -> {
                val p = input.optJSONObject("palette") ?: return
                buildConfig.put("accent", p.optString("accent", "#30D158"))
                buildConfig.put("accent2", p.optString("accent2", "#0A84FF"))
            }
            "layout" -> {
                buildConfig.put("name", input.optString("name", "App"))
                val items = input.optJSONArray("nav_items")
                if (items != null) buildConfig.put("tabs", items)
                buildConfig.put("show_date", input.optBoolean("show_date", true))
            }
            "compose_form", "compose_tracker", "compose_interactive", "compose_display" -> {
                val page = input.optString("page", "")
                val sections = buildConfig.optJSONObject("sections") ?: JSONObject()
                val pageArr = sections.optJSONArray(page) ?: org.json.JSONArray()

                val variant = input.optString("variant", "")
                val sectionType = when (name) {
                    "compose_form" -> variant.ifEmpty { "input" }
                    "compose_tracker" -> variant.ifEmpty { "counter" }
                    "compose_interactive" -> variant.ifEmpty { "timer" }
                    "compose_display" -> "summary"
                    else -> variant
                }

                val section = JSONObject().apply {
                    put("type", sectionType)
                    put("title", input.optString("title", ""))
                    put("key", input.optString("key", input.optString("title", "").lowercase().replace(" ", "_")))
                    put("placeholder", input.optString("placeholder", ""))
                    put("button", input.optString("button", ""))
                    val cfg = input.optJSONObject("config")
                    if (cfg != null) {
                        for (k in cfg.keys()) put(k, cfg.get(k))
                    }
                }
                pageArr.put(section)
                sections.put(page, pageArr)
                buildConfig.put("sections", sections)
            }
            "persist" -> { /* handled by AppBuilder defaults */ }
            "deploy" -> {
                if (input.has("name")) buildConfig.put("name", input.getString("name"))
            }
        }
    }

    private fun saveAndDeploy(name: String, html: String) {
        val dir = File(filesDir, "miniapps").also { it.mkdirs() }
        val file = File(dir, name.lowercase().replace(" ", "_").replace(Regex("[^a-z0-9_]"), "") + ".html")
        file.writeText(html)

        runOnUiThread {
            addToHomescreen(name, file.absolutePath)
            binding.rvChat.postDelayed({ launchMiniApp(name, file.absolutePath) }, 3000)
        }
    }

    private fun launchMiniApp(name: String, path: String) {
        startActivity(Intent(this, MiniAppActivity::class.java).apply {
            putExtra("app_name", name); putExtra("file_path", path)
        })
    }

    private fun addToHomescreen(name: String, path: String) {
        try {
            val sm = getSystemService(android.content.pm.ShortcutManager::class.java) ?: return

            val launchIntent = Intent(this, MiniAppActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                putExtra("app_name", name)
                putExtra("file_path", path)
            }

            val sc = android.content.pm.ShortcutInfo.Builder(this,
                name.lowercase().replace(Regex("[^a-z0-9]"), ""))
                .setShortLabel(name)
                .setLongLabel(name)
                .setIcon(android.graphics.drawable.Icon.createWithResource(this, R.mipmap.ic_launcher))
                .setIntent(launchIntent)
                .build()

            sm.addDynamicShortcuts(listOf(sc))

            if (sm.isRequestPinShortcutSupported) {
                sm.requestPinShortcut(sc, null)
            }
        } catch (e: Exception) {
            Log.e("ClaudeClaw", "Shortcut error", e)
        }
    }

    private fun requestNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 100)
            }
        }
    }

    private fun updateStatus(s: String, c: Int) {
        runOnUiThread { binding.tvStatus.text = s; binding.tvStatus.setTextColor(c); (binding.statusDot.background as? GradientDrawable)?.setColor(c) }
    }
    private fun updateCostDisplay() {
        runOnUiThread { binding.tvCost.text = String.format("$ %.4f", totalCost); binding.tvTokens.text = "${totalInputTokens + totalOutputTokens} tk" }
    }
    private fun scrollToBottom() {
        binding.rvChat.postDelayed({
            val n = adapter.itemCount
            if (n > 0) binding.rvChat.scrollToPosition(n - 1)
        }, 50)
    }
    override fun onDestroy() { super.onDestroy(); streamJob?.cancel() }
}
