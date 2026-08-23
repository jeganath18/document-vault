import { describe, expect, mock, test } from "bun:test";
import { documentResolvers } from "../../src/graphql/resolvers/document.resolver";
import type { GraphQLContext } from "../../src/graphql/context";

function createMockContext() {
  const document = {
    findMany: mock(),
    findUnique: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
  };

  const collection = {
    findUnique: mock(),
  };

  return {
    prisma: {
      document,
      collection,
    },
  } as unknown as GraphQLContext;
}

describe("Document resolvers", () => {
  test("creates a document", async () => {
    const context = createMockContext();

    const collection = {
      id: "collection-1",
      name: "Engineering",
      slug: "engineering",
      createdAt: new Date(),
    };

    const document = {
      id: "document-1",
      title: "Prisma Architecture",
      content: "Prisma with PostgreSQL",
      tags: ["prisma", "postgresql"],
      collectionId: "collection-1",
      isArchived: false,
      createdAt: new Date(),
    };

    context.prisma.collection.findUnique = mock().mockResolvedValue(
      collection,
    ) as typeof context.prisma.collection.findUnique;

    context.prisma.document.create = mock().mockResolvedValue(
      document,
    ) as typeof context.prisma.document.create;

    const result = await documentResolvers.Mutation.createDocument(
      {},
      {
        title: "  Prisma Architecture  ",
        content: "  Prisma with PostgreSQL  ",
        tags: ["prisma", "postgresql"],
        collectionId: "collection-1",
      },
      context,
    );

    expect(result).toEqual(document);

    expect(context.prisma.document.create).toHaveBeenCalledWith({
      data: {
        title: "Prisma Architecture",
        content: "Prisma with PostgreSQL",
        tags: ["prisma", "postgresql"],
        collectionId: "collection-1",
      },
    });
  });

  test("rejects an empty document title", async () => {
    const context = createMockContext();

    await expect(
      documentResolvers.Mutation.createDocument(
        {},
        {
          title: "   ",
          content: "Valid content",
          tags: [],
          collectionId: "collection-1",
        },
        context,
      ),
    ).rejects.toMatchObject({
      message: "Document title cannot be empty",
      extensions: {
        code: "BAD_USER_INPUT",
      },
    });

    expect(context.prisma.collection.findUnique).not.toHaveBeenCalled();
  });

  test("rejects empty document content", async () => {
    const context = createMockContext();

    await expect(
      documentResolvers.Mutation.createDocument(
        {},
        {
          title: "Valid title",
          content: "   ",
          tags: [],
          collectionId: "collection-1",
        },
        context,
      ),
    ).rejects.toMatchObject({
      message: "Document content cannot be empty",
      extensions: {
        code: "BAD_USER_INPUT",
      },
    });

    expect(context.prisma.collection.findUnique).not.toHaveBeenCalled();
  });

  test("rejects creating a document in a missing collection", async () => {
    const context = createMockContext();

    context.prisma.collection.findUnique = mock().mockResolvedValue(
      null,
    ) as typeof context.prisma.collection.findUnique;

    await expect(
      documentResolvers.Mutation.createDocument(
        {},
        {
          title: "Prisma Architecture",
          content: "Prisma with PostgreSQL",
          tags: [],
          collectionId: "missing-collection",
        },
        context,
      ),
    ).rejects.toMatchObject({
      message: "Collection not found",
      extensions: {
        code: "NOT_FOUND",
      },
    });

    expect(context.prisma.document.create).not.toHaveBeenCalled();
  });

  test("updates a document", async () => {
    const context = createMockContext();

    const existingDocument = {
      id: "document-1",
      title: "Old title",
      content: "Old content",
      tags: ["old"],
      collectionId: "collection-1",
      isArchived: false,
      createdAt: new Date(),
    };

    const updatedDocument = {
      ...existingDocument,
      title: "New title",
      isArchived: true,
    };

    context.prisma.document.findUnique = mock().mockResolvedValue(
      existingDocument,
    ) as typeof context.prisma.document.findUnique;

    context.prisma.document.update = mock().mockResolvedValue(
      updatedDocument,
    ) as typeof context.prisma.document.update;

    const result = await documentResolvers.Mutation.updateDocument(
      {},
      {
        id: "document-1",
        title: "New title",
        isArchived: true,
      },
      context,
    );

    expect(result).toEqual(updatedDocument);

    expect(context.prisma.document.update).toHaveBeenCalledWith({
      where: {
        id: "document-1",
      },
      data: {
        title: "New title",
        isArchived: true,
      },
    });
  });

  test("rejects updating a missing document", async () => {
    const context = createMockContext();

    context.prisma.document.findUnique = mock().mockResolvedValue(
      null,
    ) as typeof context.prisma.document.findUnique;

    await expect(
      documentResolvers.Mutation.updateDocument(
        {},
        {
          id: "missing-document",
          title: "New title",
        },
        context,
      ),
    ).rejects.toMatchObject({
      message: "Document not found",
      extensions: {
        code: "NOT_FOUND",
      },
    });

    expect(context.prisma.document.update).not.toHaveBeenCalled();
  });

  test("rejects updating a document with an empty title", async () => {
    const context = createMockContext();

    context.prisma.document.findUnique = mock().mockResolvedValue({
      id: "document-1",
      title: "Existing",
      content: "Content",
      tags: [],
      collectionId: "collection-1",
      isArchived: false,
      createdAt: new Date(),
    }) as typeof context.prisma.document.findUnique;

    await expect(
      documentResolvers.Mutation.updateDocument(
        {},
        {
          id: "document-1",
          title: "   ",
        },
        context,
      ),
    ).rejects.toMatchObject({
      message: "Document title cannot be empty",
      extensions: {
        code: "BAD_USER_INPUT",
      },
    });

    expect(context.prisma.document.update).not.toHaveBeenCalled();
  });

  test("deletes a document", async () => {
    const context = createMockContext();

    context.prisma.document.findUnique = mock().mockResolvedValue({
      id: "document-1",
      title: "Document",
      content: "Content",
      tags: [],
      collectionId: "collection-1",
      isArchived: false,
      createdAt: new Date(),
    }) as typeof context.prisma.document.findUnique;

    context.prisma.document.delete = mock().mockResolvedValue({
      id: "document-1",
    }) as typeof context.prisma.document.delete;

    const result = await documentResolvers.Mutation.deleteDocument(
      {},
      {
        id: "document-1",
      },
      context,
    );

    expect(result).toBe(true);

    expect(context.prisma.document.delete).toHaveBeenCalledWith({
      where: {
        id: "document-1",
      },
    });
  });

  test("rejects deleting a missing document", async () => {
    const context = createMockContext();

    context.prisma.document.findUnique = mock().mockResolvedValue(
      null,
    ) as typeof context.prisma.document.findUnique;

    await expect(
      documentResolvers.Mutation.deleteDocument(
        {},
        {
          id: "missing-document",
        },
        context,
      ),
    ).rejects.toMatchObject({
      message: "Document not found",
      extensions: {
        code: "NOT_FOUND",
      },
    });

    expect(context.prisma.document.delete).not.toHaveBeenCalled();
  });

  test("moves a document to another collection", async () => {
    const context = createMockContext();

    const document = {
      id: "document-1",
      title: "Document",
      content: "Content",
      tags: [],
      collectionId: "collection-1",
      isArchived: false,
      createdAt: new Date(),
    };

    const targetCollection = {
      id: "collection-2",
      name: "Research",
      slug: "research",
      createdAt: new Date(),
    };

    const movedDocument = {
      ...document,
      collectionId: "collection-2",
    };

    context.prisma.document.findUnique = mock().mockResolvedValue(
      document,
    ) as typeof context.prisma.document.findUnique;

    context.prisma.collection.findUnique = mock().mockResolvedValue(
      targetCollection,
    ) as typeof context.prisma.collection.findUnique;

    context.prisma.document.update = mock().mockResolvedValue(
      movedDocument,
    ) as typeof context.prisma.document.update;

    const result = await documentResolvers.Mutation.moveDocument(
      {},
      {
        id: "document-1",
        collectionId: "collection-2",
      },
      context,
    );

    expect(result).toEqual(movedDocument);

    expect(context.prisma.document.update).toHaveBeenCalledWith({
      where: {
        id: "document-1",
      },
      data: {
        collectionId: "collection-2",
      },
    });
  });

  test("rejects moving a missing document", async () => {
    const context = createMockContext();

    context.prisma.document.findUnique = mock().mockResolvedValue(
      null,
    ) as typeof context.prisma.document.findUnique;

    await expect(
      documentResolvers.Mutation.moveDocument(
        {},
        {
          id: "missing-document",
          collectionId: "collection-2",
        },
        context,
      ),
    ).rejects.toMatchObject({
      message: "Document not found",
      extensions: {
        code: "NOT_FOUND",
      },
    });

    expect(context.prisma.collection.findUnique).not.toHaveBeenCalled();
  });

  test("rejects moving a document to a missing collection", async () => {
    const context = createMockContext();

    context.prisma.document.findUnique = mock().mockResolvedValue({
      id: "document-1",
      title: "Document",
      content: "Content",
      tags: [],
      collectionId: "collection-1",
      isArchived: false,
      createdAt: new Date(),
    }) as typeof context.prisma.document.findUnique;

    context.prisma.collection.findUnique = mock().mockResolvedValue(
      null,
    ) as typeof context.prisma.collection.findUnique;

    await expect(
      documentResolvers.Mutation.moveDocument(
        {},
        {
          id: "document-1",
          collectionId: "missing-collection",
        },
        context,
      ),
    ).rejects.toMatchObject({
      message: "Target collection not found",
      extensions: {
        code: "NOT_FOUND",
      },
    });

    expect(context.prisma.document.update).not.toHaveBeenCalled();
  });

  test("searches documents by title or content", async () => {
    const context = createMockContext();

    const documents = [
      {
        id: "document-1",
        title: "GraphQL Architecture",
        content: "API design",
        tags: [],
        collectionId: "collection-1",
        isArchived: false,
        createdAt: new Date(),
      },
    ];

    context.prisma.document.findMany = mock().mockResolvedValue(
      documents,
    ) as typeof context.prisma.document.findMany;

    const result = await documentResolvers.Query.documents(
      {},
      {
        search: "graphql",
        take: 10,
      },
      context,
    );

    expect(result.nodes).toEqual(documents);

    expect(context.prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            title: {
              contains: "graphql",
              mode: "insensitive",
            },
          },
          {
            content: {
              contains: "graphql",
              mode: "insensitive",
            },
          },
        ],
      },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      take: 11,
    });
  });

  test("filters documents by collection and archived state", async () => {
    const context = createMockContext();

    context.prisma.document.findMany = mock().mockResolvedValue(
      [],
    ) as typeof context.prisma.document.findMany;

    await documentResolvers.Query.documents(
      {},
      {
        collectionId: "collection-1",
        isArchived: false,
        take: 5,
      },
      context,
    );

    expect(context.prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        collectionId: "collection-1",
        isArchived: false,
      },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      take: 6,
    });
  });

  test("uses cursor pagination", async () => {
    const context = createMockContext();

    const documents = [
      {
        id: "document-1",
        title: "Document 1",
        content: "Content",
        tags: [],
        collectionId: "collection-1",
        isArchived: false,
        createdAt: new Date(),
      },
      {
        id: "document-2",
        title: "Document 2",
        content: "Content",
        tags: [],
        collectionId: "collection-1",
        isArchived: false,
        createdAt: new Date(),
      },
      {
        id: "document-3",
        title: "Document 3",
        content: "Content",
        tags: [],
        collectionId: "collection-1",
        isArchived: false,
        createdAt: new Date(),
      },
    ];

    context.prisma.document.findMany = mock().mockResolvedValue(
      documents,
    ) as typeof context.prisma.document.findMany;

    const result = await documentResolvers.Query.documents(
      {},
      {
        take: 2,
        cursor: "cursor-document",
      },
      context,
    );

    expect(result.nodes).toHaveLength(2);
    expect(result.nextCursor).toBe("document-2");

    expect(context.prisma.document.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      cursor: {
        id: "cursor-document",
      },
      skip: 1,
      take: 3,
    });
  });

  test("rejects an invalid pagination size", async () => {
    const context = createMockContext();

    await expect(
      documentResolvers.Query.documents(
        {},
        {
          take: 0,
        },
        context,
      ),
    ).rejects.toMatchObject({
      message: "take must be an integer between 1 and 100",
      extensions: {
        code: "BAD_USER_INPUT",
      },
    });

    expect(context.prisma.document.findMany).not.toHaveBeenCalled();
  });
});
