/// <reference types="@fastly/js-compute" />

import { env } from "fastly:env";
import { createFanoutHandoff } from "fastly:fanout";

const X_GU_PROTOCOL = "x-gu-protocol";

// Use this fetch event listener to define your main request handling logic.
addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event: FetchEvent) {
  // Log service version
  console.log(
    "FASTLY_SERVICE_VERSION:",
    env("FASTLY_SERVICE_VERSION") || "local"
  );

  const req = event.request;

  const gripSig = req.headers.get("Grip-Sig");
  const url = new URL(req.url);
  console.log(req.url, url, req.headers)
  if (gripSig) {
    // headers dont exist so lets use query params
    const channel = url.pathname;
    const originatingProtocol = req.headers.get(X_GU_PROTOCOL);

    if (!channel || channel === "/")
      return new Response("No path provided.", { status: 400 });

    if (originatingProtocol === "https:") {
      // assume this is server sent event
      return new Response("welcome\n", {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Grip-Hold": "stream",
          "Grip-Channel": channel,
        },
      });
    }

    if (originatingProtocol === "wss:") {
      const body = await req.text();
      if (body.startsWith("OPEN")) {
        const subscribePayload = { type: "subscribe", channel };
        const bodyStr = `OPEN\r\nTEXT 27\r\nc:${JSON.stringify(subscribePayload)}`;
        return new Response(toUint8Array(bodyStr), {
          status: 200,
          headers: {
            "Content-Type": "application/websocket-events",
            "Sec-WebSocket-Extensions": 'grip; message-prefix=""',
          },
        });
      } else {
        return new Response(null, {
          status: 200,
          headers: {
            "Content-Type": "application/websocket-events",
          },
        });
      }
    }
    return new Response("Invalid protocol (use https for server sent events or wss for websockets)", {
      status: 400,
    });
  } else {
    console.log("about to create fanout handoff");
    req.headers.set(X_GU_PROTOCOL, url.protocol)
    return createFanoutHandoff(req, "self");
  }
}

function toUint8Array(str: string) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}
