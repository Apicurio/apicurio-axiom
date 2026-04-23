const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Logging helper — writes to stderr so it doesn't interfere with MCP stdio protocol
function log(level, message, data) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        source: "axiom-mcp-server",
        message,
        ...data
    };
    process.stderr.write(JSON.stringify(entry) + "\n");
}

// Load tool definitions from the JSON file passed as first argument
const toolsFile = process.argv[2];
if (!toolsFile) {
    log("ERROR", "Usage: node server.js <tools.json>");
    process.exit(1);
}
const TOOLS = JSON.parse(fs.readFileSync(toolsFile, "utf-8"));
log("INFO", "Axiom MCP server started", { toolCount: TOOLS.length, toolsFile });

const server = new Server({ name: "axiom-tools", version: "1.0.0" }, {
    capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(t => ({
        name: t.name,
        description: t.description || "",
        inputSchema: {
            type: "object",
            properties: Object.fromEntries(
                (t.parameters || []).map(p => [p.name, {
                    type: p.type || "string",
                    description: p.description || ""
                }])
            ),
            required: (t.parameters || []).filter(p => p.required).map(p => p.name)
        }
    }))
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments || {};
    const tool = TOOLS.find(t => t.name === toolName);
    if (!tool) {
        log("WARN", "Unknown tool called", { toolName });
        return { content: [{ type: "text", text: "Unknown tool: " + toolName }], isError: true };
    }

    log("INFO", "Tool called", { toolName, args: Object.keys(args) });

    try {
        let cmd = tool.scriptTemplate;
        // Substitute parameters
        for (const [key, value] of Object.entries(args)) {
            // For string values that might contain special chars, write to temp file
            const fileKey = "{{" + key + "_file}}";
            if (cmd.includes(fileKey)) {
                const tmpFile = path.join(os.tmpdir(), `axiom-tool-${toolName}-${key}-${Date.now()}.txt`);
                fs.writeFileSync(tmpFile, String(value));
                cmd = cmd.replaceAll(fileKey, tmpFile);
            }
            cmd = cmd.replaceAll("{{" + key + "}}", String(value));
        }

        // Write the resolved script to a temp file and execute it with bash.
        // This supports multi-line command templates (sequential commands,
        // pipes, conditionals, loops, etc.) without shell quoting issues.
        const scriptFile = path.join(os.tmpdir(),
                `axiom-tool-${toolName}-${Date.now()}.sh`);
        fs.writeFileSync(scriptFile, cmd);
        log("DEBUG", "Executing script", { toolName, scriptFile, command: cmd });

        const startTime = Date.now();
        let result;
        try {
            result = execSync(`bash "${scriptFile}"`, {
                encoding: "utf-8",
                timeout: 30000,
                env: { ...process.env }
            });
        } finally {
            try { fs.unlinkSync(scriptFile); } catch (_) {}
        }
        const durationMs = Date.now() - startTime;

        log("INFO", "Tool completed", {
            toolName,
            durationMs,
            outputLength: (result || "").length
        });
        return { content: [{ type: "text", text: result || "Command completed successfully" }] };
    } catch (error) {
        const msg = error.stderr || error.stdout || error.message || "Command failed";
        log("ERROR", "Tool execution failed", {
            toolName,
            exitCode: error.status,
            error: msg.substring(0, 500)
        });
        return { content: [{ type: "text", text: msg }], isError: true };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch(console.error);
