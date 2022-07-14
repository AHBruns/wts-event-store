import { randomUUID } from "node:crypto"

import { loadPackageDefinition, Server, ServerCredentials } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import "dotenv"

import { ProtoGrpcType } from "./proto-gen/eventStore";
import { StreamEvent } from "./proto-gen/StreamEvent";
import { EventStoreServiceHandlers } from "./proto-gen/EventStoreService"

const packageDef = loadSync("./proto/eventStore.proto")
const loadedPackageDef = ((loadPackageDefinition(packageDef) as unknown) as ProtoGrpcType)
const service = loadedPackageDef.EventStoreService.service

const server = new Server();

const eventStream: StreamEvent[] = [];
server.addService(service, {
  takeAt: ({ request: { count, streamId } }) => {
    if (streamId === undefined) throw new Error("Invalid argument")

    const index = eventStream.findIndex((streamEvent) => streamEvent.streamId === streamId)

    if (index === -1) return {}

    return {
      streamEvents: eventStream.slice(index, index + (count ?? 1))
    }
  },
  append: ({ request: { events } }) => {
    const streamEvents = (events ?? []).map((event) => ({ streamId: randomUUID(), event }))

    streamEvents.forEach((streamEvent) => {
      eventStream.push(streamEvent)
    })

    return {
      streamIds: streamEvents.map((streamEvent) => streamEvent.streamId)
    }
  }
} as EventStoreServiceHandlers);

server.bindAsync(
  process.env.HOST ?? "127.0.0.1:50051",
  ServerCredentials.createInsecure(),
  (error, port) => {
    if (error) {
      console.error(error)
      throw error
    }

    console.log("Server running on port:", port);
    server.start();
  }
);