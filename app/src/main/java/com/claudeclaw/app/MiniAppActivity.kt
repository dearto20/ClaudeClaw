package com.claudeclaw.app

import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import java.io.File

class MiniAppActivity : AppCompatActivity() {

    lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            setBackgroundColor(0xFF000000.toInt())
        }

        setContentView(webView)

        val filePath = intent.getStringExtra("file_path")
        val appName = intent.getStringExtra("app_name") ?: "Mini App"
        title = appName

        if (filePath != null) {
            val file = File(filePath)
            if (file.exists() && file.canRead()) {
                val html = file.readText()
                // Use a consistent base URL so localStorage persists per app
                val baseUrl = "https://claudeclaw.local/${appName.lowercase().replace(" ", "_")}/"
                webView.loadDataWithBaseURL(baseUrl, html, "text/html", "UTF-8", null)
            } else {
                // Fallback: try file URL directly
                webView.loadUrl("file://${file.absolutePath}")
            }
        }
    }
}
