import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createYoga } from "graphql-yoga";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createContext } from "./graphql/context";
import { collectionResolvers } from "./graphql/resolvers/collection.resolver";
import { documentResolvers } from "./graphql/resolvers/document.resolver";

const typeDefs = readFileSync(
  new URL("./graphql/schema.graphql", import.meta.url),
  "utf8",
);

const resolvers = {
  Query: {
    ...collectionResolvers.Query,
    ...documentResolvers.Query,
  },

  Mutation: {
    ...collectionResolvers.Mutation,
    ...documentResolvers.Mutation,
  },

  Collection: collectionResolvers.Collection,
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const yoga = createYoga({
  schema,
  context: createContext,
});

const server = createServer(yoga);

const port = Number(process.env.PORT ?? 3000);

server.listen(port, () => {
  console.log(
    `Document Vault API running at http://localhost:${port}/graphql`,
  );
});
