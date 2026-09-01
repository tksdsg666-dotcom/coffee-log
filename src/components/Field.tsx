/**
 * Labelled text input. The pill shape and neutral fill come from the Organic
 * `.input` class; an empty `label` renders the box on its own, which the bean
 * form uses for the "or type your own" inputs that sit under a chip row.
 */
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { color, font, radius } from '@/theme';
import { Txt } from './ui';

export function Field({
  label,
  value,
  onChange,
  multiline,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  // `onChange` is deliberately shadowed: TextInput's own onChange hands back an
  // event, and letting both signatures merge makes every call site ambiguous.
} & Omit<TextInputProps, 'value' | 'onChange' | 'onChangeText' | 'style'>) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <Txt size={13} c={color.neutral700}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholderTextColor={color.neutral400}
        selectionColor={color.accent}
        style={[styles.input, multiline && styles.multiline]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: color.neutral100,
    borderWidth: 1,
    borderColor: color.hairline,
    fontFamily: font.body,
    fontSize: 15,
    color: color.text,
  },
  multiline: {
    minHeight: 92,
    borderRadius: radius.small,
    textAlignVertical: 'top',
  },
});
