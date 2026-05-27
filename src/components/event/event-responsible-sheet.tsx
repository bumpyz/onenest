// EventResponsibleSheet — the multi-select picker that opens when the user
// taps the Responsible row in EventDetailMulti or any chip in its rack.
//
// Design source: screens-event-edit.jsx:548-684 (EventResponsibleSheet).
// Behavior crib:
//   - Multi-select rows (square checkboxes, NOT radios). Tagging = visibility.
//   - Row order: selected first, then unselected co-parents, then unselected
//     externals, then unselected caregivers; alphabetical within each band.
//   - Role chips inline: LEAD (accent), EXT (neutral), CARE (warn).
//   - "Tagging = visibility." footer card — dashed border, eye icon.
//   - Lead picker row at the bottom — caps "LEAD" label + inset card showing
//     current lead's avatar + name + sub. Tapping cycles the lead through
//     currently-selected rows. The lead must be one of the selected.
//   - Primary: "Save · N selected". Secondary: "Clear" (we'd want a confirm
//     for this in v2; for now Clear just deselects everyone visually and
//     the user has to confirm by tapping Save).
//
// Data model crib:
//   - External co-parents are not yet a first-class type in this codebase
//     (the design's `external: true` row is a future-data hook). This pass
//     shows only household members + caregivers. The EXT chip and "External"
//     sub copy render when we get the data; for now the rendering branch
//     stays dormant.
//   - Single-select for the lead is enforced inside the sheet — the picker
//     only lets you set lead to a profile that's currently selected.

import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MemberAvatar } from '@/components/ds/member-avatar';
import {
    type ResponsibleChipNote,
} from '@/components/ds/responsible-chip';
import { SheetShell } from '@/components/ds/sheet-shell';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import type { HouseholdMember } from '@/lib/db';
import { useAppColorScheme } from '@/providers/theme-provider';

// Same alpha helper as ResponsibleChip — keep the design's "+ '0e'" / "+ '18'"
// tokens valid against any hex color.
function withAlpha(hex: string, aa: string): string {
    if (!hex.startsWith('#')) return hex;
    const body = hex.slice(1);
    const expanded =
        body.length === 3
            ? body
                  .split('')
                  .map((c) => c + c)
                  .join('')
            : body.length === 6
              ? body
              : body.slice(0, 6);
    return `#${expanded}${aa}`;
}

/** What the picker emits when the user saves. */
export type EventResponsibleSheetSelection = {
    /** Selected profile ids, in the order the rows were rendered (selected
     *  band first). The caller should persist this list as-is; lead-position
     *  inside the list is decided by `leadProfileId`. */
    profileIds: string[];
    /** Profile id of the row marked LEAD in the picker. Always one of the
     *  selected `profileIds` (enforced by the sheet itself). Null only when
     *  the selection is empty, which the picker disallows on save unless
     *  the caller's onSave accepts it. */
    leadProfileId: string | null;
};

/** Per-row sub-text resolver — caller decides the copy that appears under
 *  each name. Lets the sheet host context-dependent text ("active 3h ago",
 *  "with the kids this week") without baking the strings into the picker. */
type RowSubResolver = (member: HouseholdMember) => string | undefined;

type Row = {
    member: HouseholdMember;
    selected: boolean;
    lead: boolean;
    /** What kind of note chip to render. caregiver = CARE; external = EXT.
     *  Plain parents get no chip; the lead row gets LEAD regardless of role. */
    note: ResponsibleChipNote | null;
    sub: string | undefined;
};

