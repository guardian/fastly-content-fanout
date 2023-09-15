/// <reference types="@fastly/js-compute" />

import { env } from "fastly:env";
import { createFanoutHandoff } from "fastly:fanout";

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
  if (gripSig) {
    // headers dont exist so lets use query params
    const url = new URL(req.url);
    const contentType = url.searchParams.get("contentType");
    const channel = url.searchParams.get("channel");
    // const contentType = req.headers.get("Content-Type")
    // const channel = req.headers.get("x-gu-path")
    console.log({ contentType, channel });

    if (!channel)
      return new Response("x-gu-path header required", { status: 400 });
    if (contentType != "application/websocket-events") {
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

    const body = await req.text();
    console.log("body: ", body);
    if (body.startsWith("OPEN")) {
      const bodyStr = `OPEN\r\nTEXT 27\r\nc:{\"type\":\"subscribe\",\"channel\":\"${channel}\"}`;
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
  } else {
    console.log("about to create fanout handoff");
    return createFanoutHandoff(req, "self");
  }
}

function toUint8Array(str: string) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}
