import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '@/lib/i18n';
import type { DiagnosisResult } from '@/lib/types';
import { Badge, Card, colors, IconName, Muted, Notice, SectionTitle } from './ui';

const TYPE_ICON: Record<string, IconName> = { disease: 'bandage', pest: 'bug', nutrient: 'flask', water: 'water', other: 'help-circle' };

/** What a photo check found, and what to do about it. */
export function DiagnosisView({ result }: { result: DiagnosisResult }) {
  const { t } = useT();
  const confidence = { low: t('Not sure'), medium: t('Fairly sure'), high: t('Sure') }[result.confidence];

  if (!result.is_plant) {
    return (
      <Notice icon="image-outline">
        {[t('This photo does not seem to show a crop.'), result.photo_tip].filter(Boolean).join(' ')}
      </Notice>
    );
  }

  return (
    <>
      <Card style={{ borderLeftWidth: 5, borderLeftColor: result.healthy ? colors.primary : colors.warning }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
          <Ionicons name={result.healthy ? 'checkmark-circle' : 'alert-circle'} size={28} color={result.healthy ? colors.primary : colors.warning} />
          <Text style={s.headline}>{result.healthy ? t('Looks healthy') : t('Needs attention')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {!!result.crop && <Badge text={result.crop} tone="success" />}
          <Badge text={confidence} tone={result.confidence === 'low' ? 'warning' : 'neutral'} />
        </View>
        <Text style={s.body}>{result.summary}</Text>
      </Card>

      {!!result.photo_tip && <Notice tone="info" icon="camera">{result.photo_tip}</Notice>}
      {result.see_expert && (
        <Notice icon="people">{t('Show this crop to an agricultural extension officer or a trusted agrovet soon.')}</Notice>
      )}

      {result.problems.length > 0 && (
        <>
          <SectionTitle>{t('What it may be')}</SectionTitle>
          {result.problems.map((p, i) => (
            <Card key={i}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name={TYPE_ICON[p.type] ?? 'help-circle'} size={20} color={colors.soil} />
                <Text style={[s.problem, { flex: 1 }]}>{p.name}</Text>
                <Badge text={p.likelihood === 'likely' ? t('Likely') : t('Possible')} tone={p.likelihood === 'likely' ? 'warning' : 'neutral'} />
              </View>
              <Muted>{p.signs}</Muted>
            </Card>
          ))}
        </>
      )}

      {result.actions.length > 0 && <Steps title={t('What to do now')} items={result.actions} icon="arrow-forward-circle" />}
      {result.prevention.length > 0 && <Steps title={t('Next season')} items={result.prevention} icon="shield-checkmark" />}

      <Muted style={{ marginTop: 8 }}>{t('This check is a guide from a photo, not a lab test. When a crop is badly affected, ask an extension officer before spending on sprays.')}</Muted>
    </>
  );
}

function Steps({ title, items, icon }: { title: string; items: string[]; icon: IconName }) {
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card>
        {items.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', marginBottom: i === items.length - 1 ? 0 : 10 }}>
            <Ionicons name={icon} size={20} color={colors.primary} style={{ marginRight: 10, marginTop: 1 }} />
            <Text style={[s.body, { flex: 1 }]}>{item}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

const s = StyleSheet.create({
  headline: { fontSize: 20, fontWeight: '800', color: colors.text },
  problem: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 23 },
});