export function EventResponsibleSheet({
    open,
    onClose,
    members,
    currentSelection,
    currentLeadProfileId,
    onSave,
    /** Optional per-row sub-text resolver. Falls back to a generic role label
     *  ("Co-parent" / "Caregiver") when no resolver is supplied. */
    rowSub,
    /** Disabling Save until the user toggles something is too restrictive
     *  (re-confirming the same set should still write). We disable only
     *  when the selection is empty AND the parent doesn't allow empty
     *  saves (the picker's invariant). */
    allowEmpty = false,
}: {
    open: boolean;
    onClose: () => void;
    members: HouseholdMember[];
    /** Currently-tagged profile ids (event.responsibles → profile_id[]). */
    currentSelection: string[];
    /** Currently-flagged lead. Picker pre-fills this. */
    currentLeadProfileId: string | null;
    onSave: (sel: EventResponsibleSheetSelection) => void;
    rowSub?: RowSubResolver;
    allowEmpty?: boolean;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [selected, setSelected] = useState<Set<string>>(
        () => new Set(currentSelection),
    );
    const [leadId, setLeadId] = useState<string | null>(
        currentLeadProfileId ?? currentSelection[0] ?? null,
    );

    // Re-sync local state ONLY when the sheet transitions from closed →
    // open. The previous version listed `currentSelection` and
    // `currentLeadProfileId` in the deps array, which meant a parent
    // refetch (network reconnect, navigation focus, or any change that
    // produced a new currentSelection ref) would re-run the effect mid-
    // edit and blow away the user's in-progress toggles. QA-found bug —
    // "EventResponsibleSheet re-syncs over in-progress edits while
    // open." We capture the latest props in refs and read them at the
    // moment of the open transition so the seed is still fresh without
    // listening to subsequent changes.
    const currentSelectionRef = useRef(currentSelection);
    const currentLeadProfileIdRef = useRef(currentLeadProfileId);
    currentSelectionRef.current = currentSelection;
    currentLeadProfileIdRef.current = currentLeadProfileId;
    useEffect(() => {
        if (!open) return;
        const seed = currentSelectionRef.current;
        const lead = currentLeadProfileIdRef.current;
        setSelected(new Set(seed));
        setLeadId(lead ?? seed[0] ?? null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Re-bucket rows on every selection change: selected first, then
    // co-parents (parent role), then externals (currently dormant), then
    // caregivers. Alphabetical within each band.
    const rows = useMemo<Row[]>(() => {
        const enriched = members.map((m) => {
            const isCaregiver = m.role === 'caregiver';
            const isSelected = selected.has(m.profile_id);
            const isLead = leadId === m.profile_id;
            return {
                member: m,
                selected: isSelected,
                lead: isLead,
                note: (isLead
                    ? ('LEAD' as const)
                    : isCaregiver
                      ? ('CARE' as const)
                      : null) as ResponsibleChipNote | null,
                sub:
                    rowSub?.(m) ??
                    (isCaregiver ? 'Caregiver' : 'Co-parent'),
            };
        });
        // Bucket: selected first; within unselected, parents → caregivers.
        const cmp = (a: Row, b: Row) =>
            (a.member.display_name ?? '').localeCompare(
                b.member.display_name ?? '',
            );
        const selRows = enriched.filter((r) => r.selected).sort(cmp);
        const unselParents = enriched
            .filter((r) => !r.selected && r.member.role !== 'caregiver')
            .sort(cmp);
        const unselCare = enriched
            .filter((r) => !r.selected && r.member.role === 'caregiver')
            .sort(cmp);
        return [...selRows, ...unselParents, ...unselCare];
    }, [members, selected, leadId, rowSub]);

    const leadMember = useMemo(
        () =>
            leadId ? members.find((m) => m.profile_id === leadId) ?? null : null,
        [leadId, members],
    );

    const toggle = (profileId: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(profileId)) {
                next.delete(profileId);
                // If we just removed the lead, re-pick from the remaining
                // selected — first by insertion order (which is a Set's
                // iteration order). Null if no one remains.
                if (profileId === leadId) {
                    const first = next.values().next().value as
                        | string
                        | undefined;
                    setLeadId(first ?? null);
                }
            } else {
                next.add(profileId);
                // First selection becomes the lead automatically — matches
                // the design's "default = first added" semantic.
                if (!leadId) setLeadId(profileId);
            }
            return next;
        });
    };

    const cycleLead = () => {
        // Advance the lead through the currently-selected rows in order.
        // Tapping the lead picker repeatedly walks through Alex → Riley →
        // Casey → Alex on a 3-selected event. Simpler than a nested picker
        // for the MVP; we can swap to a single-select sub-sheet later.
        const selList = Array.from(selected);
        if (selList.length === 0) return;
        const idx = leadId ? selList.indexOf(leadId) : -1;
        const next = selList[(idx + 1) % selList.length];
        setLeadId(next);
    };

    const handleClear = () => {
        setSelected(new Set());
        setLeadId(null);
    };

    const handleSave = () => {
        const sel = Array.from(selected);
        if (sel.length === 0 && !allowEmpty) {
            // Disabled state should usually prevent this, but defend
            // against double-fire by just no-op'ing.
            return;
        }
        onSave({
            profileIds: sel,
            leadProfileId: leadId && sel.includes(leadId) ? leadId : (sel[0] ?? null),
        });
    };

    const saveDisabled = !allowEmpty && selected.size === 0;

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title="Responsible"
            sub="Anyone tagged here sees the full event — title, location, notes, attached tasks."
            primary={`Save · ${selected.size} selected`}
            secondary="Clear"
            onPrimary={handleSave}
            onSecondary={handleClear}
            primaryDisabled={saveDisabled}
            height={620}>
            {/* List card — single rounded card with hairline dividers between
                rows. Selected rows get a subtle accent tint background.
                Matches screens-event-edit.jsx:572-640. */}
            <View
                style={[
                    styles.listCard,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                <ScrollView nestedScrollEnabled style={{ flexGrow: 0 }}>
                    {rows.map((r, i) => {
                        const isLast = i === rows.length - 1;
                        const memberColor = r.member.color ?? colors.inkFaint;
                        return (
                            <Pressable
                                key={r.member.profile_id}
                                onPress={() => toggle(r.member.profile_id)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: r.selected }}
                                accessibilityLabel={`${r.member.display_name}${
                                    r.lead ? ', lead' : ''
                                }`}
                                style={({ pressed }) => [
                                    styles.row,
                                    {
                                        backgroundColor: r.selected
                                            ? withAlpha(colors.accent, '0e')
                                            : 'transparent',
                                        borderBottomColor: colors.hair,
                                        borderBottomWidth: isLast
                                            ? 0
                                            : StyleSheet.hairlineWidth,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <MemberAvatar
                                    name={r.member.display_name}
                                    color={memberColor}
                                    size="lg"
                                />
                                <View style={styles.rowBody}>
                                    <View style={styles.rowTitleLine}>
                                        <ThemedText
                                            style={[
                                                styles.rowName,
                                                { color: colors.text },
                                            ]}
                                            numberOfLines={1}>
                                            {r.member.display_name}
                                        </ThemedText>
                                        {r.lead ? (
                                            <RoleChip
                                                label="LEAD"
                                                color={colors.accent}
                                                bg={withAlpha(colors.accent, '18')}
                                            />
                                        ) : null}
                                        {r.note === 'CARE' ? (
                                            <RoleChip
                                                label="CARE"
                                                color={colors.warn}
                                                bg={withAlpha(colors.warn, '18')}
                                            />
                                        ) : null}
                                        {r.note === 'EXT' ? (
                                            <RoleChip
                                                label="EXT"
                                                // Design source line 609 uses
                                                // `C.inkMuted` (≈ our
                                                // textSecondary), not inkSec.
                                                color={colors.textSecondary}
                                                bg={colors.backgroundElement}
                                                borderColor={colors.hair}
                                            />
                                        ) : null}
                                    </View>
                                    {r.sub ? (
                                        <ThemedText
                                            style={[
                                                styles.rowSub,
                                                {
                                                    // Design source line 621
                                                    // uses `C.inkMuted` for the
                                                    // mono sub-text (lighter than
                                                    // our inkSec). textSecondary
                                                    // maps to inkMuted in our
                                                    // theme.
                                                    color: colors.textSecondary,
                                                    fontFamily:
                                                        FontFamily.monoRegular,
                                                },
                                            ]}
                                            numberOfLines={1}>
                                            {r.sub}
                                        </ThemedText>
                                    ) : null}
                                </View>
                                {/* Checkbox — 22x22 square, radius 6.
                                    Selected: accent fill + white check.
                                    Unselected: 1.5px inkFaint border. */}
                                <View
                                    style={[
                                        styles.checkbox,
                                        {
                                            borderColor: r.selected
                                                ? colors.accent
                                                : colors.inkFaint,
                                            backgroundColor: r.selected
                                                ? colors.accent
                                                : 'transparent',
                                        },
                                    ]}>
                                    {r.selected ? (
                                        <Feather
                                            name="check"
                                            size={13}
                                            color={colors.onAccent}
                                        />
                                    ) : null}
                                </View>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Footer card — "Tagging = visibility." rule, stated directly.
                Dashed 0.5px hairline border, eye icon in accent. Padding
                10/12 per spec. */}
            <View
                style={[
                    styles.rule,
                    {
                        borderColor: colors.hair,
                    },
                ]}>
                <Feather
                    name="eye"
                    size={14}
                    color={colors.accent}
                    style={styles.ruleIcon}
                />
                <ThemedText
                    style={[
                        styles.ruleText,
                        { color: colors.inkSec },
                    ]}>
                    <ThemedText
                        style={[
                            styles.ruleLead,
                            { color: colors.text },
                        ]}>
                        Tagging = visibility.
                    </ThemedText>{' '}
                    Anyone selected here sees the full event across both their
                    homes. Untagged co-parents and caregivers see just &ldquo;Busy&rdquo;
                    in that time slot.
                </ThemedText>
            </View>

            {/* Lead picker — mono caps label + inset card. Tapping cycles
                the lead through the currently-selected rows. */}
            <ThemedText
                style={[
                    styles.leadLabel,
                    {
                        color: colors.inkSec,
                        fontFamily: FontFamily.monoRegular,
                    },
                ]}>
                LEAD
            </ThemedText>
            <Pressable
                onPress={cycleLead}
                disabled={selected.size === 0}
                accessibilityRole="button"
                accessibilityLabel="Cycle lead responsible"
                style={({ pressed }) => [
                    styles.leadCard,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                    selected.size === 0 && { opacity: 0.5 },
                    pressed && styles.pressed,
                ]}>
                {leadMember ? (
                    <MemberAvatar
                        name={leadMember.display_name}
                        color={leadMember.color ?? colors.inkFaint}
                        // 22px — design source line 668. Matches the
                        // picker's vertical rhythm; 'md' (24) was off by 2.
                        size="pickerLead"
                    />
                ) : (
                    <View
                        style={[
                            styles.leadEmpty,
                            { borderColor: colors.inkFaint },
                        ]}>
                        <ThemedText
                            style={{
                                color: colors.inkFaint,
                                fontSize: 10,
                                fontWeight: '600',
                            }}>
                            ?
                        </ThemedText>
                    </View>
                )}
                <View style={styles.leadBody}>
                    <ThemedText
                        style={[
                            styles.leadName,
                            { color: colors.text },
                        ]}
                        numberOfLines={1}>
                        {leadMember?.display_name ?? 'No lead'}
                    </ThemedText>
                    <ThemedText
                        style={[
                            styles.leadSub,
                            { color: colors.inkSec },
                        ]}
                        numberOfLines={2}>
                        Gets the LEAD chip · receives the primary push when
                        reminders fire
                    </ThemedText>
                </View>
                <Feather
                    name="chevron-right"
                    size={14}
                    color={colors.inkFaint}
                />
            </Pressable>
        </SheetShell>
    );
}

/** Inline mini role chip — LEAD / EXT / CARE next to a row's name. */
function RoleChip({
    label,
    color,
    bg,
    borderColor,
}: {
    label: string;
    color: string;
    bg: string;
    borderColor?: string;
}) {
    return (
        <View
            style={[
                styles.roleChip,
                {
                    backgroundColor: bg,
                    borderColor: borderColor ?? 'transparent',
                    borderWidth: borderColor ? StyleSheet.hairlineWidth : 0,
                },
            ]}>
            <ThemedText
                style={[
                    styles.roleChipText,
                    { color, fontFamily: FontFamily.monoRegular },
                ]}>
                {label}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    listCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        // 12px gap to the rule card below (design source line 572:
        // `marginBottom: 12`). Spacing.two is 8 in our scale — too tight.
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitleLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    rowName: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    rowSub: {
        fontSize: 10.5,
        marginTop: 1,
        letterSpacing: -0.2,
    },
    roleChip: {
        paddingHorizontal: 5,
        paddingTop: 1,
        paddingBottom: 1,
        borderRadius: 3,
    },
    roleChipText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    rule: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 10,
    },
    ruleIcon: { marginTop: 1 },
    ruleText: {
        flex: 1,
        fontSize: 11.5,
        // Design source line 651: lineHeight 1.45 × 11.5 ≈ 16.7. Round up
        // to 17; 16 cropped the descenders by ~0.7px on multi-line copy.
        lineHeight: 17,
    },
    ruleLead: {
        fontWeight: '600',
    },
    leadLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        paddingTop: 4,
        paddingBottom: 6,
        paddingHorizontal: 4,
    },
    leadCard: {
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    leadEmpty: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    leadBody: { flex: 1, minWidth: 0 },
    leadName: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    leadSub: {
        fontSize: 11,
        marginTop: 1,
        lineHeight: 15,
    },
    pressed: { opacity: 0.7 },
});
