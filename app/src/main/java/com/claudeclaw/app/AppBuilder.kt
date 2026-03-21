package com.claudeclaw.app

import org.json.JSONObject
import org.json.JSONArray
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Generates complete HTML mini-apps from JSON config.
 * Claude sends small structured config → AppBuilder generates the full HTML locally.
 */
class AppBuilder {

    fun build(config: JSONObject): String {
        val name = config.optString("name", "App")
        val tabs = config.optJSONArray("tabs") ?: JSONArray()
        val sections = config.optJSONObject("sections") ?: JSONObject()
        val accent = config.optString("accent", "#30D158")
        val accent2 = config.optString("accent2", "#0A84FF")

        val sb = StringBuilder()
        sb.append(head(name, accent, accent2))
        sb.append(header(name))
        sb.append(tabBar(tabs))
        sb.append(tabPanels(tabs, sections))
        sb.append(script(tabs, sections))
        sb.append("</div></body></html>")
        return sb.toString()
    }

    private fun head(name: String, accent: String, accent2: String) = """<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>$name</title><style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{width:100%;height:100%;overflow-x:hidden;overscroll-behavior:none}
body{background:#000;color:#fff;font-family:-apple-system,system-ui,sans-serif}
#app{max-width:430px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column}
.hdr{padding:48px 20px 0}.title{font-size:32px;font-weight:700;letter-spacing:-.5px}
.date{font-size:13px;color:#8e8e93;margin-top:4px;text-transform:uppercase;letter-spacing:1px;font-weight:600}
.tabs{display:flex;gap:4px;padding:14px 20px 0;overflow-x:auto}
.tab{flex:1;padding:8px 0;text-align:center;font-size:13px;font-weight:600;border-radius:10px;color:#636366;background:transparent;border:none;cursor:pointer}
.tab.on{background:#1c1c1e;color:#fff}
.panel{display:none;flex:1;padding:16px 20px 32px;overflow-y:auto}.panel.on{display:block}
.card{background:#111;border-radius:14px;padding:16px;margin-bottom:12px}
.card-title{font-size:11px;font-weight:700;letter-spacing:1.5px;color:#8e8e93;margin-bottom:10px;text-transform:uppercase}
input[type=text],textarea{width:100%;background:#1c1c1e;border:1px solid #2c2c2e;border-radius:10px;padding:12px;color:#fff;font-size:15px;outline:none;font-family:inherit}
textarea{min-height:80px;resize:none}
.btn{width:100%;padding:12px;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px}
.btn-g{background:$accent;color:#000}.btn-b{background:$accent2;color:#fff}
.btn-o{background:transparent;border:1px solid #2c2c2e;color:#8e8e93}
.prog{height:6px;background:#1c1c1e;border-radius:3px;margin:10px 0;overflow:hidden}
.prog-fill{height:100%;border-radius:3px;transition:width .3s}
.count{font-size:28px;font-weight:700}.count-label{font-size:14px;color:#8e8e93}
.dots{display:flex;gap:6px;margin:8px 0}.dot{width:28px;height:28px;border-radius:50%;background:#1c1c1e;display:flex;align-items:center;justify-content:center;font-size:14px;transition:background .2s}
.dot.on{background:${accent2}}
.habit{display:flex;align-items:center;padding:14px;background:#111;border-radius:12px;margin-bottom:6px;cursor:pointer}
.habit .ck{width:22px;height:22px;border-radius:50%;border:2px solid #333;margin-right:12px;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.habit.on .ck{background:$accent;border-color:$accent}.habit.on .ck::after{content:'✓';color:#000;font-size:12px;font-weight:700}
.habit span{font-size:15px}.habit.on span{color:#8e8e93;text-decoration:line-through}
.moods{display:flex;justify-content:center;gap:8px;margin:8px 0}
.mood{width:48px;height:48px;border-radius:50%;background:#1c1c1e;border:2px solid transparent;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;transition:all .2s}
.mood.on{border-color:$accent;background:#1a1a2e}
.timer-display{text-align:center;padding:20px 0}.timer-time{font-size:64px;font-weight:200;font-variant-numeric:tabular-nums}
.timer-label{font-size:13px;color:#8e8e93;margin-top:4px}
.timer-btns{display:flex;gap:8px;justify-content:center;margin-top:16px}
.timer-btns .btn{width:auto;padding:10px 24px}
.summary{font-size:14px;color:#8e8e93;line-height:1.6}
.entry{background:#111;border-radius:10px;padding:12px;margin-top:8px;font-size:14px}
.row{display:flex;align-items:center;justify-content:space-between}
</style></head><body><div id="app">
"""

