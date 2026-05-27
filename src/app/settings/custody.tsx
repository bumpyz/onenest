// /settings/custody — REDIRECT to /custody/pattern.
//
// The pattern editor moved out of Settings entirely in the custody-surfaces
// v2 handoff (design_handoff_custody_surfaces README · "Change 4"). Custody
// schedule and pattern now live under their own route family:
//   • /custody/schedule — viewer
//   • /custody/pattern  — editor (this redirect's destination)
//
// Keeping a redirect rather than a 404 so deep-links (notification taps,
// older share links, the now-removed Family Hub Manage row) keep working
// during transition. Per the README "Route placement" section's caveat:
// `Avoid /settings/custody — that name strongly implies a schedule-viewing
// page, which it isn't anymore.`

import { Redirect } from 'expo-router';

export default function CustodySettingsRedirect() {
    return <Redirect href="/custody/pattern" />;
}
