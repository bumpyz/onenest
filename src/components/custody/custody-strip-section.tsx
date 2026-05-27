// CustodyStripSection — Today-screen wrapper around CustodyStripToday that
// resolves viewer role + renders the right variant(s).
//
// Three cases:
//
//   1. Co-parent of the current household        → one default strip
//   2. Caregiver of the current household        → one caregiver strip
//   3. External co-parent of one or more kids in
//      the current household (or any household
//      when the viewer has no membership)        → stacked per-kid
//                                                  external strips,
//                                                  collapsed past 2
//                                                  with "+ N more kid"
//
// External resolution runs orthogonally to membership. A profile can be
// both a member of household A AND external to a kid in household B —
// they'd see one strip for each, stacked top-to-bottom.
//
// Caller (Today screen) passes the household the user has currently
// selected. The wrapper handles the rest, including the empty case
// (viewer has no role anywhere → renders nothing).

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import {
    getMyExternalCoparentLinks,
} from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

import { CustodyStripToday, type StripViewer } from './custody-strip-today';

/** README decision Q2 — show first 2 external strips, collapse 3+ behind
 *  a "+ N more kid" toggle. Threshold is module-level so the collapse
 *  copy can read "+ 1 more kid" / "+ 2 more kids" with correct
 *  pluralization downstream. */
const EXTERNAL_COLLAPSE_THRESHOLD = 2;

type ExternalLink = {
    child_id: string;
    household_id: string;
    color: string | null;
    child_display_name: string;
    child_color: string;
};

export function CustodyStripSection({
    householdId,
}: {
    /** Household the Today screen is currently viewing. May be undefined
     *  when the viewer has no household membership (purely-external
     *  case). */
    householdId: string | undefined;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const { user } = useAuth();
    const { members } = useHouseholdMembers(householdId);

    // Resolve the viewer's role in the current household. Defaults to
    // 'coparent' so the existing parent-in-household path stays the
    // common case. A null role means "not a member of this household"
    // — only the external strips will render.
    const myRole = useMemo<StripViewer | null>(() => {
        if (!user || !members) return null;
        const me = members.find((m) => m.profile_id === user.id);
        if (!me) return null;
        if (me.role === 'caregiver') return 'caregiver';
        if (me.role === 'viewer') return 'caregiver'; // observer-shaped
        return 'coparent';
    }, [user, members]);

    // External co-parent links. Loaded once for the viewer, then
    // filtered by current householdId so the section only renders
    // strips that belong to the Today-screen's household context.
    // Other households' external links would appear when the user
    // switches households (a future multi-household selector lands).
    const [externalLinks, setExternalLinks] = useState<ExternalLink[]>(
        [],
    );
    const [externalLoaded, setExternalLoaded] = useState(false);
    useEffect(() => {
        let cancelled = false;
        getMyExternalCoparentLinks()
            .then((rows) => {
                if (cancelled) return;
                setExternalLinks(rows);
                setExternalLoaded(true);
            })
            .catch(() => {
                // Errors here are non-fatal — the section renders
                // without external strips if the link query fails.
                if (cancelled) return;
                setExternalLinks([]);
                setExternalLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Scope external links to the household whose Today screen we're
    // on. A future multi-household viewer would relax this filter.
    const scopedLinks = useMemo(
        () =>
            externalLinks.filter((l) => l.household_id === householdId),
        [externalLinks, householdId],
    );

    const [showAllExternal, setShowAllExternal] = useState(false);
    const visibleLinks =
        showAllExternal || scopedLinks.length <= EXTERNAL_COLLAPSE_THRESHOLD
            ? scopedLinks
            : scopedLinks.slice(0, EXTERNAL_COLLAPSE_THRESHOLD);
    const hiddenCount = scopedLinks.length - visibleLinks.length;

    // Nothing to render — no role + no external links. Caller (Today
    // screen) intentionally renders this component unconditionally;
    // the wrapper is responsible for the "render nothing" decision.
    if (!myRole && !externalLoaded) return null;
    if (!myRole && scopedLinks.length === 0) return null;

    return (
        <View>
            {/* Primary strip — co-parent or caregiver perspective on
                the current household. Skipped when the viewer has no
                membership (purely-external case). */}
            {myRole ? (
                <CustodyStripToday
                    householdId={householdId}
                    viewer={myRole}
                />
            ) : null}

            {/* Stacked external strips — one per linked kid in this
                household. Padding 0 between strips' outer wrappers
                because each CustodyStripToday provides its own
                paddingHorizontal/paddingBottom; only the "+ N more"
                row needs explicit spacing. */}
            {visibleLinks.map((link) => (
                <CustodyStripToday
                    key={link.child_id}
                    householdId={link.household_id}
                    viewer="external"
                    childId={link.child_id}
                    externalViewerColor={link.color}
                />
            ))}

            {/* "+ N more kid" collapse — README Q2. Only renders when
                the external viewer has 3+ shared kids in this household
                AND hasn't already expanded. Tapping toggles to "Show
                fewer" (also via the same Pressable). */}
            {hiddenCount > 0 ? (
                <View style={styles.moreWrap}>
                    <Pressable
                        onPress={() => setShowAllExternal(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`Show ${hiddenCount} more ${hiddenCount === 1 ? 'kid' : 'kids'}`}
                        style={({ pressed }) => [
                            styles.moreBtn,
                            { borderColor: colors.hair },
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            style={[
                                styles.moreLabel,
                                {
                                    color: colors.inkSec,
                                    fontFamily:
                                        FontFamily.monoSemiBold,
                                },
                            ]}>
                            + {hiddenCount} MORE{' '}
                            {hiddenCount === 1 ? 'KID' : 'KIDS'}
                        </ThemedText>
                    </Pressable>
                </View>
            ) : null}
            {showAllExternal && scopedLinks.length > EXTERNAL_COLLAPSE_THRESHOLD ? (
                <View style={styles.moreWrap}>
                    <Pressable
                        onPress={() => setShowAllExternal(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Show fewer"
                        style={({ pressed }) => [
                            styles.moreBtn,
                            { borderColor: colors.hair },
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            style={[
                                styles.moreLabel,
                                {
                                    color: colors.inkSec,
                                    fontFamily:
                                        FontFamily.monoSemiBold,
                                },
                            ]}>
                            SHOW FEWER
                        </ThemedText>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    moreWrap: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        marginTop: -8, // pull up under the last strip's paddingBottom
    },
    moreBtn: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
    },
    moreLabel: {
        fontSize: 10,
        letterSpacing: 0.3,
    },
    pressed: { opacity: 0.7 },
});
