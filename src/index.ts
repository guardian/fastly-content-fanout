/// <reference types="@fastly/js-compute" />

import { env } from "fastly:env";
import { createFanoutHandoff } from "fastly:fanout";

// Use this fetch event listener to define your main request handling logic.
addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest({ request }: FetchEvent) {
  // Log service version
  console.log(
    "FASTLY_SERVICE_VERSION:",
    env("FASTLY_SERVICE_VERSION") || "local"
  );

  const channel = new URL(request.url).pathname;

  if (!channel || channel === "/")
    return new Response("No path provided.", { status: 400 });

  if (!request.headers.has("Grip-Sig")) {
    console.log("about to create fanout handoff");
    return createFanoutHandoff(request, "self");
  }

  if (request.headers.get("Accept") === "application/websocket-events") {
    const body = await request.text();
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

  // assume this is server sent event
  return new Response("welcome\n", { // TODO: can we send null for body?
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Grip-Hold": "stream",
      "Grip-Channel": channel,
    },
  });
}

function toUint8Array(str: string) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}
