// ResponsibleChip — the small per-person pill used in the EventDetailMulti
// chip rack. Background = member.color + '22', border = member.color + '55'
// (0.5px). Left: 20px MemberAvatar. Middle: name 12.5 / 600. Right:
// optional caps-mono note tag — LEAD (accent), EXT (neutral), CARE (warn).
//
// Design source: screens-event-edit.jsx:504-531. The original `<note>` prop
// is a free-form string ("lead"); we type it explicitly here so callers
// can't pass arbitrary copy that drifts the visual language.
//
// AddPersonChip lives in the same file because it shares the rack and
// nowhere else uses it on its own. Dashed `+ Add` chip, transparent
// background, opens EventResponsibleSheet on press.

import { Pressable, StyleSheet, View } from 'react-native';

import { MemberAvatar } from '@/components/ds/member-avatar';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

// hex+alpha helper: keeps the design's "color + '22'" tokens valid even
// when the underlying member color is an #RGB or #RRGGBB string. Adding
// the alpha bytes onto a 4-char hex would produce an invalid value.
function withAlpha(hex: string, aa: string): string {
    if (!hex.startsWith('#')) return hex;
    // Normalize #RGB → #RRGGBB
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

export type ResponsibleChipNote = 'LEAD' | 'EXT' | 'CARE';

export function ResponsibleChip({
    name,
    color,
    note,
    onPress,
}: {
    /** Member display name — first letter goes into the avatar, full text in
     *  the chip label. */
    name: string;
    /** Member's stored color hex. Background and border both derive from
     *  this via alpha blends. */
    color: string;
    /** Optional caps tag rendered on the right: LEAD (accent), EXT (neutral),
     *  CARE (warn — caregivers, matching the existing visual language). */
    note?: ResponsibleChipNote;
    /** Optional tap handler — opens EventResponsibleSheet when wired from
     *  the chip rack. Without it the chip renders as a static pill. */
    onPress?: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Note styling — the design source (screens-event-edit.jsx:517-522)
    // uses a SINGLE neutral treatment for LEAD/EXT/CARE in the chip rack:
    // `color: inkMuted, background: card + 'AA', fontWeight: 700`. The
    // accent/warn-colored role chips with tinted backgrounds belong to
    // the picker SHEET rows, not these per-event chips. Keeping all three
    // note kinds visually equal here preserves the rack's chromatic
    // calm — the chip itself already carries the person's identity color
    // (background + border). The note is just a tag.
    const noteColor = colors.textSecondary;
    const noteBg = withAlpha(colors.backgroundElement, 'AA');

    const body = (
        <View
            style={[
                styles.chip,
                {
                    backgroundColor: withAlpha(color, '22'),
                    borderColor: withAlpha(color, '55'),
                },
            ]}>
            <MemberAvatar name={name} color={color} size="chip" />
            <ThemedText
                style={[styles.label, { color: colors.text }]}
                numberOfLines={1}>
                {name}
            </ThemedText>
            {note ? (
                <View
                    style={[
                        styles.note,
                        {
                            backgroundColor: noteBg,
                        },
                    ]}>
                    <ThemedText
                        style={[
                            styles.noteText,
                            {
                                color: noteColor,
                                fontFamily: FontFamily.monoRegular,
                            },
                        ]}>
                        {note}
                    </ThemedText>
                </View>
            ) : null}
        </View>
    );

    if (!onPress) return body;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={
                note ? `${name}, tagged as ${note.toLowerCase()}` : name
            }
            style={({ pressed }) => [pressed && styles.pressed]}>
            {body}
        </Pressable>
    );
}

export function AddPersonChip({ onPress }: { onPress?: () => void }) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const body = (
        <View
            style={[
                styles.addChip,
                {
                    borderColor: colors.inkFaint,
                },
            ]}>
            <ThemedText
                style={[
                    styles.addLabel,
                    {
                        // Match design source line 539 — `C.inkMuted` (lighter).
                        // Our equivalent is `textSecondary`; `inkSec` is darker
                        // and over-emphasizes a passive affordance.
                        color: colors.textSecondary,
                        fontFamily: FontFamily.monoRegular,
                    },
                ]}>
                + Add
            </ThemedText>
        </View>
    );

    if (!onPress) return body;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="Add responsible person"
            style={({ pressed }) => [pressed && styles.pressed]}>
            {body}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: 4,
        paddingRight: 9,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    label: {
        fontSize: 12.5,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    note: {
        paddingTop: 1,
        paddingBottom: 1,
        paddingHorizontal: 5,
        borderRadius: 3,
    },
    noteText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    addChip: {
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: 'dashed',
        backgroundColor: 'transparent',
    },
    addLabel: {
        fontSize: 11,
        letterSpacing: -0.1,
    },
    pressed: { opacity: 0.7 },
});
