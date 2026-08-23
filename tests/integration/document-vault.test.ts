import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

describe("Document Vault PostgreSQL integration", () => {
  let collectionId: string;
  let documentId: string;

  beforeAll(async () => {
    await prisma.document.deleteMany();
    await prisma.collection.deleteMany();

    const collection = await prisma.collection.create({
      data: {
        name: "Integration Test Collection",
        slug: "integration-test",
      },
    });

    collectionId = collection.id;
  });

  afterAll(async () => {
    await prisma.document.deleteMany();
    await prisma.collection.deleteMany();
    await prisma.$disconnect();
  });

  test("creates and retrieves a document from PostgreSQL", async () => {
    const document = await prisma.document.create({
      data: {
        title: "Integration Test Document",
        content: "Stored in Dockerized PostgreSQL",
        tags: ["integration", "postgres"],
        collectionId,
      },
    });

    documentId = document.id;

    expect(document.title).toBe("Integration Test Document");
    expect(document.collectionId).toBe(collectionId);

    const storedDocument = await prisma.document.findUnique({
      where: {
        id: documentId,
      },
    });

    expect(storedDocument).not.toBeNull();
    expect(storedDocument?.title).toBe("Integration Test Document");
    expect(storedDocument?.content).toBe(
      "Stored in Dockerized PostgreSQL",
    );
  });

  test("moves a document between collections", async () => {
    const targetCollection = await prisma.collection.create({
      data: {
        name: "Target Collection",
        slug: "target-collection",
      },
    });

    const movedDocument = await prisma.document.update({
      where: {
        id: documentId,
      },
      data: {
        collectionId: targetCollection.id,
      },
    });

    expect(movedDocument.collectionId).toBe(targetCollection.id);
  });

  test("supports search and archived filtering", async () => {
    const collection = await prisma.collection.create({
      data: {
        name: "Search Test",
        slug: "search-test",
      },
    });

    await prisma.document.create({
      data: {
        title: "GraphQL Architecture",
        content: "API design document",
        tags: ["graphql"],
        collectionId: collection.id,
      },
    });

    await prisma.document.create({
      data: {
        title: "Database Notes",
        content: "PostgreSQL architecture",
        tags: ["postgres"],
        collectionId: collection.id,
        isArchived: true,
      },
    });

    const searchResults = await prisma.document.findMany({
      where: {
        collectionId: collection.id,
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
    });

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.title).toBe("GraphQL Architecture");

    const archivedDocuments = await prisma.document.findMany({
      where: {
        collectionId: collection.id,
        isArchived: true,
      },
    });

    expect(archivedDocuments).toHaveLength(1);
    expect(archivedDocuments[0]?.title).toBe("Database Notes");
  });
});
