/// <reference types="@fastly/js-compute" />

import { Buffer } from 'buffer';

import { env } from "fastly:env";
import { createFanoutHandoff } from "fastly:fanout";

const commonHeaders = {
  "Access-Control-Allow-Origin": "https://www.theguardian.com",
};

// Use this fetch event listener to define your main request handling logic.
addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest({ request }: FetchEvent) {
  // Log service version
  console.log(
    "FASTLY_SERVICE_VERSION:",
    env("FASTLY_SERVICE_VERSION") || "local",
      request.method,
      request.url
  );

  const channel = new URL(request.url).pathname?.substring(1); // drop preceding "/"

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
      const wsMessage = JSON.stringify(subscribePayload)
      const content = `c:${wsMessage}`
      const out = Buffer.concat([
        Buffer.from("OPEN"),
        Buffer.from("\r\n"),
        Buffer.from("TEXT"),
        Buffer.from(" "),
        Buffer.from(content.length.toString(16)),
        Buffer.from("\r\n"),
        Buffer.from(content),
        Buffer.from("\r\n")
        // TODO add the keep-alive (see https://pushpin.org/docs/advanced/#keep-alives)
      ]);
      return new Response(new Uint8Array(out), {
        status: 200,
        headers: {
          ...commonHeaders,
          "Content-Type": "application/websocket-events",
          "Sec-WebSocket-Extensions": 'grip; message-prefix=""',
        },
      });
    } else {
      return new Response(null, {
        status: 200,
        headers: {
          ...commonHeaders,
          "Content-Type": "application/websocket-events",
        },
      });
    }
  }

  // assume this is server sent event
  return new Response("welcome\n", { // TODO: can we send null for body?
    status: 200,
    headers: {
      ...commonHeaders,
      "Content-Type": "text/event-stream",
      "Grip-Hold": "stream",
      "Grip-Channel": channel,
      // TODO add the keep-alive header (see https://pushpin.org/docs/advanced/#keep-alives)
    },
  });
}
