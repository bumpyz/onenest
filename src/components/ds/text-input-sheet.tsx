// TextInputSheet — generic single-field text-entry sheet. Wraps a
// TitleInput inside a SheetShell with Save/Cancel chrome.
//
// Used by every FormRow + chevron row whose picker is "type a short
// string and confirm" — e.g. AddChild's Pronouns / Nickname / School /
// Grade / Teacher rows. Keeps the v2 chevron-row vocabulary honest
// without forcing every caller to author its own sheet.
//
// Behavior:
//   • Mounts with a fresh draft seeded from `initialValue` on each open.
//   • Save commits the draft (trimmed) via onSave.
//   • Cancel discards the draft and closes the sheet.
//   • Empty draft passes through as '' — callers decide how to treat
//     empty (typically map to null at the DB layer).
//
// Layout: title + sub at the SheetShell top, TitleInput in the body,
// Save pill + Cancel secondary in the footer.

import { useEffect, useState } from 'react';
import { StyleSheet, View, type TextInputProps } from 'react-native';

import { SheetShell } from './sheet-shell';
import { TitleInput } from './title-input';

type Props = {
    open: boolean;
    /** Sentence-case sheet title (e.g. "Pronouns"). */
    title: string;
    /** Mono caps label that sits above the input (e.g. "PRONOUNS"). */
    fieldLabel: string;
    /** Optional sub-text below the title — context for what to type. */
    sub?: string;
    initialValue: string;
    placeholder?: string;
    /** Render the value mono (default sans). Used for short-code fields
     *  like grade levels where a tabular feel reads better. */
    mono?: boolean;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    /** HTML autocomplete hint forwarded to the inner TitleInput.
     *  Defaults to TitleInput's own default of 'off' — the right call
     *  for the bulk of TextInputSheet callers (Pronouns / Grade /
     *  Teacher / List name / Household name etc. are app-domain
     *  values nothing in the browser has a saved credential for). */
    autoComplete?: TextInputProps['autoComplete'];
    /** Save button label override. Defaults to "Save". */
    saveLabel?: string;
    onSave: (value: string) => void;
    onClose: () => void;
};

export function TextInputSheet({
    open,
    title,
    fieldLabel,
    sub,
    initialValue,
    placeholder,
    mono = false,
    autoCapitalize = 'sentences',
    autoComplete,
    saveLabel = 'Save',
    onSave,
    onClose,
}: Props) {
    const [draft, setDraft] = useState(initialValue);
    useEffect(() => {
        if (open) setDraft(initialValue);
    }, [open, initialValue]);

    return (
        <SheetShell
            open={open}
            onClose={onClose}
            title={title}
            sub={sub}
            primary={saveLabel}
            secondary="Cancel"
            onPrimary={() => onSave(draft.trim())}
            onSecondary={onClose}
            height={300}>
            <View style={styles.body}>
                <TitleInput
                    label={fieldLabel}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={placeholder}
                    mono={mono}
                    autoFocus
                    autoCapitalize={autoCapitalize}
                    autoComplete={autoComplete}
                />
            </View>
        </SheetShell>
    );
}

const styles = StyleSheet.create({
    body: {
        // TitleInput owns its own internal padding (14/20/6). The sheet
        // body just needs to neutralize SheetShell's default
        // contentInner padding so the input sits flush against the
        // sheet edges per the TitleInput spec.
        marginHorizontal: -16,
        marginTop: -12,
    },
});
