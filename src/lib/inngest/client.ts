import { Inngest } from "inngest";

// The app id below is frozen — see docs/adr/0001-product-name-and-app-ids.md.
// Changing it after functions are deployed orphans event history and
// in-flight runs.
//
// Event typing is per-event via src/lib/inngest/events.ts's EventType
// exports (Inngest 4's model), not a central schema registry here.
export const inngest = new Inngest({ id: "voquarn-geo" });
