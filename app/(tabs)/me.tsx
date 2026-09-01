/**
 * 我的 — Tab 3.
 *
 * This round carries 我的设备 and the export/import controls. 本月摘要, 常喝品牌
 * and the 统计 screen are next round, so the tab is device management plus the
 * data escape hatch rather than the full profile SPEC describes.
 *
 * Devices matter more than they look: SPEC makes this table the single source
 * for the record form's gear and grinder pickers, and a grinder's step/range
 * defines the whole grind card. With no seed data, nothing can be brewed at
 * home until something is added here.
 */
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { NavAction, ScreenTitle } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Chip, Divider, GroupLabel, Num, PillButton, Segment, Tap, Txt } from '@/components/ui';
import { deleteDevice, insertDevice, updateDevice } from '@/db/mutations';
import { useQuery } from '@/db/live';
import { allDevices, allRecords } from '@/db/queries';
import type { Device } from '@/db/schema';
import { DEVICE_KINDS, GRIND_PRECISIONS, GRIND_UNITS, kindSpec } from '@/domain/device';
import { grindText, midpointDefault } from '@/domain/grind';
import { exportBackup, importBackup, wipeAll } from '@/lib/backup';
import {
  allSettings,
  readSource,
  readTemp,
  setDefaultSource,
  setDefaultTemp,
} from '@/db/settings';
import { routes } from '@/lib/routes';
import { color, radius, shadowSm } from '@/theme';

type DeviceDraft = {
  name: string;
  kind: string;
  gstep: number;
  gmin: string;
  gmax: string;
  gunit: string;
};

const emptyDevice = (): DeviceDraft => ({
  name: '',
  kind: '滤杯',
  gstep: 1,
  gmin: '',
  gmax: '',
  gunit: '格',
});

type Editing = { mode: 'new' } | { mode: 'edit'; device: Device } | null;