    private fun header(name: String): String {
        val today = LocalDate.now()
        val fmt = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.ENGLISH)
        return """<div class="hdr"><div class="date">${today.format(fmt).uppercase()}</div>
<div class="title">$name</div></div>
"""
    }

    private fun tabBar(tabs: JSONArray): String {
        val sb = StringBuilder("<div class=\"tabs\">")
        for (i in 0 until tabs.length()) {
            val t = tabs.getString(i)
            val on = if (i == 0) " on" else ""
            sb.append("<button class=\"tab$on\" onclick=\"switchTab($i)\">$t</button>")
        }
        sb.append("</div>")
        return sb.toString()
    }

    private fun tabPanels(tabs: JSONArray, sections: JSONObject): String {
        val sb = StringBuilder()
        for (i in 0 until tabs.length()) {
            val tabName = tabs.getString(i)
            val on = if (i == 0) " on" else ""
            sb.append("<div class=\"panel$on\" id=\"p$i\">")
            val secs = sections.optJSONArray(tabName)
            if (secs != null) {
                for (j in 0 until secs.length()) {
                    sb.append(renderSection(secs.getJSONObject(j)))
                }
            }
            sb.append("</div>")
        }
        return sb.toString()
    }

    private fun renderSection(sec: JSONObject): String {
        return when (sec.optString("type")) {
            "input" -> {
                val title = sec.optString("title", "INPUT")
                val ph = sec.optString("placeholder", "")
                val btn = sec.optString("button", "Submit")
                val key = sec.optString("key", title.lowercase().replace(" ", "_"))
                """<div class="card"><div class="card-title">✦ $title</div>
<div id="${key}_show" style="display:none"><div style="background:#0a1a0a;border-radius:10px;padding:12px;color:#30D158;font-size:16px" id="${key}_val"></div>
<div style="font-size:12px;color:#636366;margin-top:6px;cursor:pointer" onclick="editField('$key')">✎ Edit</div></div>
<div id="${key}_edit"><input type="text" id="${key}_inp" placeholder="$ph">
<button class="btn btn-g" onclick="saveField('$key')">$btn</button></div></div>
"""
            }
            "counter" -> {
                val title = sec.optString("title", "COUNTER")
                val max = sec.optInt("max", 8)
                val unit = sec.optString("unit", "items")
                val key = sec.optString("key", title.lowercase().replace(" ", "_"))
                val dots = (0 until max).joinToString("") { "<div class=\"dot\" id=\"${key}_d$it\">💧</div>" }
                """<div class="card"><div class="card-title">💧 $title</div>
<div class="row"><div><span class="count" id="${key}_n">0</span><span class="count-label"> / $max $unit</span></div>
<button class="btn btn-b" style="width:auto;padding:8px 16px" onclick="addCount('$key',$max)" id="${key}_btn">Add Glass</button></div>
<div class="dots" id="${key}_dots">$dots</div>
<div class="prog"><div class="prog-fill" id="${key}_bar" style="width:0%;background:#0A84FF"></div></div>
<button class="btn btn-o" onclick="resetCount('$key',$max)" style="margin-top:4px">Reset</button></div>
"""
            }
            "summary" -> {
                val title = sec.optString("title", "SUMMARY")
                """<div class="card"><div class="card-title">📊 $title</div>
<div class="summary" id="summary_box">Complete your daily activities to see your summary here.</div></div>
"""
            }
            "toggles" -> {
                val items = sec.optJSONArray("items") ?: JSONArray()
                val sb = StringBuilder()
                sb.append("""<div class="card"><div class="row"><div class="card-title" style="margin:0">Daily Habits</div>
<div style="font-size:14px"><span id="hab_n">0</span> of ${items.length()} complete</div></div>
<div class="prog"><div class="prog-fill" id="hab_bar" style="width:0%;background:#30D158"></div></div></div>""")
                for (i in 0 until items.length()) {
                    sb.append("""<div class="habit" onclick="toggleHabit($i)"><div class="ck"></div><span>${items.getString(i)}</span></div>""")
                }
                sb.toString()
            }
            "mood" -> {
                val emojis = sec.optJSONArray("emojis") ?: JSONArray()
                val sb = StringBuilder("""<div class="card"><div class="card-title">🎭 Mood</div><div class="moods">""")
                for (i in 0 until emojis.length()) {
                    sb.append("""<div class="mood" onclick="pickMood($i)">${emojis.getString(i)}</div>""")
                }
                sb.append("</div><div id=\"mood_label\" style=\"text-align:center;color:#636366;font-size:13px;margin-top:6px\">How are you feeling?</div></div>")
                sb.toString()
            }
            "textarea" -> {
                val ph = sec.optString("placeholder", "What are you grateful for?")
                val btn = sec.optString("button", "Save Entry")
                """<div class="card"><div class="card-title">✨ Gratitude</div>
<textarea id="journal_txt" placeholder="$ph"></textarea>
<button class="btn btn-g" onclick="saveJournal()">$btn</button></div>
<div id="journal_entries"></div>
"""
            }
            "timer" -> {
                """<div class="card">
<div class="card-title">⏱ POMODORO TIMER</div>
<div class="timer-display">
<div class="timer-time" id="tm_time">25:00</div></div>
<div class="timer-btns">
<button class="btn btn-g" id="tm_btn" onclick="tmToggle()">Start</button>
<button class="btn btn-o" onclick="tmPause()">Pause</button>
<button class="btn btn-o" onclick="tmReset()">Reset</button></div>
<div style="display:flex;gap:8px;margin-top:12px;justify-content:center">
<button class="btn btn-o" style="width:auto;padding:8px 16px;font-size:13px" onclick="tmSet(15)">15m</button>
<button class="btn btn-o" style="width:auto;padding:8px 16px;font-size:13px;border-color:#FF9F0A;color:#FF9F0A" onclick="tmSet(25)">25m</button>
<button class="btn btn-o" style="width:auto;padding:8px 16px;font-size:13px" onclick="tmSet(45)">45m</button>
<button class="btn btn-o" style="width:auto;padding:8px 16px;font-size:13px" onclick="tmSet(60)">60m</button></div></div>
<div class="card"><div style="display:flex;flex-direction:column;gap:8px">
<div class="row"><span style="color:#8e8e93">Sessions today</span><span style="font-weight:700;color:#FF9F0A" id="tm_sessions">0</span></div>
<div class="row"><span style="color:#8e8e93">Total focus time</span><span style="font-weight:700;color:#FF9F0A" id="tm_mins">0 min</span></div></div></div>
"""
            }
            else -> ""
        }
    }

    private fun script(tabs: JSONArray, sections: JSONObject): String {
        val tabCount = tabs.length()
        val habitCount = sections.optJSONArray("Habits")?.let { arr ->
            for (i in 0 until arr.length()) {
                val s = arr.getJSONObject(i)
                if (s.optString("type") == "toggles") {
                    return@let s.optJSONArray("items")?.length() ?: 0
                }
            }
            0
        } ?: 0

        val timerSec = sections.optJSONArray("Focus")?.let { arr ->
            for (i in 0 until arr.length()) {
                val s = arr.getJSONObject(i)
                if (s.optString("type") == "timer") return@let s
            }
            null
        }
        val workMin = timerSec?.optInt("work", 25) ?: 25
        val brkMin = timerSec?.optInt("break", 5) ?: 5
        val maxSessions = timerSec?.optInt("sessions", 4) ?: 4

        return """<script>
const D=()=>new Date().toISOString().slice(0,10);
const K=(k)=>'df_'+D()+'_'+k;
const G=(k)=>localStorage.getItem(K(k));
const S=(k,v)=>localStorage.setItem(K(k),v);
function switchTab(i){document.querySelectorAll('.tab').forEach((t,j)=>{t.classList.toggle('on',j===i)});
document.querySelectorAll('.panel').forEach((p,j)=>{p.classList.toggle('on',j===i)});updateSummary()}
function saveField(k){const v=document.getElementById(k+'_inp').value.trim();if(!v)return;
S(k,v);document.getElementById(k+'_val').textContent=v;
document.getElementById(k+'_show').style.display='block';document.getElementById(k+'_edit').style.display='none';updateSummary()}
function editField(k){document.getElementById(k+'_show').style.display='none';document.getElementById(k+'_edit').style.display='block'}
function addCount(k,mx){let n=parseInt(G(k)||'0');if(n>=mx)return;n++;S(k,n);updCount(k,mx,n)}
function resetCount(k,mx){S(k,0);updCount(k,mx,0)}
function updCount(k,mx,n){document.getElementById(k+'_n').textContent=n;
document.getElementById(k+'_bar').style.width=(n/mx*100)+'%';
for(let i=0;i<mx;i++)document.getElementById(k+'_d'+i).classList.toggle('on',i<n);
document.getElementById(k+'_btn').textContent='Add Glass';updateSummary()}
let habits=Array($habitCount).fill(false);
function toggleHabit(i){habits[i]=!habits[i];S('habits',JSON.stringify(habits));renderHabits()}
function renderHabits(){const els=document.querySelectorAll('.habit');const n=habits.filter(Boolean).length;
els.forEach((el,i)=>{el.classList.toggle('on',habits[i])});
document.getElementById('hab_n').textContent=n;
document.getElementById('hab_bar').style.width=(n/$habitCount*100)+'%';updateSummary()}
let selMood=-1;
function pickMood(i){selMood=i;S('mood',i);document.querySelectorAll('.mood').forEach((m,j)=>m.classList.toggle('on',j===i));
const labels=['Rough','Meh','Okay','Good','Amazing'];
document.getElementById('mood_label').textContent='Feeling '+labels[i];updateSummary()}
function saveJournal(){const t=document.getElementById('journal_txt').value.trim();if(!t)return;
S('journal',t);document.getElementById('journal_txt').value='';
const d=document.createElement('div');d.className='entry';d.textContent=t;
document.getElementById('journal_entries').prepend(d);updateSummary()}
let tmSec=25*60,tmRun=false,tmIv=null,tmDur=25;
function tmSet(m){clearInterval(tmIv);tmRun=false;tmDur=m;tmSec=m*60;document.getElementById('tm_btn').textContent='Start';updTm()}
function tmToggle(){if(tmRun)return;tmRun=true;document.getElementById('tm_btn').textContent='Running...';
tmIv=setInterval(()=>{tmSec--;if(tmSec<=0){clearInterval(tmIv);tmRun=false;
let s=parseInt(G('tm_s')||'0')+1;S('tm_s',s);let m=parseInt(G('tm_m')||'0')+tmDur;S('tm_m',m);
document.getElementById('tm_sessions').textContent=s;document.getElementById('tm_mins').textContent=m+' min';
document.getElementById('tm_btn').textContent='Start';tmSec=tmDur*60}updTm()},1000)}
function tmPause(){clearInterval(tmIv);tmRun=false;document.getElementById('tm_btn').textContent='Start'}
function tmReset(){clearInterval(tmIv);tmRun=false;tmSec=tmDur*60;document.getElementById('tm_btn').textContent='Start';updTm()}
function updTm(){const m=Math.floor(tmSec/60),s=tmSec%60;
document.getElementById('tm_time').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
function updateSummary(){const el=document.getElementById('summary_box');if(!el)return;
const parts=[];const intention=G('intention');if(intention)parts.push('🎯 Focus: '+intention);
const h=parseInt(G('hydration')||'0');parts.push('💧 Hydration: '+h+'/8 glasses');
const hc=habits.filter(Boolean).length;parts.push('✅ Habits: '+hc+'/$habitCount complete');
const mood=G('mood');if(mood!=null){const l=['😔','😐','🙂','😊','🤩'];parts.push('🎭 Mood: '+l[parseInt(mood)])}
const j=G('journal');if(j)parts.push('✨ Grateful: '+j.substring(0,50));
el.innerHTML=parts.join('<br>')}
(function init(){try{
// Restore inputs
document.querySelectorAll('[id$="_inp"]').forEach(function(el){
  var k=el.id.replace('_inp','');var v=G(k);if(v){el.value='';
  var show=document.getElementById(k+'_show');var edit=document.getElementById(k+'_edit');
  var val2=document.getElementById(k+'_val');
  if(show&&edit&&val2){val2.textContent=v;show.style.display='block';edit.style.display='none'}}});
// Restore counters
document.querySelectorAll('[id$="_n"]').forEach(function(el){
  var k=el.id.replace('_n','');var v=parseInt(G(k)||'0');
  var btn=document.getElementById(k+'_btn');
  if(btn){var mx=8;var m=btn.getAttribute('onclick');if(m){var p=m.match(/,(\d+)/);if(p)mx=parseInt(p[1])}
  updCount(k,mx,v)}});
// Restore habits
var hb=G('habits');if(hb)try{habits=JSON.parse(hb)}catch(e){}
if(typeof renderHabits==='function')renderHabits();
// Restore mood
var m2=G('mood');if(m2!=null&&typeof pickMood==='function')pickMood(parseInt(m2));
// Restore journal
var je=document.getElementById('journal_entries');var jv=G('journal');
if(je&&jv){var d=document.createElement('div');d.className='entry';d.textContent=jv;je.prepend(d)}
// Restore timer stats
var tse=document.getElementById('tm_sessions');if(tse){var ts=G('tm_s');if(ts)tse.textContent=ts}
var tme=document.getElementById('tm_mins');if(tme){var tm=G('tm_m');if(tm)tme.textContent=tm+' min'}
if(typeof updateSummary==='function')updateSummary();
}catch(e){console.error('init error',e)}})();
</script>
"""
    }
}
