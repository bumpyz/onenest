// ListForm — CreateList / EditList surface, v2 scaffold (spec 05.8).
//
// Design source: docs/design-handoffs/onenest-spec-v1/
//   design_handoff_creation_flows/screens-creation.jsx::CreateList
//   (~line 440).
//
// Sections, top to bottom (matches canvas 05.8):
//   1. TitleInput "LIST NAME" — accent underline.
//   2. Kind — 4-segment SegRow (Tasks / Grocery / Shopping / Packing)
//      with explainer copy below. Currently no DB column backs this;
//      the picker is a visual scaffold and the value isn't persisted
//      until a follow-up schema migration adds `lists.kind`.
//   3. Color + Icon — 8 swatches mapped to LIST_PALETTE + icon
//      chevron row (icon picker is deferred — sub-row reads "Coming
//      soon").
//   4. For — multi-select kid chips. Setting kids here drives a
//      downstream default; same schema gap as Kind (no FK to children
//      from lists yet — visual scaffold).
//   5. Shared with — member chips + Caregiver DashedAddChip + accent-
//      tinted visibility banner. Schema gap as above.
//   6. Start from — TmplRow radio rows (Blank / Soccer prep / School
//      morning / Custom paste). Templates aren't backed yet; "Blank
//      list" is the only functional option.
//   7. Smart suggestion — dashed-border card (visual scaffold).
//
// The shape of `ListFormSubmit` stays minimal (`name` + `color`)
// because that's what the current `lists` schema supports. The richer
// fields will hook up via this same form once the migration lands.

import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    ColorSwatch,
    CreateTopBar,
    DashedAddChip,
    FormGroup,
    FormRow,
    FormSectionLabel,
    PersonChip,
    SegRow,
    TitleInput,
    TmplRow,
} from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, FontFamily, Spacing } from '@/constants/theme';
import { LIST_PALETTE } from '@/lib/colors';
import { errorMessage } from '@/lib/errors';
import { useAppColorScheme } from '@/providers/theme-provider';

// ─── Public types ───────────────────────────────────────────────────────

// Kind enum is local for now — when `lists.kind` lands as a schema
// column, lift this to db.ts as a real exported type.
type ListKind = 'tasks' | 'grocery' | 'shopping' | 'packing';
type TemplateId = 'blank' | 'soccer-prep' | 'school-morning' | 'custom-paste';

export type ListFormValues = {
    name: string;
    /** Hex #RRGGBB. Null on create lets the DB trigger pick. */
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
    isDefault?: boolean;
    taskCount?: number;
    onMoveUp?: () => Promise<void>;
    onMoveDown?: () => Promise<void>;
    onSubmit: (input: ListFormSubmit) => Promise<void>;
    onDelete?: () => Promise<void>;
    onCancel: () => void;
};

const KIND_OPTIONS: ReadonlyArray<{ id: ListKind; label: string }> = [
    { id: 'tasks', label: 'Tasks' },
    { id: 'grocery', label: 'Grocery' },
    { id: 'shopping', label: 'Shopping' },
    { id: 'packing', label: 'Packing' },
];

const KIND_COPY: Record<ListKind, string> = {
    tasks: 'Tasks include due dates and assignments.',
    grocery: 'Grocery items add quantity + store.',
    shopping: 'Shopping items add price + retailer.',
    packing: 'Packing items add a where-it’s-going destination.',
};

