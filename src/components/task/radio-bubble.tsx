// RadioBubble — 20×20 round radio used in the task field-edit sheets
// (Reminder, Recurring, Priority, Assign). 1.5px border, accent fill when
// selected, white check inside. Square variant lives elsewhere (used by
// the Lists / Children multi-select sheets).
//
// Lifted into its own component because every sheet renders one per row;
// inlining the SVG five times per sheet noised up the JSX. Pure-render —
// no state, no platform branches.

import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

export function RadioBubble({
    selected,
    accentColor,
    onAccentColor,
    inactiveColor,
}: {
    selected: boolean;
    /** Border + fill color when selected. */
    accentColor: string;
    /** Color of the check glyph drawn over the accent fill. */
    onAccentColor: string;
    /** Border color when NOT selected. Usually the theme's inkFaint. */
    inactiveColor: string;
}) {
    return (
        <View
            style={[
                styles.bubble,
                {
                    borderColor: selected ? accentColor : inactiveColor,
                    backgroundColor: selected ? accentColor : 'transparent',
                },
            ]}>
            {selected ? (
                <Feather name="check" size={11} color={onAccentColor} />
            ) : null}
        </View>
    );
}

/**
 * SquareCheck — 20×20 with 5px radius. Multi-select variant used by
 * ListsSheet and ChildrenSheet per the design (screens-task-edit.jsx
 * ListsSheet ~977-988, ChildrenSheet ~1039-1050).
 */
export function SquareCheck({
    selected,
    accentColor,
    onAccentColor,
    inactiveColor,
}: {
    selected: boolean;
    accentColor: string;
    onAccentColor: string;
    inactiveColor: string;
}) {
    return (
        <View
            style={[
                styles.square,
                {
                    borderColor: selected ? accentColor : inactiveColor,
                    backgroundColor: selected ? accentColor : 'transparent',
                },
            ]}>
            {selected ? (
                <Feather name="check" size={12} color={onAccentColor} />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    bubble: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    square: {
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
});
