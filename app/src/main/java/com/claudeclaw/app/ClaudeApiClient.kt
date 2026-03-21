package com.claudeclaw.app

import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Thin HTTP client for the Claude Messages API. No agent logic — just sends
 * requests and returns raw streaming responses.
 */
class ClaudeApiClient(private var apiKey: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(300, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    fun updateApiKey(key: String) { apiKey = key }

    fun call(body: JSONObject): Response? {
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
