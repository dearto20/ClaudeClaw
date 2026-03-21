package com.claudeclaw.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import java.io.File

class MiniAppActivity : AppCompatActivity() {

    lateinit var webView: WebView
    private var appName = "Mini App"
    private val NOTIF_ID = 1001
    private val CHANNEL_ID = "miniapp_running"

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
        appName = intent.getStringExtra("app_name") ?: "Mini App"
        title = appName

        if (filePath != null) {
            val file = File(filePath)
            if (file.exists() && file.canRead()) {
                val html = file.readText()
                val baseUrl = "https://claudeclaw.local/${appName.lowercase().replace(" ", "_")}/"
                webView.loadDataWithBaseURL(baseUrl, html, "text/html", "UTF-8", null)
            } else {
                webView.loadUrl("file://${file.absolutePath}")
            }
        }

        showNotification(filePath)
    }

    private fun showNotification(filePath: String?) {
        val nm = getSystemService(NotificationManager::class.java)

        // Create channel
        val channel = NotificationChannel(CHANNEL_ID, "Running Apps", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Shows when a mini-app is running"
            setShowBadge(false)
        }
        nm.createNotificationChannel(channel)

        // Tap to return to this activity
        val tapIntent = Intent(this, MiniAppActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            putExtra("app_name", appName)
            putExtra("file_path", filePath)
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(appName)
            .setContentText("Running — tap to return")
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setSilent(true)
            .build()

        nm.notify(NOTIF_ID, notification)
    }

    override fun onDestroy() {
        super.onDestroy()
        getSystemService(NotificationManager::class.java).cancel(NOTIF_ID)
    }
}
