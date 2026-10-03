import { adaptRouter } from "~/server/api/routers/adapt";
import { adminAiRouter } from "~/server/api/routers/admin/ai";
import { adminCallsRouter } from "~/server/api/routers/admin/calls";
import { adminInboxRouter } from "~/server/api/routers/admin/inbox";
import { adminLibraryRouter } from "~/server/api/routers/admin/library";
import { adminTrendsRouter } from "~/server/api/routers/admin/trends";
import { casesRouter } from "~/server/api/routers/cases";
import { ideasRouter } from "~/server/api/routers/ideas";
import { knowledgeRouter } from "~/server/api/routers/knowledge";
import { libraryRouter } from "~/server/api/routers/library";
import { matchRouter } from "~/server/api/routers/match";
import { municipalityRouter } from "~/server/api/routers/municipality";
import { networkRouter } from "~/server/api/routers/network";
import { notificationsRouter } from "~/server/api/routers/notifications";
import { testsRouter } from "~/server/api/routers/tests";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * One router per module; every router is registered here up front so module
 * agents never edit this file.
 */
export const appRouter = createTRPCRouter({
  match: matchRouter, // I   Matchmaking
  library: libraryRouter, // II  Zasobnik — biblioteka
  knowledge: knowledgeRouter, // II  Zasobnik — Kondycja Małopolski, materiały
  ideas: ideasRouter, // III Kreator pomysłów
  tests: testsRouter, // IV  Tester innowacji
  cases: casesRouter, // V   Sprawy i komunikacja
  network: networkRouter, // V   Sieć: organizacje, mentorzy, subskrypcje
  notifications: notificationsRouter, // V/VI
  adapt: adaptRouter, // VII Middleman
  municipality: municipalityRouter, // VII Dla gminy
  admin: createTRPCRouter({
    inbox: adminInboxRouter, // VI
    library: adminLibraryRouter, // VI
    calls: adminCallsRouter, // VI
    trends: adminTrendsRouter, // II (admin-only)
    ai: adminAiRouter, // VI
  }),
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
