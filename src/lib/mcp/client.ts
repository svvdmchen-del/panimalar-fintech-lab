import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Minimal Model Context Protocol client (JSON-RPC 2.0 over stdio).
 *
 * The dashboard talks to an MCP server the same way an AI agent would:
 *   initialize -> notifications/initialized -> tools/list -> tools/call
 *
 * It is implemented by hand instead of pulling in the SDK because route
 * handlers only need three RPC methods, and avoiding the extra dependency
 * keeps the Next.js server bundle simple and the lab install small.
 */

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

type Pending = {
  resolve: (value: JsonRpcMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const DEFAULT_SERVER = path.join(
  "node_modules",
  "india-stock-mcp",
  "dist",
  "index.js",
);

export class McpStdioClient {
  readonly serverPath: string;
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private bootPromise: Promise<void> | null = null;
  private stderrTail = "";
  private tools = new Map<string, ToolInfo>();
  private lastError: string | null = null;
  private toolCalls = 0;
  private lastToolCallAt: string | null = null;

  constructor(serverPath?: string) {
    this.serverPath = serverPath ?? process.env.NSE_MCP_SERVER ?? path.resolve(process.cwd(), DEFAULT_SERVER);
  }

  isRunning(): boolean {
    return this.child !== null && !this.child.killed;
  }

  peek() {
    return {
      connected: this.isRunning(),
      tools: [...this.tools.keys()],
      server: this.serverPath,
      pid: this.child?.pid,
      toolCalls: this.toolCalls,
      lastToolCallAt: this.lastToolCallAt,
      error: this.lastError ?? undefined,
    };
  }

  async listTools(): Promise<ToolInfo[]> {
    await this.boot();
    return [...this.tools.values()];
  }

  async callTool<T = unknown>(name: string, args: Record<string, unknown> = {}, timeoutMs = 25_000): Promise<T> {
    await this.boot();
    if (!this.tools.has(name)) {
      throw new Error(
        `MCP tool "${name}" is not exposed by ${path.basename(this.serverPath)} (available: ${[...this.tools.keys()].join(", ")})`,
      );
    }
    const response = await this.request("tools/call", { name, arguments: args }, timeoutMs);
    const result = response.result as
      | { content?: { type: string; text?: string }[]; structuredContent?: unknown; isError?: boolean }
      | undefined;

    const text = (result?.content ?? [])
      .map((chunk) => (chunk.type === "text" ? (chunk.text ?? "") : ""))
      .join("")
      .trim();

    if (result?.isError) throw new Error(text || `MCP tool "${name}" reported an error`);
    if (!text) {
      if (result?.structuredContent !== undefined) return result.structuredContent as T;
      throw new Error(`MCP tool "${name}" returned no content`);
    }

    // Tool payloads in this server are JSON encoded in a text content block.
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        return JSON.parse(text) as T;
      } catch {
        /* fall through to the plain-text path */
      }
    }
    if (/^error[:\s]/i.test(text)) throw new Error(text);
    return text as unknown as T;
  }

  async close() {
    const child = this.child;
    this.child = null;
    this.bootPromise = null;
    this.tools.clear();
    this.rejectAll(new Error("MCP client closed"));
    if (child && !child.killed) child.kill();
  }

  private async boot(): Promise<void> {
    if (this.isRunning() && this.bootPromise) return this.bootPromise;
    if (!existsSync(this.serverPath)) {
      throw new Error(
        `MCP server not found at ${this.serverPath}. Run "npm install india-stock-mcp" or set NSE_MCP_SERVER.`,
      );
    }
    this.bootPromise = this.start().catch((error: unknown) => {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.bootPromise = null;
      this.child = null;
      throw error;
    });
    return this.bootPromise;
  }

  private async start(): Promise<void> {
    this.lastError = null;
    this.stderrTail = "";
    this.buffer = "";

    const child = spawn(process.execPath, [this.serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
      windowsHide: true,
    }) as ChildProcessWithoutNullStreams;

    this.child = child;

    child.stdin.on("error", (error: Error) => {
      this.lastError = `MCP stdin error: ${error.message}`;
    });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.onData(chunk));

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-4000);
    });

    child.on("exit", (code) => {
      const wasRunning = this.child === child;
      if (this.child === child) {
        this.child = null;
        this.bootPromise = null;
        this.tools.clear();
      }
      if (wasRunning) {
        this.lastError = `MCP server exited (code ${code}). ${this.stderrTail.slice(-400)}`.trim();
        this.rejectAll(new Error(this.lastError));
      }
    });

    child.on("error", (error) => {
      this.lastError = `MCP spawn failed: ${error.message}`;
    });

    await this.request(
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "panimalar-fintech-lab-terminal", version: "1.0.0" },
      },
      30_000,
    );

    this.notify("notifications/initialized", {});

    const listed = await this.request("tools/list", {}, 15_000);
    const tools = (listed.result as { tools?: ToolInfo[] } | undefined)?.tools ?? [];
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    let index = this.buffer.indexOf("\n");
    while (index !== -1) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (line) {
        try {
          this.dispatch(JSON.parse(line) as JsonRpcMessage);
        } catch {
          // Ignore non JSON-RPC chatter on stdout.
        }
      }
      index = this.buffer.indexOf("\n");
    }
  }

  private dispatch(message: JsonRpcMessage) {
    if (message.id === undefined) return; // server initiated notification
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) {
      pending.reject(new Error(message.error.message));
    } else {
      pending.resolve(message);
    }
  }

  private request(method: string, params: unknown, timeoutMs: number): Promise<JsonRpcMessage> {
    const child = this.child;
    if (!child || !child.stdin.writable) return Promise.reject(new Error("MCP server is not running"));

    const id = this.nextId++;
    return new Promise<JsonRpcMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      try {
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`, (error) => {
          if (error) {
            this.pending.delete(id);
            clearTimeout(timer);
            reject(error);
          }
        });
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }

      if (method === "tools/call") {
        this.toolCalls += 1;
        this.lastToolCallAt = new Date().toISOString();
      }
    });
  }

  private notify(method: string, params: unknown) {
    if (!this.child?.stdin?.writable) return;
    try {
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    } catch {
      // Ignore write errors for fire-and-forget notifications
    }
  }

  private rejectAll(error: Error) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}

const globalForMcp = globalThis as unknown as { __nseMcpClient?: McpStdioClient };

/** Process-wide singleton so hot reloads do not leak MCP child processes. */
export function mcpClient(): McpStdioClient {
  if (!globalForMcp.__nseMcpClient) {
    globalForMcp.__nseMcpClient = new McpStdioClient();
  }
  return globalForMcp.__nseMcpClient;
}

export const MCP_ENABLED = process.env.NSE_MCP_DISABLED !== "1";
