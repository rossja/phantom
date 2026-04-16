// Centralized bootstrap data hook. One fetch per page load shared across
// AppShell, EmptyState, and SidebarFooter so the three consumers read from
// one source instead of racing independent fetches.
//
// localStorage persistence eliminates the "Phantom" flash on mount: the
// cached agent name paints immediately while the fresh fetch runs in the
// background to pick up any evolution-generation changes since last load.

import { useEffect, useState } from "react";
import { getBootstrap, type BootstrapData } from "@/lib/client";

const STORAGE_KEY = "phantom-chat-bootstrap-v1";

type CachedBootstrap = {
  agent_name: string;
  evolution_gen: number;
};

let inFlightPromise: Promise<BootstrapData> | null = null;
let cachedData: BootstrapData | null = null;

function readCache(): CachedBootstrap | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "agent_name" in parsed &&
      typeof (parsed as CachedBootstrap).agent_name === "string"
    ) {
      return parsed as CachedBootstrap;
    }
  } catch {
    // corrupt cache, treat as miss
  }
  return null;
}

function writeCache(data: BootstrapData): void {
  try {
    const minimal: CachedBootstrap = {
      agent_name: data.agent_name,
      evolution_gen: data.evolution_gen,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
  } catch {
    // storage disabled or full, ignore
  }
}

function fetchBootstrap(): Promise<BootstrapData> {
  if (cachedData) return Promise.resolve(cachedData);
  if (inFlightPromise) return inFlightPromise;
  inFlightPromise = getBootstrap()
    .then((data) => {
      cachedData = data;
      writeCache(data);
      return data;
    })
    .finally(() => {
      inFlightPromise = null;
    });
  return inFlightPromise;
}

export function useBootstrap(): {
  data: BootstrapData | null;
  cachedName: string | null;
  cachedGen: number | null;
} {
  const initialCache = typeof window !== "undefined" ? readCache() : null;
  const [data, setData] = useState<BootstrapData | null>(cachedData);
  const [cachedName, setCachedName] = useState<string | null>(
    initialCache?.agent_name ?? null,
  );
  const [cachedGen, setCachedGen] = useState<number | null>(
    initialCache?.evolution_gen ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    fetchBootstrap()
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setCachedName(next.agent_name);
        setCachedGen(next.evolution_gen);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, cachedName, cachedGen };
}

// Non-hook accessor for consumers that already hold data and want the
// cached agent name synchronously (Service Worker postMessage, document.title
// writes before React mounts).
export function readCachedAgentName(): string | null {
  const entry = readCache();
  return entry?.agent_name ?? null;
}
