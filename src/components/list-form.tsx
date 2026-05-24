// Shared add / edit form for task lists. Used by /list/new and /list/[id], mirroring
// the ChildForm pattern. Name is required; color is picker-driven (palette swatches)
// with the DB trigger filling in a default on create.
//
// The "Inbox" default list is special: the parent screen passes isDefault=true and we
// disable the delete button (the auto-default-task trigger expects an Inbox to exist
// per household). Renaming and color changes are still allowed — Inbox is a UX label,
// not an immutable system row.

import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { LIST_PALETTE } from '@/lib/colors';
import { errorMessage } from '@/lib/errors';
import { useAppColorScheme } from '@/providers/theme-provider';

export type ListFormValues = {
    name: string;
    /**
     * Hex #RRGGBB. Null on create (the DB trigger picks one) or when the user hasn't
     * touched the palette yet; a real hex on edit (preloaded from the row).
     */
    color: string | null;
};

export type ListFormSubmit = {
    name: string;
    color: string | null;
};

type Props = {
    headerTitle: string;
    submitLabel?: string;
    initialValues: ListFormValues;
    /**
     * True when editing the household's default Inbox list. Suppresses the delete
     * button; the auto-default-task trigger relies on Inbox existing.
     */
    isDefault?: boolean;
    /**
     * Open task count on this list. Used to customize the delete confirmation copy so
     * the user knows what's about to happen to their tasks before they confirm. Pass
     * undefined for create flows (no count to show).
     */
    taskCount?: number;
    /**
     * UX-010 native chip-reorder path. The Lists tab's drag-to-reorder only works on
     * web (pointer-event based). On any platform, these callbacks expose an
     * equivalent "Move up" / "Move down" affordance from inside the edit screen.
     * Pass undefined for create flows or for Inbox (which is pinned at index 0).
     */
    onMoveUp?: () => Promise<void>;
    onMoveDown?: () => Promise<void>;
    onSubmit: (input: ListFormSubmit) => Promise<void>;
    onDelete?: () => Promise<void>;
    onCancel: () => void;
};

