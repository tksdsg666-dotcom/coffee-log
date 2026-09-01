/**
 * A number you tap to type into.
 *
 * Shared by the parameter rows and the grind card so one gesture means one
 * thing everywhere: tap to edit, empty the box to clear. It replaces SPEC
 * § 参数留空's tap-to-clear, which left no way to jump straight to a value —
 * reaching 60g from 10g was ten presses of ＋.
 */
import { useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, font, radius } from '@/theme';
import { Num, Tap, Txt } from './ui';

export function EditableNumber({
  value,
  format,
  unit,
  size = 19,
  boxStyle,
  editBoxStyle,
  onCommit,
}: {
  value: number | null;
  /** How the value reads when not being edited. */
  format: (v: number | null) => string;
  /** Raw unit shown while typing — 时间 is entered in 秒, not as mm:ss. */
  unit: string;
  size?: number;
  boxStyle?: StyleProp<ViewStyle>;
  editBoxStyle?: StyleProp<ViewStyle>;
  onCommit: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const begin = () => {
    setText(value == null ? '' : String(value));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const t = text.trim();
    if (t === '') {
      onCommit(null);
      return;
    }
    const n = Number(t);
    if (Number.isFinite(n)) onCommit(n);
  };

  if (editing) {
    return (
      <View style={[styles.editBox, editBoxStyle]}>
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="decimal-pad"
          returnKeyType="done"
          autoFocus
          selectTextOnFocus
          selectionColor={color.accent}
          style={[styles.input, { fontSize: size }]}
        />
        <Txt size={Math.max(12, size - 7)} c={color.neutral600}>
          {unit}
        </Txt>
      </View>
    );
  }

  return (
    <Tap onPress={begin} style={[styles.box, boxStyle]}>
      <Num size={size} c={value == null ? color.neutral400 : color.text}>
        {format(value)}
      </Num>
    </Tap>
  );
}

const styles = StyleSheet.create({
  box: {
    minWidth: 82,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: radius.number,
    backgroundColor: color.neutral200,
  },
  editBox: {
    minWidth: 82,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 8,
    borderRadius: radius.number,
    backgroundColor: color.accent100,
    borderWidth: 1,
    borderColor: color.accent,
  },
  input: {
    minWidth: 46,
    paddingVertical: 0,
    textAlign: 'center',
    fontFamily: font.heading,
    color: color.text,
  },
});