// ─── Component ─────────────────────────────────────────────────────────

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
    // Visual-only state — not persisted until schema lands.
    const [kind, setKind] = useState<ListKind>('tasks');
    const [template, setTemplate] = useState<TemplateId>('blank');
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

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <CreateTopBar
                    title={headerTitle}
                    saveLabel={submitting ? 'Saving…' : submitLabel}
                    saveDisabled={!canSubmit}
                    onCancel={onCancel}
                    onSave={handleSubmit}
                />
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled">
                    <TitleInput
                        label="LIST NAME"
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g. Soccer prep"
                        autoFocus={!initialValues.name}
                        autoCapitalize="words"
                        editable={!busy}
                    />

                    {/* KIND */}
                    <FormSectionLabel>Kind</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.segWrap}>
                                <SegRow
                                    options={KIND_OPTIONS}
                                    selected={kind}
                                    onSelect={setKind}
                                    disabled={busy}
                                />
                                <ThemedText
                                    style={[
                                        styles.helperCopy,
                                        { color: colors.inkFaint },
                                    ]}>
                                    {KIND_COPY[kind]}
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.helperCopy,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily: FontFamily.monoMedium,
                                            marginTop: 4,
                                        },
                                    ]}>
                                    · List kind backend lands in a future
                                    update — the selection isn't saved yet.
                                </ThemedText>
                            </View>
                        </FormGroup>
                    </View>

                    {/* COLOR + ICON */}
                    <FormSectionLabel>Color</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.swatchRow}>
                                {LIST_PALETTE.map((c) => (
                                    <ColorSwatch
                                        key={c}
                                        color={c}
                                        selected={color === c}
                                        onPress={() => setColor(c)}
                                        disabled={busy}
                                        label={`Color ${c}`}
                                    />
                                ))}
                            </View>
                            <FormRow
                                label="Icon"
                                value="Coming soon"
                                muted
                                chevron
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* FOR (kids) — schema-gated. Render the row muted
                        "Coming soon" rather than ship chips that can't
                        save. */}
                    <FormSectionLabel>For</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <FormRow
                                label="Tag kids"
                                value="Coming soon"
                                muted
                                chevron
                            />
                            <ExplainerRow
                                colors={colors}
                                text={
                                    'New tasks added to this list will default to the tagged kids once the migration lands.'
                                }
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* SHARED WITH — schema-gated. */}
                    <FormSectionLabel>Shared with</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.chipBlock}>
                                <View style={styles.chipRow}>
                                    <PersonChip
                                        name="Me"
                                        color={colors.accent}
                                        selected
                                    />
                                    <DashedAddChip label="+ Caregiver" />
                                </View>
                                <View
                                    style={[
                                        styles.visibilityBanner,
                                        {
                                            backgroundColor:
                                                colors.accent + '10',
                                        },
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.visibilityText,
                                            { color: colors.inkSec },
                                        ]}>
                                        Anyone shared can add tasks and tick
                                        them off. External co-parents only see
                                        tasks tagged for kids they share.
                                    </ThemedText>
                                </View>
                            </View>
                        </FormGroup>
                    </View>

                    {/* START FROM */}
                    <FormSectionLabel>Start from</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <TmplRow
                                title="Blank list"
                                sub="Just the name and the kid"
                                selected={template === 'blank'}
                                onPress={() => setTemplate('blank')}
                            />
                            <TmplRow
                                title="Soccer prep"
                                sub="6 typical items · cleats, water, snack, shin guards…"
                                badge="POPULAR"
                                selected={template === 'soccer-prep'}
                                onPress={() => setTemplate('soccer-prep')}
                                disabled
                            />
                            <TmplRow
                                title="School morning"
                                sub="9 typical items · backpack, lunch, library book…"
                                selected={template === 'school-morning'}
                                onPress={() => setTemplate('school-morning')}
                                disabled
                            />
                            <TmplRow
                                title="Custom paste"
                                sub="Paste a list · we'll split it into items"
                                selected={template === 'custom-paste'}
                                onPress={() => setTemplate('custom-paste')}
                                disabled
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* ORDER (Move up / Move down) — preserved from the
                        previous form for native users since the Lists
                        tab's drag-to-reorder is web-only. Kept outside
                        the v2 vocabulary as a transitional affordance
                        until a real reorder picker lands. */}
                    {onMoveUp || onMoveDown ? (
                        <>
                            <FormSectionLabel>Order</FormSectionLabel>
                            <View style={styles.section}>
                                <FormGroup flush>
                                    <FormRow
                                        label="Move up"
                                        onPress={
                                            onMoveUp
                                                ? () => handleMove('up')
                                                : undefined
                                        }
                                        disabled={!onMoveUp || busy}
                                        chevron={!!onMoveUp}
                                        value={onMoveUp ? '' : 'Top of list'}
                                        muted={!onMoveUp}
                                    />
                                    <FormRow
                                        label="Move down"
                                        onPress={
                                            onMoveDown
                                                ? () => handleMove('down')
                                                : undefined
                                        }
                                        disabled={!onMoveDown || busy}
                                        chevron={!!onMoveDown}
                                        value={
                                            onMoveDown ? '' : 'Bottom of list'
                                        }
                                        muted={!onMoveDown}
                                        last
                                    />
                                </FormGroup>
                            </View>
                        </>
                    ) : null}

                    {isDefault ? (
                        <View style={styles.section}>
                            <ThemedText
                                style={[
                                    styles.inboxNote,
                                    { color: colors.inkFaint },
                                ]}>
                                Inbox is the default list and can't be deleted.
                                New tasks land here unless you pick another
                                list.
                            </ThemedText>
                        </View>
                    ) : null}

                    {error ? (
                        <ThemedText
                            type="small"
                            style={[
                                styles.errorText,
                                { color: BrandColors.error },
                            ]}>
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
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

function ExplainerRow({
    text,
    colors,
    last,
}: {
    text: string;
    colors: typeof Colors.light | typeof Colors.dark;
    last?: boolean;
}) {
    return (
        <View
            style={[
                styles.explainerRow,
                !last && {
                    borderTopColor: colors.hair,
                    borderTopWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <ThemedText
                style={[
                    styles.explainerText,
                    { color: colors.inkFaint },
                ]}>
                {text}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: Spacing.six },
    section: { paddingHorizontal: 16, paddingBottom: 12 },

    segWrap: { padding: 14 },
    helperCopy: { fontSize: 11, lineHeight: 16, marginTop: 8 },

    swatchRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        padding: 14,
    },

    chipBlock: { padding: 12, gap: 10 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    visibilityBanner: {
        flexDirection: 'row',
        gap: 7,
        padding: 9,
        borderRadius: 7,
    },
    visibilityText: { fontSize: 11, lineHeight: 16, flex: 1 },

    explainerRow: { paddingHorizontal: 14, paddingVertical: 10 },
    explainerText: { fontSize: 11, lineHeight: 16 },

    inboxNote: { fontSize: 12, lineHeight: 18 },
    errorText: {
        paddingHorizontal: 16,
        paddingTop: Spacing.two,
    },

    deleteBtn: {
        marginTop: Spacing.three,
        marginHorizontal: 16,
        paddingVertical: Spacing.three,
        borderRadius: Spacing.two,
        backgroundColor: BrandColors.errorBackground,
        alignItems: 'center',
    },
    deleteText: { color: BrandColors.error, fontWeight: '600' },
    pressed: { opacity: 0.7 },
});
