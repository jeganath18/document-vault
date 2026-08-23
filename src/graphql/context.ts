import { prisma } from "../lib/prisma";

export interface GraphQLContext {
  prisma: typeof prisma;
}

export function createContext(): GraphQLContext {
  return {
    prisma,
  };
}
