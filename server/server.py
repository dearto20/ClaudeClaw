#!/usr/bin/env python3
"""ClaudeClaw Backend Server - Agentic coding assistant with tool execution."""

import json
import os
import subprocess
import glob as glob_module
import time
from pathlib import Path
from flask import Flask, request, Response, stream_with_context
from flask_cors import CORS
import anthropic

app = Flask(__name__)
CORS(app)

WORK_DIR = os.path.expanduser("~/Projects/Free")
ANDROID_HOME = os.path.expanduser("~/Library/Android/sdk")

# Tool definitions for Claude
TOOLS = [
    {
        "name": "bash",
        "description": "Execute a shell command and return stdout/stderr. Use for: running builds, installing packages, git commands, adb commands, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to execute"
                },
                "working_dir": {
                    "type": "string",
                    "description": "Working directory (default: ~/Projects/Free)"
                }
            },
            "required": ["command"]
        }
    },
    {
        "name": "write_file",
        "description": "Create or overwrite a file with the given content. Creates parent directories automatically.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Absolute file path to write"
                },
                "content": {
                    "type": "string",
                    "description": "Content to write to the file"
                }
            },
            "required": ["path", "content"]
        }
    },
    {
        "name": "read_file",
        "description": "Read the contents of a file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Absolute file path to read"
                }
            },
            "required": ["path"]
        }
    },
    {
        "name": "list_files",
        "description": "List files in a directory, optionally matching a glob pattern.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Directory path to list"
                },
                "pattern": {
                    "type": "string",
                    "description": "Optional glob pattern (e.g., '**/*.kt')"
                }
            },
            "required": ["path"]
        }
    },
    {
        "name": "deploy_apk",
        "description": "Install an APK on the connected Android emulator and optionally launch it.",
        "input_schema": {
            "type": "object",
            "properties": {
                "apk_path": {
                    "type": "string",
                    "description": "Path to the APK file"
                },
                "package_name": {
                    "type": "string",
                    "description": "Package name (e.g., com.example.app)"
                },
                "activity": {
                    "type": "string",
                    "description": "Activity to launch (e.g., .MainActivity)"
                }
            },
            "required": ["apk_path", "package_name"]
        }
    }
]

SYSTEM_PROMPT = """You are ClaudeClaw, an AI coding assistant running on an Android device connected to a development server.

You can create, build, and deploy Android apps using your tools. You have access to:
- bash: Run shell commands (gradle builds, git, adb, etc.)
- write_file: Create/write files
- read_file: Read files
- list_files: List directory contents
- deploy_apk: Install and launch APKs on the emulator

Environment:
- Working directory: ~/Projects/Free
- Android SDK: ~/Library/Android/sdk
- Java 17, Gradle 8.4 available
- Android emulator is running (Pixel_6_API_34)
- Kotlin for Android development

When building Android apps:
1. Create project structure with Gradle files, Kotlin sources, layouts, etc.
2. Build with: cd <project> && ./gradlew assembleDebug
3. Deploy with deploy_apk tool
4. Use the Gradle wrapper from ~/Projects/Free/ClaudeClaw/ if needed

Be concise in your responses. Show progress as you work. Use dark themes by default."""


