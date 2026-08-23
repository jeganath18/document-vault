import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../context";

interface DocumentsArgs {
  collectionId?: string | null;
  search?: string | null;
  isArchived?: boolean | null;
  take?: number | null;
  cursor?: string | null;
}

interface CreateDocumentArgs {
  title: string;
  content: string;
  tags?: string[] | null;
  collectionId: string;
}

interface UpdateDocumentArgs {
  id: string;
  title?: string | null;
  content?: string | null;
  tags?: string[] | null;
  isArchived?: boolean | null;
}

interface DocumentIdArgs {
  id: string;
}

interface MoveDocumentArgs {
  id: string;
  collectionId: string;
}

function validateText(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new GraphQLError(`${fieldName} cannot be empty`, {
      extensions: {
        code: "BAD_USER_INPUT",
      },
    });
  }

  return trimmed;
}

function validateTake(take: number | null | undefined): number {
  const value = take ?? 10;

  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new GraphQLError("take must be an integer between 1 and 100", {
      extensions: {
        code: "BAD_USER_INPUT",
      },
    });
  }

  return value;
}

export const documentResolvers = {
  Query: {
    documents: async (
      _parent: unknown,
      args: DocumentsArgs,
      context: GraphQLContext,
    ) => {
      const take = validateTake(args.take);

      const search = args.search?.trim();

      const documents = await context.prisma.document.findMany({
        where: {
          ...(args.collectionId
            ? {
                collectionId: args.collectionId,
              }
            : {}),

          ...(args.isArchived !== null && args.isArchived !== undefined
            ? {
                isArchived: args.isArchived,
              }
            : {}),

          ...(search
            ? {
                OR: [
                  {
                    title: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    content: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
        },

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
    },
  },

  Mutation: {
    createDocument: async (
      _parent: unknown,
      args: CreateDocumentArgs,
      context: GraphQLContext,
    ) => {
      const title = validateText(args.title, "Document title");
      const content = validateText(args.content, "Document content");

      const collection = await context.prisma.collection.findUnique({
        where: {
          id: args.collectionId,
        },
      });

      if (!collection) {
        throw new GraphQLError("Collection not found", {
          extensions: {
            code: "NOT_FOUND",
          },
        });
      }

      return context.prisma.document.create({
        data: {
          title,
          content,
          tags: args.tags ?? [],
          collectionId: args.collectionId,
        },
      });
    },

    updateDocument: async (
      _parent: unknown,
      args: UpdateDocumentArgs,
      context: GraphQLContext,
    ) => {
      const existingDocument = await context.prisma.document.findUnique({
        where: {
          id: args.id,
        },
      });

      if (!existingDocument) {
        throw new GraphQLError("Document not found", {
          extensions: {
            code: "NOT_FOUND",
          },
        });
      }

      const data: {
        title?: string;
        content?: string;
        tags?: string[];
        isArchived?: boolean;
      } = {};

      if (args.title !== undefined && args.title !== null) {
        data.title = validateText(args.title, "Document title");
      }

      if (args.content !== undefined && args.content !== null) {
        data.content = validateText(args.content, "Document content");
      }

      if (args.tags !== undefined && args.tags !== null) {
        data.tags = args.tags;
      }

      if (args.isArchived !== undefined && args.isArchived !== null) {
        data.isArchived = args.isArchived;
      }

      return context.prisma.document.update({
        where: {
          id: args.id,
        },
        data,
      });
    },

    deleteDocument: async (
      _parent: unknown,
      args: DocumentIdArgs,
      context: GraphQLContext,
    ) => {
      const existingDocument = await context.prisma.document.findUnique({
        where: {
          id: args.id,
        },
      });

      if (!existingDocument) {
        throw new GraphQLError("Document not found", {
          extensions: {
            code: "NOT_FOUND",
          },
        });
      }

      await context.prisma.document.delete({
        where: {
          id: args.id,
        },
      });

      return true;
    },

    moveDocument: async (
      _parent: unknown,
      args: MoveDocumentArgs,
      context: GraphQLContext,
    ) => {
      const document = await context.prisma.document.findUnique({
        where: {
          id: args.id,
        },
      });

      if (!document) {
        throw new GraphQLError("Document not found", {
          extensions: {
            code: "NOT_FOUND",
          },
        });
      }

      const collection = await context.prisma.collection.findUnique({
        where: {
          id: args.collectionId,
        },
      });

      if (!collection) {
        throw new GraphQLError("Target collection not found", {
          extensions: {
            code: "NOT_FOUND",
          },
        });
      }

      return context.prisma.document.update({
        where: {
          id: args.id,
        },
        data: {
          collectionId: args.collectionId,
        },
      });
    },
  },
};