export default function MeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: devices } = useQuery(allDevices);
  const { data: records } = useQuery(allRecords);
  const { data: settingRows } = useQuery(allSettings);
  const defaultSource = readSource(settingRows);
  const defaultTemp = readTemp(settingRows);

  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<DeviceDraft>(emptyDevice);
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    const list = devices ?? [];
    return [
      { title: '冲煮器具', items: list.filter((d) => d.isBrew) },
      { title: '磨豆机', items: list.filter((d) => d.isGrinder) },
      { title: '其他', items: list.filter((d) => !d.isBrew && !d.isGrinder) },
    ];
  }, [devices]);

  const spec = kindSpec(draft.kind);
  const isGrinder = spec?.isGrinder ?? false;

  const startNew = () => {
    setDraft(emptyDevice());
    setEditing({ mode: 'new' });
  };

  const startEdit = (device: Device) => {
    setDraft({
      name: device.name,
      kind: device.kind,
      gstep: device.gstep ?? 1,
      gmin: device.gmin != null ? String(device.gmin) : '',
      gmax: device.gmax != null ? String(device.gmax) : '',
      gunit: device.gunit ?? '格',
    });
    setEditing({ mode: 'edit', device });
  };

  const pickKind = (kind: string) => {
    const k = kindSpec(kind);
    setDraft((d) => ({
      ...d,
      kind,
      gstep: k?.gstep ?? d.gstep,
      gunit: k?.gunit ?? d.gunit,
      gmin: d.gmin || (k?.gmin != null ? String(k.gmin) : ''),
      gmax: d.gmax || (k?.gmax != null ? String(k.gmax) : ''),
    }));
  };

  const submit = async () => {
    const name = draft.name.trim();
    if (!name || !spec) return;

    const min = Number(draft.gmin);
    const max = Number(draft.gmax);
    const validRange = Number.isFinite(min) && Number.isFinite(max) && max > min;

    const values = {
      name,
      kind: draft.kind,
      isBrew: spec.isBrew,
      isGrinder: spec.isGrinder,
      gstep: isGrinder ? draft.gstep : null,
      gmin: isGrinder ? (validRange ? min : (spec.gmin ?? 1)) : null,
      gmax: isGrinder ? (validRange ? max : (spec.gmax ?? 40)) : null,
      gdef: isGrinder
        ? midpointDefault(
            validRange ? min : (spec.gmin ?? 1),
            validRange ? max : (spec.gmax ?? 40),
            draft.gstep,
          )
        : null,
      gunit: isGrinder ? draft.gunit : null,
    };

    if (editing?.mode === 'edit') await updateDevice(editing.device.id, values);
    else await insertDevice(values);
    setEditing(null);
  };

  const confirmDeleteDevice = (device: Device) => {
    const used = (records ?? []).filter(
      (r) => r.gear === device.name || r.grinder === device.name,
    ).length;
    Alert.alert(
      `删除「${device.name}」？`,
      used > 0
        ? `已有 ${used} 条记录用过它。记录会保留，里面的器具名也照样显示，只是以后选不到这台了。`
        : '以后在记一杯里就选不到它了。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void deleteDevice(device.id).then(() => setEditing(null));
          },
        },
      ],
    );
  };

  const doExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const n = await exportBackup();
      if (n == null) Alert.alert('这台设备不支持分享', '导出文件生成了，但系统没有可用的分享面板。');
    } catch (e) {
      Alert.alert('导出失败', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      const asset = picked.canceled ? null : picked.assets[0];
      if (!asset) return;

      const json = await new File(asset.uri).text();
      const r = await importBackup(json);
      Alert.alert(
        '导入完成',
        [
          `新增 ${r.inserted.records} 条记录、${r.inserted.beans} 支豆子、${r.inserted.devices} 台设备`,
          r.skipped.records > 0 ? `${r.skipped.records} 条已存在，跳过` : '',
          r.missingPhotos > 0 ? `${r.missingPhotos} 张照片不在这台设备上` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    } catch (e) {
      Alert.alert('导入失败', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmWipe = () => {
    Alert.alert('清空所有数据？', '记录、豆子、设备、照片会全部删掉，找不回来。建议先导出一份备份。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清空',
        style: 'destructive',
        onPress: () => {
          Alert.alert('真的要清空吗？', '这一步没有撤销。', [
            { text: '取消', style: 'cancel' },
            {
              text: '确认清空',
              style: 'destructive',
              onPress: () => {
                void wipeAll();
              },
            },
          ]);
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 4 }]}>
        <ScreenTitle>我的</ScreenTitle>

        <View style={styles.inner}>
          <Tap onPress={() => router.push(routes.stats)} style={styles.statsRow}>
            <View style={styles.dataText}>
              <Txt size={15} w="semi">
                统计
              </Txt>
              <Txt size={12} c={color.neutral600}>
                日历、本月杯数、各做法占比
              </Txt>
            </View>
            <Txt size={18} c={color.neutral400}>
              ›
            </Txt>
          </Tap>

          <View style={styles.section}>
            <GroupLabel>偏好</GroupLabel>
            <View style={styles.card}>
              <View style={styles.prefRow}>
                <View style={styles.dataText}>
                  <Txt size={15} w="semi">
                    默认来源
                  </Txt>
                  <Txt size={12} c={color.neutral600}>
                    记一杯的起始选项，也决定豆子列表哪一段在前
                  </Txt>
                </View>
                <Segment
                  options={[
                    { value: 'shop', label: '门店' },
                    { value: 'self', label: '自制' },
                  ]}
                  value={defaultSource}
                  onChange={(v) => void setDefaultSource(v)}
                  style={styles.prefSeg}
                />
              </View>
              <Divider inset={16} />
              <View style={styles.prefRow}>
                <View style={styles.dataText}>
                  <Txt size={15} w="semi">
                    默认冷热
                  </Txt>
                  <Txt size={12} c={color.neutral600}>
                    夏天调成冰，省一次点击
                  </Txt>
                </View>
                <Segment
                  options={[
                    { value: 'hot', label: '热' },
                    { value: 'ice', label: '冰' },
                  ]}
                  value={defaultTemp}
                  onChange={(v) => void setDefaultTemp(v)}
                  style={styles.prefSeg}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <GroupLabel>我的设备</GroupLabel>
            {(devices ?? []).length === 0 ? (
              <View style={styles.emptyCard}>
                <Txt size={14} c={color.neutral700}>
                  还没有设备
                </Txt>
                <Txt size={12.5} c={color.neutral500} style={styles.emptyHint}>
                  自制滴滤要先在这里添加冲煮器具和磨豆机 —— 研磨刻度的量程和单位都跟着磨豆机走。
                </Txt>
              </View>
            ) : (
              grouped.map((g) =>
                g.items.length === 0 ? null : (
                  <View key={g.title} style={styles.deviceGroup}>
                    <Txt size={12.5} c={color.neutral600} style={styles.groupSub}>
                      {g.title}
                    </Txt>
                    <View style={styles.card}>
                      {g.items.map((d, i) => (
                        <View key={d.id}>
                          {i > 0 ? <Divider inset={16} /> : null}
                          <View style={styles.deviceRow}>
                            <Tap onPress={() => startEdit(d)} style={styles.deviceMain}>
                              <Txt size={15} w="semi">
                                {d.name}
                              </Txt>
                              <Txt size={12} c={color.neutral600}>
                                {d.kind}
                                {d.isGrinder && d.gmin != null && d.gmax != null
                                  ? ` · ${grindText(d.gmin, d.gunit)}–${grindText(d.gmax, d.gunit)}`
                                  : ''}
                              </Txt>
                            </Tap>
                            <Tap onPress={() => confirmDeleteDevice(d)} style={styles.deviceDelete}>
                              <Txt size={13} c={color.accent700}>
                                删除
                              </Txt>
                            </Tap>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ),
              )
            )}
            <PillButton label="＋ 添加设备" tone="outline" onPress={startNew} />
          </View>

          <View style={styles.section}>
            <GroupLabel>数据</GroupLabel>
            <View style={styles.card}>
              <Tap onPress={() => void doExport()} style={styles.dataRow}>
                <View style={styles.dataText}>
                  <Txt size={15} w="semi">
                    导出备份
                  </Txt>
                  <Txt size={12} c={color.neutral600}>
                    全部数据存成 JSON，通过系统分享面板保存出去
                  </Txt>
                </View>
                <Num size={15} c={color.neutral500}>
                  {(records ?? []).length}
                </Num>
              </Tap>
              <Divider inset={16} />
              <Tap onPress={() => void doImport()} style={styles.dataRow}>
                <View style={styles.dataText}>
                  <Txt size={15} w="semi">
                    从备份导入
                  </Txt>
                  <Txt size={12} c={color.neutral600}>
                    已存在的记录会跳过，不会覆盖
                  </Txt>
                </View>
              </Tap>
              <Divider inset={16} />
              <Tap onPress={confirmWipe} style={styles.dataRow}>
                <View style={styles.dataText}>
                  <Txt size={15} w="semi" c={color.accent700}>
                    清空所有数据
                  </Txt>
                  <Txt size={12} c={color.neutral600}>
                    两次确认，不可撤销
                  </Txt>
                </View>
              </Tap>
            </View>
          </View>
        </View>
      </ScrollView>

      <Sheet
        visible={editing != null}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'edit' ? '编辑设备' : '添加设备'}
        left={<NavAction label="取消" onPress={() => setEditing(null)} />}
      >
        <ScrollView
          contentContainerStyle={styles.formBody}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        >
          <Field
            label="名称"
            value={draft.name}
            onChange={(v) => setDraft({ ...draft, name: v })}
            placeholder="Comandante C40"
          />

          <View style={styles.fieldBlock}>
            <Txt size={13} c={color.neutral700}>
              类型
            </Txt>
            <View style={styles.chipRow}>
              {DEVICE_KINDS.map((k) => (
                <Chip
                  key={k.kind}
                  label={k.kind}
                  selected={draft.kind === k.kind}
                  onPress={() => pickKind(k.kind)}
                />
              ))}
            </View>
          </View>

          {isGrinder ? (
            <>
              <View style={styles.fieldBlock}>
                <Txt size={13} c={color.neutral700}>
                  刻度精度
                </Txt>
                <View style={styles.chipRow}>
                  {GRIND_PRECISIONS.map((p) => (
                    <Chip
                      key={p.step}
                      label={`${p.label}（${p.hint}）`}
                      selected={draft.gstep === p.step}
                      onPress={() => setDraft({ ...draft, gstep: p.step })}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Txt size={13} c={color.neutral700}>
                  单位
                </Txt>
                <View style={styles.chipRow}>
                  {GRIND_UNITS.map((u) => (
                    <Chip
                      key={u}
                      label={u}
                      selected={draft.gunit === u}
                      onPress={() => setDraft({ ...draft, gunit: u })}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.rangeRow}>
                <View style={styles.flex}>
                  <Field
                    label="最小刻度"
                    value={draft.gmin}
                    onChange={(v) => setDraft({ ...draft, gmin: v })}
                    placeholder="5"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.flex}>
                  <Field
                    label="最大刻度"
                    value={draft.gmax}
                    onChange={(v) => setDraft({ ...draft, gmax: v })}
                    placeholder="40"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Txt size={11.5} c={color.neutral500}>
                记录里存的是数字加这个单位，所以换磨之后老记录还显示自己的单位。
              </Txt>
            </>
          ) : null}

          <PillButton
            label={editing?.mode === 'edit' ? '保存修改' : '添加设备'}
            onPress={() => void submit()}
            disabled={!draft.name.trim()}
            style={styles.submit}
          />
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: { paddingBottom: 40 },
  inner: { paddingHorizontal: 16, gap: 26 },
  flex: { flex: 1 },
  section: { gap: 10 },
  deviceGroup: { gap: 6 },
  groupSub: { paddingHorizontal: 6 },
  card: {
    backgroundColor: color.neutral100,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...shadowSm,
  },
  emptyCard: {
    backgroundColor: color.neutral100,
    borderRadius: radius.card,
    padding: 16,
    gap: 6,
    ...shadowSm,
  },
  emptyHint: { lineHeight: 18 },
  deviceRow: { flexDirection: 'row', alignItems: 'center' },
  deviceMain: { flex: 1, gap: 2, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
  deviceDelete: { paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 62,
    borderRadius: radius.card,
    backgroundColor: color.neutral100,
    ...shadowSm,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 64,
  },
  prefSeg: { width: 132 },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  dataText: { flex: 1, gap: 2 },
  formBody: { paddingHorizontal: 16, paddingBottom: 30, gap: 14 },
  fieldBlock: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rangeRow: { flexDirection: 'row', gap: 10 },
  submit: { marginTop: 6 },
});