def execute_tool(name, input_data):
    """Execute a tool and return the result."""
    try:
        if name == "bash":
            cwd = input_data.get("working_dir", WORK_DIR)
            env = os.environ.copy()
            env["ANDROID_HOME"] = ANDROID_HOME
            env["ANDROID_SDK_ROOT"] = ANDROID_HOME
            env["PATH"] = f"{ANDROID_HOME}/platform-tools:{ANDROID_HOME}/tools:{env.get('PATH', '')}"

            result = subprocess.run(
                input_data["command"],
                shell=True,
                capture_output=True,
                text=True,
                cwd=cwd,
                timeout=300,
                env=env
            )
            output = result.stdout
            if result.stderr:
                output += f"\nSTDERR:\n{result.stderr}"
            if result.returncode != 0:
                output += f"\n[Exit code: {result.returncode}]"
            return output[:10000] or "(no output)"

        elif name == "write_file":
            path = os.path.expanduser(input_data["path"])
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                f.write(input_data["content"])
            return f"File written: {path}"

        elif name == "read_file":
            path = os.path.expanduser(input_data["path"])
            with open(path, "r") as f:
                content = f.read()
            return content[:10000]

        elif name == "list_files":
            path = os.path.expanduser(input_data["path"])
            pattern = input_data.get("pattern")
            if pattern:
                files = glob_module.glob(os.path.join(path, pattern), recursive=True)
            else:
                files = os.listdir(path)
            return "\n".join(sorted(str(f) for f in files[:100]))

        elif name == "deploy_apk":
            adb = os.path.join(ANDROID_HOME, "platform-tools", "adb")
            apk_path = os.path.expanduser(input_data["apk_path"])
            pkg = input_data["package_name"]
            activity = input_data.get("activity", ".MainActivity")

            # Install
            result = subprocess.run(
                [adb, "install", "-r", apk_path],
                capture_output=True, text=True, timeout=60
            )
            output = result.stdout + result.stderr

            # Launch
            launch_result = subprocess.run(
                [adb, "shell", "am", "start", "-n", f"{pkg}/{pkg}{activity}"],
                capture_output=True, text=True, timeout=10
            )
            output += "\n" + launch_result.stdout + launch_result.stderr
            return output

        else:
            return f"Unknown tool: {name}"

    except subprocess.TimeoutExpired:
        return "Error: Command timed out (300s limit)"
    except Exception as e:
        return f"Error: {str(e)}"


@app.route("/chat", methods=["POST"])
def chat():
    """Handle chat request with streaming + tool execution loop."""
    data = request.json
    api_key = data.get("api_key", "")
    messages = data.get("messages", [])
    model = data.get("model", "claude-opus-4-6")

    if not api_key:
        return {"error": "No API key provided"}, 400

    client = anthropic.Anthropic(api_key=api_key)

    def generate():
        nonlocal messages
        total_input = 0
        total_output = 0

        while True:
            # Send status
            yield f"data: {json.dumps({'type': 'status', 'status': 'Thinking...'})}\n\n"

            # Call Claude with tools
            try:
                response = client.messages.create(
                    model=model,
                    max_tokens=8192,
                    system=SYSTEM_PROMPT,
                    tools=TOOLS,
                    messages=messages
                )
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

            # Track usage
            if response.usage:
                total_input += response.usage.input_tokens
                total_output += response.usage.output_tokens
                yield f"data: {json.dumps({'type': 'usage', 'input_tokens': total_input, 'output_tokens': total_output})}\n\n"

            # Process response content blocks
            tool_results = []
            has_tool_use = False

            for block in response.content:
                if block.type == "text":
                    yield f"data: {json.dumps({'type': 'text', 'text': block.text})}\n\n"

                elif block.type == "tool_use":
                    has_tool_use = True
                    tool_name = block.name
                    tool_input = block.input
                    tool_id = block.id

                    # Notify client about tool execution
                    yield f"data: {json.dumps({'type': 'status', 'status': 'Working...'})}\n\n"

                    # Truncate display of file content
                    display_input = dict(tool_input)
                    if "content" in display_input and len(display_input["content"]) > 200:
                        display_input["content"] = display_input["content"][:200] + "..."

                    yield f"data: {json.dumps({'type': 'tool_start', 'name': tool_name, 'input': display_input})}\n\n"

                    # Execute the tool
                    result = execute_tool(tool_name, tool_input)

                    # Truncate display of result
                    display_result = result[:500] + "..." if len(result) > 500 else result
                    yield f"data: {json.dumps({'type': 'tool_result', 'name': tool_name, 'result': display_result})}\n\n"

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": result
                    })

            # If there were tool uses, continue the loop
            if has_tool_use:
                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})
                continue
            else:
                # No more tool calls, we're done
                yield f"data: {json.dumps({'type': 'status', 'status': 'Ready'})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok", "version": "1.0"}


if __name__ == "__main__":
    print("🐾 ClaudeClaw Server starting on http://0.0.0.0:8765")
    app.run(host="0.0.0.0", port=8765, debug=False, threaded=True)
