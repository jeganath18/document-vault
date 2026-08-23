import { GraphQLError } from "graphql";
import type { Prisma } from "../../../generated/prisma/client";
import type { GraphQLContext } from "../context";

const DEFAULT_TAKE = 10;
const MAX_TAKE = 100;

export interface DocumentPaginationArgs {
  take?: number | null;
  cursor?: string | null;
}

export function validateTake(take: number | null | undefined): number {
  const value = take ?? DEFAULT_TAKE;

  if (!Number.isInteger(value) || value < 1 || value > MAX_TAKE) {
    throw new GraphQLError("take must be an integer between 1 and 100", {
      extensions: {
        code: "BAD_USER_INPUT",
      },
    });
  }

  return value;
}

export async function paginateDocuments(
  context: GraphQLContext,
  where: Prisma.DocumentWhereInput,
  args: DocumentPaginationArgs,
) {
  const take = validateTake(args.take);

  const documents = await context.prisma.document.findMany({
    where,
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    ...(args.cursor
      ? {
          cursor: {
            id: args.cursor,
          },
          skip: 1,
        }
      : {}),
    take: take + 1,
  });

  const hasNextPage = documents.length > take;

  const nodes = hasNextPage
    ? documents.slice(0, take)
    : documents;

  const nextCursor = hasNextPage
    ? nodes[nodes.length - 1]?.id ?? null
    : null;

  return {
    nodes,
    nextCursor,
  };
}