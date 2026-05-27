# Design fidelity

When creating or modifying any user-facing view:

1. **Treat the design source as the spec, not as inspiration.** The mockups in
   `docs/design-handoffs/settings-subroutes-v2/` (`direction-c-pro.jsx`,
   `screens-extra*.jsx`, `screens-settings.jsx`, `app.jsx`) are canonical.
   Match the design exactly — paddings, type sizes, weights, letter-spacing,
   colors, layout order, copy. Don't simplify away affordances because they're
   inconvenient to build, and don't add affordances the design doesn't show.

2. **After every view is implemented, spawn a UX-fidelity agent to audit it
   against the design source.** The agent's role is to advocate for absolute
   design fidelity. Brief it with the implementation path AND the relevant
   design-source ranges, and ask it to flag every deviation. Only accept a
   deviation when:
   - It's genuinely unresolvable (platform limitation, missing data, etc.), OR
   - The user has explicitly approved it in chat.

   If the agent surfaces deviations that fit neither bucket, fix them before
   marking the work done.

3. **If a spec is missing or ambiguous, stop and ask.** Don't guess at
   intent. Better to pause and clarify than to ship something that has to
   be re-litigated.

4. **Write for scalability and modularity.** Lift repeated patterns into
   shared components, name design tokens (don't inline hex / magic numbers),
   keep data / state / presentation in clear layers. The bar: a future
   change to the design system should be a small diff in shared code, not
   a hunt-and-replace across screens.

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.
