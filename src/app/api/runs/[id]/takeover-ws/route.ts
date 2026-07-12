import { NextResponse } from "next/server";
import { WebSocketServer, WebSocket } from "ws";
import { redis } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess, isAuthError } from "@/lib/auth-helpers";

let wss: WebSocketServer | null = null;

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;

    // 1. Check if WebSocket Upgrade header is present
    const upgrade = req.headers.get("upgrade");
    if (upgrade !== "websocket") {
      return NextResponse.json({ error: "Expected WebSocket Upgrade" }, { status: 400 });
    }

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    // 2. Resolve takeover WS endpoint from Redis
    const wsEndpoint = await redis.get(`takeover:${token}`);
    if (!wsEndpoint) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
    }

    // 3. Verify workspace authorization for this run
    const run = await prisma.workflowRun.findUnique({
      where: { id },
      include: {
        version: {
          include: {
            workflow: true,
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const workspaceId = run.version.workflow.workspaceId;
    const access = await requireWorkspaceAccess(workspaceId);
    if (isAuthError(access)) return access;

    // Log the audit event for takeover
    console.log(`[Audit] HITL_TAKEOVER_START by user ${access.auth.dbUserId} on run ${id}`);

    // 4. Manually upgrade connection using raw node socket
    const socket = (req as any).socket || ((req as any).rawHeaders ? (req as any).connection : null);
    if (!socket) {
      return NextResponse.json({ error: "Socket connection not accessible" }, { status: 500 });
    }

    if (!wss) {
      wss = new WebSocketServer({ noServer: true });
    }

    wss.handleUpgrade(req as any, socket, Buffer.alloc(0), (ws) => {
      // Connect to the Playwright BrowserServer CDP endpoint
      const cdp = new WebSocket(wsEndpoint);

      cdp.on("open", () => {
        ws.on("message", (msg) => cdp.send(msg));
        cdp.on("message", (msg) => ws.send(msg));
      });

      ws.on("close", () => {
        cdp.close();
        console.log(`[Audit] HITL_TAKEOVER_END by user ${access.auth.dbUserId} on run ${id}`);
      });
      cdp.on("close", () => ws.close());

      ws.on("error", () => cdp.close());
      cdp.on("error", () => ws.close());
    });

    return new Response(null, { status: 101 });
  } catch (error: any) {
    console.error("Takeover WS proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