export function ListForm({
    headerTitle,
    submitLabel = 'Save',
    initialValues,
    isDefault = false,
    taskCount,
    onMoveUp,
    onMoveDown,
    onSubmit,
    onDelete,
    onCancel,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [name, setName] = useState(initialValues.name);
    const [color, setColor] = useState<string | null>(initialValues.color);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [moving, setMoving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const busy = submitting || deleting || moving;
    const canSubmit = name.trim().length > 0 && !busy;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            await onSubmit({ name: name.trim(), color });
        } catch (err) {
            console.error('list submit failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't save", msg);
            setSubmitting(false);
        }
    };

    /** UX-010: shared handler for the Move up / Move down buttons. Wraps the parent's
     *  swap callback with busy-state + error reporting so the form behaves like the
     *  rest of its actions. */
    const handleMove = async (direction: 'up' | 'down') => {
        const fn = direction === 'up' ? onMoveUp : onMoveDown;
        if (!fn || busy) return;
        setMoving(true);
        setError(null);
        try {
            await fn();
        } catch (err) {
            console.error(`list move ${direction} failed`, err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't reorder", msg);
        } finally {
            setMoving(false);
        }
    };

    const handleDelete = async () => {
        if (!onDelete || busy) return;
        // Tailor the copy to whether there's actually anything at risk. Empty lists
        // get a terse confirm; lists with open tasks spell out the Inbox-fallback
        // semantic so the user isn't surprised. We use open count specifically (not
        // total) — completed tasks falling back to Inbox is also true but uninteresting
        // to mention as a warning.
        const count = taskCount ?? 0;
        const title = 'Delete this list?';
        const detail =
            count > 0
                ? `This list has ${count} open task${count === 1 ? '' : 's'}. They'll move to Inbox — not deleted.`
                : "It's empty, so nothing else will change.";
        const confirmed =
            Platform.OS === 'web'
                ? typeof window !== 'undefined' &&
                  window.confirm(`${title}\n\n${detail}`)
                : await new Promise<boolean>((resolve) => {
                      Alert.alert(title, detail, [
                          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
                      ]);
                  });
        if (!confirmed) return;
        setDeleting(true);
        setError(null);
        try {
            await onDelete();
        } catch (err) {
            console.error('list delete failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't delete", msg);
            setDeleting(false);
        }
    };

    const inputStyle = {
        color: colors.text,
        borderColor: colors.backgroundSelected,
        borderWidth: 1,
        borderRadius: Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        fontSize: 16,
        height: 44,
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.headerBar}>
                    <Pressable
                        onPress={onCancel}
                        disabled={busy}
                        style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
                        <ThemedText themeColor="textSecondary">Cancel</ThemedText>
                    </Pressable>
                    <ThemedText type="smallBold">{headerTitle}</ThemedText>
                    <Pressable
                        onPress={handleSubmit}
                        disabled={!canSubmit}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            pressed && canSubmit && styles.pressed,
                        ]}>
                        <ThemedText
                            style={{
                                color: canSubmit ? '#6F7FA5' : colors.textSecondary,
                                fontWeight: '600',
                            }}>
                            {submitting ? 'Saving…' : submitLabel}
                        </ThemedText>
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled">
                    {/* Live preview of the list chip so the user can see how it'll look
                        in the tab strip before saving. */}
                    <View style={styles.previewRow}>
                        <View
                            style={[
                                styles.previewChip,
                                {
                                    backgroundColor: color ?? LIST_PALETTE[0],
                                    borderColor: colors.backgroundSelected,
                                },
                            ]}>
                            <ThemedText type="small" style={styles.previewChipText}>
                                {name.trim() || 'List name'}
                            </ThemedText>
                        </View>
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Name</ThemedText>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Groceries"
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle}
                            autoFocus
                            autoCapitalize="words"
                            editable={!busy}
                        />
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Color</ThemedText>
                        <View style={styles.swatchRow}>
                            {LIST_PALETTE.map((c) => {
                                const selected = color === c;
                                return (
                                    <Pressable
                                        key={c}
                                        onPress={() => setColor(c)}
                                        disabled={busy}
                                        style={({ pressed }) => [
                                            styles.swatch,
                                            {
                                                backgroundColor: c,
                                                borderColor: selected
                                                    ? colors.text
                                                    : 'transparent',
                                            },
                                            pressed && styles.pressed,
                                        ]}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    {/* UX-010: Move up / Move down for native users (and as a
                        keyboard-accessible alternative to drag on web). The parent
                        only passes callbacks when the move is valid at the
                        current position, so undefined → button disabled. Inbox
                        gets neither callback (pinned at index 0). */}
                    {onMoveUp || onMoveDown ? (
                        <View style={styles.field}>
                            <ThemedText type="smallBold">Order</ThemedText>
                            <View style={styles.moveRow}>
                                <Pressable
                                    onPress={() => handleMove('up')}
                                    disabled={!onMoveUp || busy}
                                    accessibilityRole="button"
                                    accessibilityLabel="Move list up"
                                    accessibilityState={{ disabled: !onMoveUp || busy }}
                                    style={({ pressed }) => [
                                        styles.moveBtn,
                                        {
                                            borderColor: colors.backgroundSelected,
                                            opacity: !onMoveUp || busy ? 0.4 : 1,
                                        },
                                        pressed && onMoveUp && !busy && styles.pressed,
                                    ]}>
                                    <ThemedText type="small" style={styles.moveBtnText}>
                                        ↑ Move up
                                    </ThemedText>
                                </Pressable>
                                <Pressable
                                    onPress={() => handleMove('down')}
                                    disabled={!onMoveDown || busy}
                                    accessibilityRole="button"
                                    accessibilityLabel="Move list down"
                                    accessibilityState={{ disabled: !onMoveDown || busy }}
                                    style={({ pressed }) => [
                                        styles.moveBtn,
                                        {
                                            borderColor: colors.backgroundSelected,
                                            opacity: !onMoveDown || busy ? 0.4 : 1,
                                        },
                                        pressed && onMoveDown && !busy && styles.pressed,
                                    ]}>
                                    <ThemedText type="small" style={styles.moveBtnText}>
                                        ↓ Move down
                                    </ThemedText>
                                </Pressable>
                            </View>
                        </View>
                    ) : null}

                    {error ? (
                        <ThemedText type="small" style={styles.errorText}>
                            {error}
                        </ThemedText>
                    ) : null}

                    {onDelete && !isDefault ? (
                        <Pressable
                            onPress={handleDelete}
                            disabled={busy}
                            style={({ pressed }) => [
                                styles.deleteBtn,
                                pressed && !busy && styles.pressed,
                            ]}>
                            <ThemedText style={styles.deleteText}>
                                {deleting ? 'Deleting…' : 'Delete list'}
                            </ThemedText>
                        </Pressable>
                    ) : null}
                    {isDefault ? (
                        <ThemedText type="small" themeColor="textSecondary">
                            Inbox is the default list and can&apos;t be deleted. New
                            tasks land here unless you pick another list.
                        </ThemedText>
                    ) : null}
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.three,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ddd',
    },
    headerBtn: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
    scroll: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
    field: { gap: Spacing.two },
    previewRow: { alignItems: 'flex-start' },
    previewChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
    },
    previewChipText: { color: '#2A2E3A', fontWeight: '600' },
    swatchRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.three,
        paddingVertical: Spacing.one,
    },
    swatch: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 3,
    },
    errorText: { color: '#B85D52' },
    deleteBtn: {
        marginTop: Spacing.three,
        paddingVertical: Spacing.three,
        borderRadius: Spacing.two,
        backgroundColor: '#F3D9D3',
        alignItems: 'center',
    },
    deleteText: { color: '#B85D52', fontWeight: '600' },
    // UX-010: Move up / Move down buttons. Side-by-side, equal width, subtle border.
    // Lower visual weight than the destructive Delete button — these are routine.
    moveRow: {
        flexDirection: 'row',
        gap: Spacing.two,
    },
    moveBtn: {
        flex: 1,
        paddingVertical: Spacing.three,
        borderRadius: Spacing.two,
        borderWidth: 1,
        alignItems: 'center',
    },
    moveBtnText: { fontWeight: '600' },
    pressed: { opacity: 0.7 },
});
