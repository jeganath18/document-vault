import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../context";
import {
  paginateDocuments,
  type DocumentPaginationArgs,
} from "../utils/document-pagination";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface CreateCollectionArgs {
  name: string;
  slug: string;
}

interface CollectionArgs {
  id: string;
}

export const collectionResolvers = {
  Query: {
    collections: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      return context.prisma.collection.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });
    },

    collection: async (
      _parent: unknown,
      args: CollectionArgs,
      context: GraphQLContext,
    ) => {
      return context.prisma.collection.findUnique({
        where: {
          id: args.id,
        },
      });
    },
  },

  Mutation: {
    createCollection: async (
      _parent: unknown,
      args: CreateCollectionArgs,
      context: GraphQLContext,
    ) => {
      const name = args.name.trim();
      const slug = args.slug.trim();

      if (!name) {
        throw new GraphQLError("Collection name cannot be empty", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });
      }

      if (!SLUG_PATTERN.test(slug)) {
        throw new GraphQLError(
          "Slug must contain only lowercase letters, numbers, and single hyphens",
          {
            extensions: {
              code: "BAD_USER_INPUT",
            },
          },
        );
      }

      const existingCollection = await context.prisma.collection.findUnique({
        where: {
          slug,
        },
      });

      if (existingCollection) {
        throw new GraphQLError("A collection with this slug already exists", {
          extensions: {
            code: "CONFLICT",
          },
        });
      }

      return context.prisma.collection.create({
        data: {
          name,
          slug,
        },
      });
    },
  },

Collection: {
  documents: async (
    parent: { id: string },
    args: DocumentPaginationArgs,
    context: GraphQLContext,
  ) => {
    return paginateDocuments(
      context,
      {
        collectionId: parent.id,
      },
      {
        ...(args.take !== undefined
          ? {
              take: args.take,
            }
          : {}),
        ...(args.cursor !== undefined
          ? {
              cursor: args.cursor,
            }
          : {}),
      },
    );
  },
  },
};
