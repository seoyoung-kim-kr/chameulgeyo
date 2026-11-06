'use client'

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import clsx from 'clsx'
import { IoClose, IoReorderThree } from 'react-icons/io5'
import { MoneyInput, TextInput } from '@/components/Field'
import type { PaymentMethod } from '@/lib/cashflow'
import { FIXED_MAX_COUNT, FIXED_NAME_MAX } from '@/lib/validation'

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

function Row({ row: f, onUpdate, onRemove }: { row: FixedRow; onUpdate: (patch: Partial<FixedRow>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: f.key })
  const label = f.name || '항목'
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        'grid grid-cols-[2rem_minmax(0,1fr)_5rem_2rem] items-center gap-2 py-3 first:pt-0',
        isDragging && 'relative z-10 rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,.12)]',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`${label} 순서 바꾸기`}
        {...attributes}
        {...listeners}
        className="flex h-12 w-8 cursor-grab touch-none items-center justify-center rounded-lg text-2xl text-muted active:cursor-grabbing active:bg-soft"
      >
        <IoReorderThree aria-hidden />
      </button>
      <TextInput
        aria-label="항목 이름"
        placeholder="항목 이름"
        maxLength={FIXED_NAME_MAX}
        value={f.name}
        invalid={f.amount > 0 && f.name.trim() === ''}
        onChange={(e) => onUpdate({ name: e.target.value })}
      />
      <select
        aria-label={`${label} 결제 수단`}
        value={f.method ?? ''}
        onChange={(e) => onUpdate({ method: (e.target.value || null) as PaymentMethod | null })}
        className={clsx(
          'h-12 rounded-xl border bg-white px-2 text-sm outline-none focus:border-pink',
          f.method === null ? 'border-red text-red' : 'border-line text-ink',
        )}
      >
        <option value="">선택</option>
        <option value="account">계좌</option>
        <option value="card">카드</option>
      </select>
      <button type="button" aria-label={`${label} 삭제`} onClick={onRemove} className="flex size-8 items-center justify-center rounded-full text-lg text-muted active:bg-soft">
        <IoClose aria-hidden />
      </button>
      <MoneyInput label={`${label} 금액`} value={f.amount} onChange={(amount) => onUpdate({ amount })} className="col-span-3 col-start-2" />
    </li>
  )
}
