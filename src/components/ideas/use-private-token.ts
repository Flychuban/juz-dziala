"use client";

import { useEffect, useState } from "react";

import { readMyCases } from "~/components/cases/my-cases";

/**
 * The private-link token for a case: from the URL (`?t=`), or — when the page
 * was opened with the code alone — from this device's list of cases, where the
 * case was saved when it was created. Saving needs the token; reading does not.
 *
 * `ready` is false until the device's list has been checked (after mount), so a
 * page does not flash a „read-only" notice before it knows.
 */
export function usePrivateToken(code: string, fromUrl: string | undefined): { token: string | undefined; ready: boolean } {
  const [state, setState] = useState<{ token: string | undefined; ready: boolean }>({ token: fromUrl, ready: !!fromUrl });
  useEffect(() => {
    if (fromUrl) {
      setState({ token: fromUrl, ready: true });
      return;
    }
    const saved = readMyCases().find((c) => c.code === code)?.token;
    setState({ token: saved, ready: true });
  }, [code, fromUrl]);
  return state;
}
