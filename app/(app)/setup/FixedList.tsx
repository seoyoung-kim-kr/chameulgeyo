'use client'

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import clsx from 'clsx'
import { IoReorderThree, IoTrashOutline } from 'react-icons/io5'
import type { PaymentMethod } from '@/lib/cashflow'
import { formatWon } from '@/lib/format'
import { AMOUNT_MAX, FIXED_MAX_COUNT, FIXED_NAME_MAX } from '@/lib/validation'

export type FixedRow = { key: number; name: string; amount: number; method: PaymentMethod | null }

type Props = {
  rows: FixedRow[]
  onChange: (rows: FixedRow[]) => void
}

/**
 * 고정지출 목록. 왼쪽 손잡이(≡)를 잡고 끌어서 순서를 바꾼다 (저장 순서 = 화면 순서, fixed_expenses.sort).
 * 손잡이에만 드래그가 걸려서 이름·금액 입력과 부딪히지 않는다. 키보드는 손잡이에 포커스 → 스페이스 → 화살표.
 */
export function FixedList({ rows, onChange }: Props) {
  const sensors = useSensors(
    // 손가락이 조금 움직인 뒤에 드래그 시작 (탭과 구분)
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const update = (key: number, patch: Partial<FixedRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const remove = (key: number) => onChange(rows.filter((r) => r.key !== key))
  const add = () => onChange([...rows, { key: Math.max(-1, ...rows.map((r) => r.key)) + 1, name: '', amount: 0, method: null }])
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = rows.findIndex((r) => r.key === active.id)
    const to = rows.findIndex((r) => r.key === over.id)
    if (from >= 0 && to >= 0) onChange(arrayMove(rows, from, to))
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((f) => (
              <Row key={f.key} row={f} onUpdate={(patch) => update(f.key, patch)} onRemove={() => remove(f.key)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {rows.length < FIXED_MAX_COUNT && (
        <button type="button" onClick={add} className="h-12 w-full rounded-xl border border-dashed border-line text-sm text-deep active:bg-tint">
          + 항목 추가
        </button>
      )}
    </>
  )
}

/**
 * 한 항목 = 한 줄. 상자 테두리 없이 글자만 두고, 포커스한 칸에만 밑줄이 생긴다.
 *   [≡] 이름(굵게)                 30,000 원
 *   [🗑] (계좌 | 카드)
 * 왼쪽 줄: 손잡이는 이름 줄에, 휴지통은 결제수단 줄에 맞춘다.
 */
function Row({ row: f, onUpdate, onRemove }: { row: FixedRow; onUpdate: (patch: Partial<FixedRow>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: f.key })
  const label = f.name || '항목'
  const nameInvalid = f.amount > 0 && f.name.trim() === ''
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        'grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 py-3 first:pt-0',
        isDragging && 'relative z-10 rounded-xl bg-white px-2 shadow-[0_8px_24px_rgba(0,0,0,.12)]',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`${label} 순서 바꾸기`}
        {...attributes}
        {...listeners}
        className="flex h-8 w-6 cursor-grab touch-none items-center justify-center rounded-lg text-xl text-muted/50 active:cursor-grabbing active:text-muted"
      >
        <IoReorderThree aria-hidden />
      </button>

      <span className={clsx('flex h-8 items-center border-b', nameInvalid ? 'border-red' : 'border-transparent focus-within:border-pink')}>
        <input
          aria-label="항목 이름"
          placeholder="항목 이름"
          autoComplete="off"
          maxLength={FIXED_NAME_MAX}
          value={f.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="w-full min-w-0 bg-transparent text-base font-bold outline-none placeholder:font-normal placeholder:text-muted/50"
        />
      </span>

      <span className="flex h-8 items-center gap-1 border-b border-transparent focus-within:border-pink">
        <input
          aria-label={`${label} 금액`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={f.amount === 0 ? '' : formatWon(f.amount)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
            onUpdate({ amount: Math.min(Number(digits || '0'), AMOUNT_MAX) })
          }}
          className="w-24 min-w-0 bg-transparent text-right text-base font-bold outline-none placeholder:font-normal placeholder:text-muted/50"
        />
        <span className="text-sm text-muted">원</span>
      </span>


      <button
        type="button"
        aria-label={`${label} 삭제`}
        onClick={onRemove}
        className="mt-1 flex h-7 w-6 items-center justify-center rounded-lg text-base text-muted/60 active:bg-soft active:text-red"
      >
        <IoTrashOutline aria-hidden />
      </button>
      <div role="radiogroup" aria-label={`${label} 결제 수단`} className={clsx('col-span-2 mt-1 flex w-fit gap-0.5 rounded-full p-0.5', f.method === null ? 'bg-soft ring-1 ring-red' : 'bg-soft')}>
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={f.method === m.value}
            onClick={() => onUpdate({ method: m.value })}
            className={clsx(
              'h-6 rounded-full px-2.5 text-xs transition-colors',
              f.method === m.value ? 'bg-white font-bold text-deep shadow-sm' : 'text-muted active:text-ink',
            )}
          >
            {m.label}
          </button>
        ))}
        {f.method === null && <span className="self-center pr-2 pl-1 text-xs text-red">선택</span>}
      </div>
    </li>
  )
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'account', label: '계좌' },
  { value: 'card', label: '카드' },
]
