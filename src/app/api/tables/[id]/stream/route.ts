import { currentUser } from "@/lib/api";
import { subscribe } from "@/lib/events";
import { getTable, toPublicTable } from "@/lib/table-engine";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await context.params;
  const table = getTable(id);
  if (!table) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const clientId = crypto.randomUUID();
  let cleanup: () => void = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      cleanup = subscribe(table.id, clientId, user.id, send);
      send(toPublicTable(table, user.id));
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`:hb\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);
      const abort = () => {
        clearInterval(heartbeat);
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", abort);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
