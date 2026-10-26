import type { PersonLine } from '@app/core';

import { MetaLine, Money } from '@/components/house-page/money';
import { Row } from '@/components/row';

/**
 * A housemate page's rows from core's lines: the title, one meta line, and
 * the value trailing. A row carries one hazard mark: before late and missed
 * when it says them, otherwise on money lost.
 */
export function PersonLines({ lines, testID }: { lines: readonly PersonLine[]; testID?: string }) {
  return lines.map((line) => (
    <Row
      key={line.key}
      title={line.title}
      meta={line.meta.length ? <MetaLine parts={line.meta} /> : undefined}
      trailing={
        line.value != null ? (
          <Money value={line.value} losing={line.losing} marked={!line.meta.some((part) => part.hazard)} />
        ) : undefined
      }
      testID={testID}
    />
  ));
}
