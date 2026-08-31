"use client";

import { openDB, type DBSchema } from "idb";
import type { AnchorRecord, ArtworkRecord } from "@/lib/types";

interface StudioDB extends DBSchema {
  anchors: {
    key: string;
    value: AnchorRecord;
  };
  artworks: {
    key: string;
    value: ArtworkRecord;
    indexes: { "by-created": number };
  };
}

const dbPromise = () =>
  openDB<StudioDB>("ip-studio", 1, {
    upgrade(db) {
      db.createObjectStore("anchors", { keyPath: "id" });
      const artworks = db.createObjectStore("artworks", { keyPath: "id" });
      artworks.createIndex("by-created", "createdAt");
    },
  });

export async function getAnchor(): Promise<AnchorRecord | undefined> {
  return (await dbPromise()).get("anchors", "primary");
}

export async function saveAnchor(record: AnchorRecord): Promise<void> {
  await (await dbPromise()).put("anchors", record);
}

export async function removeAnchor(): Promise<void> {
  await (await dbPromise()).delete("anchors", "primary");
}

export async function saveArtwork(record: ArtworkRecord): Promise<void> {
  await (await dbPromise()).put("artworks", record);
}

export async function listArtworks(): Promise<ArtworkRecord[]> {
  const items = await (await dbPromise()).getAllFromIndex("artworks", "by-created");
  return items.reverse();
}

export async function removeArtwork(id: string): Promise<void> {
  await (await dbPromise()).delete("artworks", id);
}

export async function clearArtworks(): Promise<void> {
  await (await dbPromise()).clear("artworks");
}
