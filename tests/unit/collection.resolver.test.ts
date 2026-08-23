import { describe, expect, mock, test } from "bun:test";
import { collectionResolvers } from "../../src/graphql/resolvers/collection.resolver";
import type { GraphQLContext } from "../../src/graphql/context";

function createMockContext() {
  const collection = {
    findMany: mock(),
    findUnique: mock(),
    create: mock(),
  };

  const document = {
    findMany: mock(),
  };

  return {
    prisma: {
      collection,
      document,
    },
  } as unknown as GraphQLContext;
}

describe("Collection resolvers", () => {
  test("returns collections ordered by newest first", async () => {
    const context = createMockContext();

    const collections = [
      {
        id: "2",
        name: "Research",
        slug: "research",
        createdAt: new Date("2026-08-23T11:00:00Z"),
      },
      {
        id: "1",
        name: "Engineering",
        slug: "engineering",
        createdAt: new Date("2026-08-23T10:00:00Z"),
      },
    ];

    context.prisma.collection.findMany = mock().mockResolvedValue(
      collections,
    ) as typeof context.prisma.collection.findMany;

    const result = await collectionResolvers.Query.collections(
      {},
      {},
      context,
    );

    expect(result).toEqual(collections);

    expect(context.prisma.collection.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: "desc",
      },
    });
  });

  test("returns a collection by id", async () => {
    const context = createMockContext();

    const collection = {
      id: "collection-1",
      name: "Engineering",
      slug: "engineering",
      createdAt: new Date(),
    };

    context.prisma.collection.findUnique = mock().mockResolvedValue(
      collection,
    ) as typeof context.prisma.collection.findUnique;

    const result = await collectionResolvers.Query.collection(
      {},
      {
        id: "collection-1",
      },
      context,
    );

    expect(result).toEqual(collection);

    expect(context.prisma.collection.findUnique).toHaveBeenCalledWith({
      where: {
        id: "collection-1",
      },
    });
  });

  test("creates a collection with trimmed values", async () => {
    const context = createMockContext();

    const createdCollection = {
      id: "collection-1",
      name: "Engineering",
      slug: "engineering",
      createdAt: new Date(),
    };

    context.prisma.collection.findUnique = mock().mockResolvedValue(
      null,
    ) as typeof context.prisma.collection.findUnique;

    context.prisma.collection.create = mock().mockResolvedValue(
      createdCollection,
    ) as typeof context.prisma.collection.create;

    const result = await collectionResolvers.Mutation.createCollection(
      {},
      {
        name: "  Engineering  ",
        slug: "engineering",
      },
      context,
    );

    expect(result).toEqual(createdCollection);

    expect(context.prisma.collection.create).toHaveBeenCalledWith({
      data: {
        name: "Engineering",
        slug: "engineering",
      },
    });
  });

  test("rejects an empty collection name", async () => {
    const context = createMockContext();

    await expect(
      collectionResolvers.Mutation.createCollection(
        {},
        {
          name: "   ",
          slug: "engineering",
        },
        context,
      ),
    ).rejects.toMatchObject({
      message: "Collection name cannot be empty",
      extensions: {
        code: "BAD_USER_INPUT",
      },
    });
  });

  test("rejects an invalid slug", async () => {
    const context = createMockContext();

    await expect(
      collectionResolvers.Mutation.createCollection(
        {},
        {
          name: "Engineering",
          slug: "Invalid Slug",
        },
        context,
      ),
    ).rejects.toMatchObject({
      message:
        "Slug must contain only lowercase letters, numbers, and single hyphens",
      extensions: {
        code: "BAD_USER_INPUT",
      },
    });
  });

  test("rejects a duplicate slug", async () => {
    const context = createMockContext();

    context.prisma.collection.findUnique = mock().mockResolvedValue({
      id: "existing",
      name: "Engineering",
      slug: "engineering",
      createdAt: new Date(),
    }) as typeof context.prisma.collection.findUnique;

    await expect(
      collectionResolvers.Mutation.createCollection(
        {},
        {
          name: "Another Engineering",
          slug: "engineering",
        },
        context,
      ),
    ).rejects.toMatchObject({
      message: "A collection with this slug already exists",
      extensions: {
        code: "CONFLICT",
      },
    });

    expect(context.prisma.collection.create).not.toHaveBeenCalled();
  });
});
