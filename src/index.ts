/// <reference types="@fastly/js-compute" />

import { Buffer } from 'buffer';

import { env } from "fastly:env";
import { createFanoutHandoff } from "fastly:fanout";

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

  const maybeGripSig = request.headers.has("Grip-Sig");

  const requestOrigin = request.headers.get("Origin");
  console.log(" -- Origin:", requestOrigin)

  // CORs protection (because request headers are lost on the self-call after the 'createFanoutHandoff' handoff)
  const validCorsOriginSuffixes = [
    ".code.dev-gutools.co.uk",
    ".gutools.co.uk",
    "https://m.code.dev-theguardian.com",
    "https://www.theguardian.com"
  ];
  if(!maybeGripSig && !validCorsOriginSuffixes.some(originSuffix => requestOrigin?.endsWith(originSuffix))) {
    console.log("Invalid CORS origin, rejecting request", " -- Origin:", requestOrigin);
    return new Response("Invalid CORS origin", { status: 403 });
  }

  const channel = new URL(request.url).pathname?.substring(1); // drop preceding "/"

  if (!channel || channel === "/")
    return new Response("No path provided.", { status: 400 });

  if (!request.headers.has("Grip-Sig")) {
    console.log("about to create fanout handoff", " -- Origin:", requestOrigin);
    return createFanoutHandoff(request, "self");
  }

  const commonHeaders = {
    // we have CORs protections further up, * is required here because the original origin is gone when we hit this line
    "Access-Control-Allow-Origin": "*"
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
  return new Response(null, {
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
